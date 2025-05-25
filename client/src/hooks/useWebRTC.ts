import { useState, useRef, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { PeerConnection, MediaState } from '@/components/room/types';

export const useWebRTC = (
  socket: Socket | null,
  localStream: MediaStream | null
) => {
  const [peers, setPeers] = useState<Map<string, PeerConnection>>(new Map());
  const [peerMediaState, setPeerMediaState] = useState<Map<string, MediaState>>(
    new Map()
  );
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());

  // Create a new peer connection
  const createPeerConnection = (userId: string, isInitiator: boolean) => {
    console.log(
      `Creating peer connection for ${userId}, isInitiator: ${isInitiator}`
    );

    // Clean up existing connection if any
    const existingPeer = peersRef.current.get(userId);
    if (existingPeer) {
      console.log(`Cleaning up existing connection for ${userId}`);
      existingPeer.connection.close();
      peersRef.current.delete(userId);
    }

    // Basic STUN configuration
    const connection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // Add local stream tracks to the connection
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        connection.addTrack(track, localStream);
      });
    }

    // Create peer object
    const peer: PeerConnection = {
      id: userId,
      connection,
      isLoading: true,
    };

    // Handle ICE candidates
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit('ice-candidate', {
          to: userId,
          candidate: event.candidate,
        });
      }
    };

    // Log state changes for debugging
    connection.onsignalingstatechange = () => {
      console.log(
        `Signaling state changed for ${userId}:`,
        connection.signalingState
      );
    };

    connection.onconnectionstatechange = () => {
      console.log(
        `Connection state changed for ${userId}:`,
        connection.connectionState
      );
    };

    connection.oniceconnectionstatechange = () => {
      console.log(
        `ICE connection state changed for ${userId}:`,
        connection.iceConnectionState
      );
    };

    // Handle incoming stream
    connection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        peer.stream = event.streams[0];
        peer.isLoading = false;
        peersRef.current.set(userId, peer);
        setPeers(new Map(peersRef.current));
      }
    };

    // If we're the initiator, create and send the offer
    if (isInitiator && socket) {
      console.log(`Creating offer for ${userId}`);
      connection
        .createOffer()
        .then((offer) => {
          console.log(`Setting local description for ${userId}`);
          return connection.setLocalDescription(offer);
        })
        .then(() => {
          console.log(`Sending offer to ${userId}`);
          socket.emit('call-user', {
            to: userId,
            offer: connection.localDescription,
          });
        })
        .catch((error) => {
          console.error('Error creating/sending offer:', error);
        });
    }

    peersRef.current.set(userId, peer);
    setPeers(new Map(peersRef.current));
    return peer;
  };

  useEffect(() => {
    if (!socket || !localStream) return;

    // Handle new user joining
    const handleUserJoined = (userId: string) => {
      console.log('New user joined:', userId);
      createPeerConnection(userId, true);
    };

    // Handle incoming call
    const handleCallUser = (data: {
      from: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      console.log('Received call from:', data.from);
      const peer = createPeerConnection(data.from, false);

      console.log('Setting remote description (offer)...');
      peer.connection
        .setRemoteDescription(new RTCSessionDescription(data.offer))
        .then(() => {
          console.log('Creating answer...');
          return peer.connection.createAnswer();
        })
        .then((answer) => {
          console.log('Setting local description (answer)...');
          return peer.connection.setLocalDescription(answer);
        })
        .then(() => {
          console.log('Sending answer...');
          socket.emit('answer', {
            to: data.from,
            answer: peer.connection.localDescription,
          });
        })
        .catch((error) => {
          console.error('Error in call handling:', error);
          peer.connection.close();
          peersRef.current.delete(data.from);
          setPeers(new Map(peersRef.current));
        });
    };

    // Handle call answer
    const handleAnswerMade = (data: {
      from: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      console.log('Received answer from:', data.from);
      const peer = peersRef.current.get(data.from);

      if (!peer) {
        console.warn('No peer connection found for:', data.from);
        return;
      }

      const { signalingState } = peer.connection;
      console.log(`Current signaling state for ${data.from}:`, signalingState);

      // Only set remote description if we're in have-local-offer state
      if (signalingState === 'have-local-offer') {
        console.log('Setting remote description...');
        peer.connection
          .setRemoteDescription(new RTCSessionDescription(data.answer))
          .then(() => {
            console.log('Remote description set successfully');
          })
          .catch((error) => {
            console.error('Error setting remote description:', error);
            // If there's an error, close and recreate the connection
            peer.connection.close();
            peersRef.current.delete(data.from);
            setPeers(new Map(peersRef.current));
            // Reinitiate the connection
            createPeerConnection(data.from, true);
          });
      } else {
        console.warn(
          `Cannot set remote description in state ${signalingState}. Recreating connection...`
        );
        // Close the existing connection and create a new one
        peer.connection.close();
        peersRef.current.delete(data.from);
        setPeers(new Map(peersRef.current));
        // Reinitiate the connection
        createPeerConnection(data.from, true);
      }
    };

    // Handle ICE candidate
    const handleIceCandidate = (data: {
      from: string;
      candidate: RTCIceCandidateInit;
    }) => {
      const peer = peersRef.current.get(data.from);
      if (!peer) {
        console.warn('No peer connection found for ICE candidate:', data.from);
        return;
      }

      const { signalingState, iceConnectionState } = peer.connection;
      console.log(`Adding ICE candidate for ${data.from}. States:`, {
        signalingState,
        iceConnectionState,
      });

      peer.connection
        .addIceCandidate(new RTCIceCandidate(data.candidate))
        .catch((error) => {
          console.error('Error adding ICE candidate:', error);
          if (error.name === 'OperationError') {
            // If we can't add ICE candidates, the connection might be in a bad state
            console.warn('Connection may be in a bad state, recreating...');
            peer.connection.close();
            peersRef.current.delete(data.from);
            setPeers(new Map(peersRef.current));
            createPeerConnection(data.from, true);
          }
        });
    };

    // Handle user leaving
    const handleUserLeft = (userId: string) => {
      console.log('User left:', userId);
      const peer = peersRef.current.get(userId);
      if (peer) {
        peer.connection.close();
        peersRef.current.delete(userId);
        setPeers(new Map(peersRef.current));
      }
    };

    // Handle media state updates
    const handleMediaStateUpdate = (data: {
      userId: string;
      audioEnabled: boolean;
      videoEnabled: boolean;
    }) => {
      console.log('Received media state update:', data);
      setPeerMediaState((prev) => {
        const next = new Map(prev);
        next.set(data.userId, {
          audioEnabled: data.audioEnabled,
          videoEnabled: data.videoEnabled,
        });
        return next;
      });
    };

    // Handle room data updates
    const handleRoomData = (data: {
      participants: string[];
      mediaState: Record<string, MediaState>;
    }) => {
      console.log('Received room data:', data);
      setPeerMediaState(new Map(Object.entries(data.mediaState)));
    };

    // Register event listeners
    socket.on('user-joined', handleUserJoined);
    socket.on('call-user', handleCallUser);
    socket.on('answer-made', handleAnswerMade);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('user-left', handleUserLeft);
    socket.on('media-state-update', handleMediaStateUpdate);
    socket.on('room-data', handleRoomData);

    // Cleanup
    return () => {
      socket.off('user-joined', handleUserJoined);
      socket.off('call-user', handleCallUser);
      socket.off('answer-made', handleAnswerMade);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('user-left', handleUserLeft);
      socket.off('media-state-update', handleMediaStateUpdate);
      socket.off('room-data', handleRoomData);

      // Close all peer connections
      peersRef.current.forEach((peer) => {
        peer.connection.close();
      });
      peersRef.current.clear();
      setPeers(new Map());
    };
  }, [socket, localStream]);

  return {
    peers,
    peerMediaState,
  };
};
