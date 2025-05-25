import { useState, useRef, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { PeerConnection, MediaState } from '@/components/room/types';
import { SIGNALING_SERVER } from '@/config';

export const useWebRTC = (
  socket: Socket | null,
  localStream: MediaStream | null,
  onParticipantCountChange?: (count: number) => void
) => {
  const [peers, setPeers] = useState<Map<string, PeerConnection>>(new Map());
  const [peerMediaState, setPeerMediaState] = useState<Map<string, MediaState>>(
    new Map()
  );
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());

  // Create a new peer connection
  const createPeerConnection = (userId: string, isInitiator: boolean) => {
    console.log(
      `Creating peer connection with ${userId}, initiator: ${isInitiator}`
    );

    // Check if we already have a connection to this peer
    if (peersRef.current.has(userId)) {
      return peersRef.current.get(userId)!;
    }

    // ICE servers configuration (STUN/TURN)
    const iceServers = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    // Create new RTCPeerConnection
    const connection = new RTCPeerConnection(iceServers);

    // Add local stream tracks to the connection
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        connection.addTrack(track, localStream);
      });
    }

    // Create a new peer object
    const peer: PeerConnection = {
      id: userId,
      connection,
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

    // Handle incoming stream
    connection.ontrack = (event) => {
      console.log(`Got remote track from ${userId}`);

      if (event.streams && event.streams[0]) {
        peer.stream = event.streams[0];
        setPeers(new Map(peersRef.current));
      }
    };

    // Initiator creates and sends offer
    if (isInitiator && socket) {
      connection
        .createOffer()
        .then((offer) => connection.setLocalDescription(offer))
        .then(() => {
          socket.emit('call-user', {
            to: userId,
            offer: connection.localDescription,
          });
        })
        .catch((error) => {
          console.error('Error creating offer:', error);
        });
    }

    // Store the peer connection
    peersRef.current.set(userId, peer);
    setPeers(new Map(peersRef.current));

    return peer;
  };

  // Set up socket event handlers
  useEffect(() => {
    if (!socket || !localStream) return;

    const handleUserJoined = (userId: string) => {
      console.log(`User joined: ${userId}`);
      createPeerConnection(userId, true);
    };

    const handleCallUser = (data: {
      from: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      console.log(`Call from: ${data.from}`);
      const peer = createPeerConnection(data.from, false);

      peer.connection
        .setRemoteDescription(new RTCSessionDescription(data.offer))
        .then(() => peer.connection.createAnswer())
        .then((answer) => peer.connection.setLocalDescription(answer))
        .then(() => {
          socket.emit('answer', {
            to: data.from,
            answer: peer.connection.localDescription,
          });
        })
        .catch((error) => {
          console.error('Error handling offer:', error);
        });
    };

    const handleAnswerMade = (data: {
      from: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      console.log(`Answer from: ${data.from}`);

      const peer = peersRef.current.get(data.from);
      if (peer) {
        peer.connection
          .setRemoteDescription(new RTCSessionDescription(data.answer))
          .catch((error) => {
            console.error('Error setting remote description:', error);
          });
      }
    };

    const handleIceCandidate = (data: {
      from: string;
      candidate: RTCIceCandidateInit;
    }) => {
      console.log(`ICE candidate from: ${data.from}`);

      const peer = peersRef.current.get(data.from);
      if (peer) {
        peer.connection
          .addIceCandidate(new RTCIceCandidate(data.candidate))
          .catch((error) => {
            console.error('Error adding ICE candidate:', error);
          });
      }
    };

    const handleUserLeft = (userId: string) => {
      console.log(`[useWebRTC] User left: ${userId}`);

      const peer = peersRef.current.get(userId);
      if (peer) {
        peer.connection.close();
        peersRef.current.delete(userId);
        setPeers(new Map(peersRef.current));

        // Update participant count after peer removal
        if (onParticipantCountChange) {
          const newCount = peersRef.current.size;
          console.log('[useWebRTC] Updating count after user left:', newCount);
          onParticipantCountChange(newCount);
        }
      }
    };

    const handleRoomData = (data: {
      participants: string[];
      mediaState: Record<string, MediaState>;
    }) => {
      console.log('[useWebRTC] Room data update:', data);
      const newMediaState = new Map(Object.entries(data.mediaState));
      setPeerMediaState(newMediaState);

      // Update participant count
      if (onParticipantCountChange) {
        console.log(
          '[useWebRTC] Updating count from room data:',
          data.participants.length
        );
        onParticipantCountChange(data.participants.length);
      }
    };

    const handleMediaStateUpdate = (data: {
      userId: string;
      audioEnabled: boolean;
      videoEnabled: boolean;
    }) => {
      console.log('Media state update:', data);
      setPeerMediaState((prev) => {
        const next = new Map(prev);
        next.set(data.userId, {
          audioEnabled: data.audioEnabled,
          videoEnabled: data.videoEnabled,
        });
        return next;
      });
    };

    // Register event listeners
    socket.on('user-joined', handleUserJoined);
    socket.on('call-user', handleCallUser);
    socket.on('answer-made', handleAnswerMade);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('user-left', handleUserLeft);
    socket.on('room-data', handleRoomData);
    socket.on('media-state-update', handleMediaStateUpdate);

    // Clean up
    return () => {
      socket.off('user-joined', handleUserJoined);
      socket.off('call-user', handleCallUser);
      socket.off('answer-made', handleAnswerMade);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('user-left', handleUserLeft);
      socket.off('room-data', handleRoomData);
      socket.off('media-state-update', handleMediaStateUpdate);

      // Close all peer connections
      peersRef.current.forEach((peer) => {
        peer.connection.close();
      });
    };
  }, [socket, localStream, onParticipantCountChange]);

  return {
    peers,
    peerMediaState,
  };
};
