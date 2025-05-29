import { useState, useRef, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { PeerConnection, MediaState } from '@/components/room/types';

// Configuration for production-ready WebRTC
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

const CONNECTION_TIMEOUT = 30000; // 30 seconds timeout for connection establishment

export const useWebRTC = (
  socket: Socket | null,
  localStream: MediaStream | null
) => {
  const [peers, setPeers] = useState<Map<string, PeerConnection>>(new Map());
  const [peerMediaState, setPeerMediaState] = useState<Map<string, MediaState>>(
    new Map()
  );
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const iceCandidatesQueue = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map()
  );

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

    // Create connection with ICE servers
    const connection = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceTransportPolicy: 'all',
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

    // Set connection timeout
    const timeoutId = setTimeout(() => {
      if (peer.isLoading) {
        console.warn(`Connection timeout for peer ${userId}`);
        connection.close();
        peersRef.current.delete(userId);
        setPeers(new Map(peersRef.current));
      }
    }, CONNECTION_TIMEOUT);

    // Handle ICE candidates
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit('ice-candidate', {
          to: userId,
          candidate: event.candidate,
        });
      }
    };

    // Connection state monitoring
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

      // Handle failed connections
      if (connection.connectionState === 'failed') {
        console.warn(`Connection failed for ${userId}, recreating...`);
        connection.close();
        peersRef.current.delete(userId);
        setPeers(new Map(peersRef.current));
        createPeerConnection(userId, true);
      }
    };

    connection.oniceconnectionstatechange = () => {
      console.log(
        `ICE connection state changed for ${userId}:`,
        connection.iceConnectionState
      );

      // Handle disconnected state
      if (connection.iceConnectionState === 'disconnected') {
        console.warn(`ICE connection disconnected for ${userId}`);
        // Wait briefly for potential recovery
        setTimeout(() => {
          if (connection.iceConnectionState === 'disconnected') {
            connection.close();
            peersRef.current.delete(userId);
            setPeers(new Map(peersRef.current));
            createPeerConnection(userId, true);
          }
        }, 5000);
      }
    };

    // Handle incoming stream
    connection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        peer.stream = event.streams[0];
        peer.isLoading = false;
        clearTimeout(timeoutId); // Clear timeout when connection is established
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
          connection.close();
          peersRef.current.delete(userId);
          setPeers(new Map(peersRef.current));
        });
    }

    peersRef.current.set(userId, peer);
    setPeers(new Map(peersRef.current));
    return peer;
  };

  // Function to process queued ICE candidates
  const processIceCandidateQueue = (userId: string) => {
    const queuedCandidates = iceCandidatesQueue.current.get(userId) || [];
    const peer = peersRef.current.get(userId);

    if (peer && queuedCandidates.length > 0) {
      console.log(
        `Processing ${queuedCandidates.length} queued candidates for ${userId}`
      );
      queuedCandidates.forEach((candidate) => {
        peer.connection
          .addIceCandidate(new RTCIceCandidate(candidate))
          .catch((error) => {
            console.warn('Error adding queued ICE candidate:', error);
          });
      });
      iceCandidatesQueue.current.delete(userId);
    }
  };

  useEffect(() => {
    if (!socket || !localStream) return;

    // Handle new user joining
    const handleUserJoined = (userId: string) => {
      console.log('New user joined:', userId);
      createPeerConnection(userId, true);
    };

    // Handle incoming call
    const handleCallUser = async (data: {
      from: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      console.log('Received call from:', data.from);
      const peer = createPeerConnection(data.from, false);

      try {
        console.log('Setting remote description (offer)...');
        await peer.connection.setRemoteDescription(
          new RTCSessionDescription(data.offer)
        );

        // Process any queued candidates after setting remote description
        processIceCandidateQueue(data.from);

        console.log('Creating answer...');
        const answer = await peer.connection.createAnswer();

        console.log('Setting local description (answer)...');
        await peer.connection.setLocalDescription(answer);

        console.log('Sending answer...');
        socket.emit('answer', {
          to: data.from,
          answer: peer.connection.localDescription,
        });
      } catch (error) {
        console.error('Error in call handling:', error);
        peer.connection.close();
        peersRef.current.delete(data.from);
        setPeers(new Map(peersRef.current));
      }
    };

    // Handle call answer
    const handleAnswerMade = async (data: {
      from: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      console.log('Received answer from:', data.from);
      const peer = peersRef.current.get(data.from);

      if (!peer) {
        console.warn('No peer connection found for:', data.from);
        return;
      }

      try {
        await peer.connection.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
        // Process any queued candidates after setting remote description
        processIceCandidateQueue(data.from);
      } catch (error) {
        console.error('Error setting remote description:', error);
        peer.connection.close();
        peersRef.current.delete(data.from);
        setPeers(new Map(peersRef.current));
      }
    };

    // Handle ICE candidate
    const handleIceCandidate = (data: {
      from: string;
      candidate: RTCIceCandidateInit;
    }) => {
      const peer = peersRef.current.get(data.from);

      // Queue the candidate if we don't have a peer yet or remote description isn't set
      if (!peer || !peer.connection.remoteDescription) {
        console.log(`Queueing ICE candidate for ${data.from}`);
        const queue = iceCandidatesQueue.current.get(data.from) || [];
        queue.push(data.candidate);
        iceCandidatesQueue.current.set(data.from, queue);
        return;
      }

      // Add the candidate if we're ready
      peer.connection
        .addIceCandidate(new RTCIceCandidate(data.candidate))
        .catch((error) => {
          console.error('Error adding ICE candidate:', error);
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

      // Clear all timeouts and close connections
      peersRef.current.forEach((peer) => {
        peer.connection.close();
      });
      peersRef.current.clear();
      setPeers(new Map());
      iceCandidatesQueue.current.clear();
    };
  }, [socket, localStream]);

  return {
    peers,
    peerMediaState,
  };
};
