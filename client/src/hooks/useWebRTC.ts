import { useState, useRef, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { PeerConnection, MediaState } from '@/components/room/types';

// Configuration for production-ready WebRTC
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  // Free TURN servers for testing - replace with your own for production
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

const CONNECTION_TIMEOUT = 30000;
const RECONNECTION_DELAY = 5000;

// Helper to create a unique connection ID for each peer-to-peer connection
const createConnectionId = (localId: string, remoteId: string) => {
  return [localId, remoteId].sort().join('_');
};

// Connection states to track signaling flow
enum ConnectionState {
  INITIALIZING = 'initializing',
  CREATING_OFFER = 'creating_offer',
  OFFER_SENT = 'offer_sent',
  ANSWER_RECEIVED = 'answer_received',
  ANSWER_SENT = 'answer_sent',
  CONNECTED = 'connected',
  FAILED = 'failed',
  CLOSED = 'closed',
}

interface ExtendedPeerConnection extends PeerConnection {
  connectionId: string;
  signalState: ConnectionState;
  timeoutId?: NodeJS.Timeout;
  isInitiator: boolean;
}

export const useWebRTC = (
  socket: Socket | null,
  localStream: MediaStream | null,
  onParticipantInfoUpdate?: (
    info: Record<string, { email: string; userId: string }>
  ) => void
) => {
  const [peers, setPeers] = useState<Map<string, PeerConnection>>(new Map());
  const [peerMediaState, setPeerMediaState] = useState<Map<string, MediaState>>(
    new Map()
  );

  // Use refs to avoid stale closures and ensure we always have current state
  const peersRef = useRef<Map<string, ExtendedPeerConnection>>(new Map());
  const iceCandidatesQueue = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map()
  );
  const isProcessingRef = useRef<Set<string>>(new Set());

  // Utility function to safely update peers state
  const updatePeersState = useCallback(() => {
    const peerMap = new Map<string, PeerConnection>();
    peersRef.current.forEach((peer, connectionId) => {
      peerMap.set(connectionId, {
        id: peer.id,
        connection: peer.connection,
        stream: peer.stream,
        isLoading: peer.isLoading,
      });
    });
    setPeers(peerMap);
  }, []);

  // Clean up a peer connection completely
  const cleanupPeerConnection = useCallback(
    (connectionId: string) => {
      const peer = peersRef.current.get(connectionId);
      if (peer) {
        // Clear timeout
        if (peer.timeoutId) {
          clearTimeout(peer.timeoutId);
        }

        // Close connection
        if (peer.connection.connectionState !== 'closed') {
          peer.connection.close();
        }

        // Remove from maps
        peersRef.current.delete(connectionId);
        iceCandidatesQueue.current.delete(connectionId);
        isProcessingRef.current.delete(connectionId);

        updatePeersState();
      }
    },
    [updatePeersState]
  );

  // Process queued ICE candidates with proper error handling
  const processIceCandidateQueue = useCallback(async (connectionId: string) => {
    const peer = peersRef.current.get(connectionId);
    const queuedCandidates = iceCandidatesQueue.current.get(connectionId) || [];

    if (!peer || queuedCandidates.length === 0) return;

    // Only process if we have both local and remote descriptions
    if (
      !peer.connection.localDescription ||
      !peer.connection.remoteDescription
    ) {
      return;
    }

    // Process candidates one by one with error handling
    for (const candidate of queuedCandidates) {
      try {
        await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn(
          `Error adding queued ICE candidate for ${connectionId}:`,
          error
        );
      }
    }

    // Clear the queue after processing
    iceCandidatesQueue.current.delete(connectionId);
  }, []);

  // Create a new peer connection with improved state management
  const createPeerConnection = useCallback(
    (userId: string, isInitiator: boolean) => {
      if (!socket || !socket.id) {
        console.warn('Socket not available for peer connection');
        return null;
      }

      const connectionId = createConnectionId(socket.id, userId);

      // Prevent concurrent creation of the same connection
      if (isProcessingRef.current.has(connectionId)) {
        return peersRef.current.get(connectionId) || null;
      }

      isProcessingRef.current.add(connectionId);

      // Clean up existing connection
      cleanupPeerConnection(connectionId);

      // Create new RTCPeerConnection
      const connection = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        iceTransportPolicy: 'all',
      });

      // Add local stream tracks
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          connection.addTrack(track, localStream);
        });
      } else {
        console.warn(`No local stream available for ${connectionId}`);
      }

      // Create extended peer object
      const peer: ExtendedPeerConnection = {
        id: userId,
        connection,
        isLoading: true,
        connectionId,
        signalState: ConnectionState.INITIALIZING,
        isInitiator,
      };

      // Set connection timeout
      peer.timeoutId = setTimeout(() => {
        if (peer.isLoading && peersRef.current.has(connectionId)) {
          console.warn(`Connection timeout for ${connectionId}`);
          cleanupPeerConnection(connectionId);
        }
      }, CONNECTION_TIMEOUT);

      // Handle ICE candidates
      connection.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('ice-candidate', {
            to: userId,
            candidate: event.candidate,
          });
        }
      };

      // ICE gathering state monitoring
      connection.onicegatheringstatechange = () => {
        // ICE gathering state changed
      };

      // ICE connection state monitoring
      connection.oniceconnectionstatechange = () => {
        // ICE connection state changed
      };

      // Connection state monitoring
      connection.onconnectionstatechange = () => {
        const currentPeer = peersRef.current.get(connectionId);
        if (!currentPeer) return;

        if (connection.connectionState === 'connected') {
          currentPeer.isLoading = false;
          currentPeer.signalState = ConnectionState.CONNECTED;
          if (currentPeer.timeoutId) {
            clearTimeout(currentPeer.timeoutId);
            currentPeer.timeoutId = undefined;
          }
          updatePeersState();
        } else if (connection.connectionState === 'failed') {
          console.error(`Connection failed for ${connectionId}`);
          cleanupPeerConnection(connectionId);

          // Retry connection after delay
          setTimeout(() => {
            if (!peersRef.current.has(connectionId) && socket && socket.id) {
              createPeerConnection(userId, true);
            }
          }, RECONNECTION_DELAY);
        }
      };

      // Handle incoming stream
      connection.ontrack = (event) => {
        console.log(
          `📺 [WebRTC] Received track for ${connectionId}`,
          event.track.kind
        );
        if (event.streams && event.streams[0]) {
          const currentPeer = peersRef.current.get(connectionId);
          if (currentPeer) {
            console.log(`📺 [WebRTC] Setting stream for ${connectionId}`);
            currentPeer.stream = event.streams[0];
            currentPeer.isLoading = false;
            if (currentPeer.timeoutId) {
              clearTimeout(currentPeer.timeoutId);
              currentPeer.timeoutId = undefined;
            }
            updatePeersState();
          }
        }
      };

      // Store peer
      peersRef.current.set(connectionId, peer);
      updatePeersState();

      // Create offer if we're the initiator
      if (isInitiator) {
        console.log(`📞 [WebRTC] Creating offer for ${connectionId}`);
        peer.signalState = ConnectionState.CREATING_OFFER;
        connection
          .createOffer()
          .then((offer) => {
            if (!peersRef.current.has(connectionId)) {
              throw new Error('Connection was closed during offer creation');
            }

            console.log(
              `📞 [WebRTC] Offer created for ${connectionId}:`,
              offer.type
            );
            console.log(
              `📞 [WebRTC] Setting local description for ${connectionId}`
            );
            return connection.setLocalDescription(offer);
          })
          .then(() => {
            const currentPeer = peersRef.current.get(connectionId);
            if (!currentPeer || !socket) {
              throw new Error('Connection or socket not available');
            }

            console.log(
              `📞 [WebRTC] Local description set for ${connectionId}`
            );
            currentPeer.signalState = ConnectionState.OFFER_SENT;
            console.log(`📞 [WebRTC] Sending offer to ${userId}`);
            socket.emit('call-user', {
              to: userId,
              offer: connection.localDescription,
            });
          })
          .catch((error) => {
            console.error(
              `❌ [WebRTC] Error creating/sending offer for ${connectionId}:`,
              error
            );
            cleanupPeerConnection(connectionId);
          })
          .finally(() => {
            isProcessingRef.current.delete(connectionId);
          });
      } else {
        console.log(
          `👂 [WebRTC] Waiting for incoming call for ${connectionId}`
        );
        isProcessingRef.current.delete(connectionId);
      }

      return peer;
    },
    [socket, localStream, cleanupPeerConnection, updatePeersState]
  );

  // Effect to handle socket events
  useEffect(() => {
    if (!socket || !socket.id) {
      console.log(
        '⚠️ [WebRTC] Socket not ready, skipping event listener setup'
      );
      return;
    }

    // Handle call from another user
    const handleCallUser = async (data: {
      from: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      const peer = createPeerConnection(data.from, false);
      if (!peer) {
        console.error('Failed to create peer connection for incoming call');
        return;
      }

      try {
        await peer.connection.setRemoteDescription(
          new RTCSessionDescription(data.offer)
        );

        peer.signalState = ConnectionState.CREATING_OFFER;

        await processIceCandidateQueue(peer.connectionId);

        const answer = await peer.connection.createAnswer();

        await peer.connection.setLocalDescription(answer);

        peer.signalState = ConnectionState.ANSWER_SENT;

        socket.emit('make-answer', {
          to: data.from,
          answer: peer.connection.localDescription,
        });
      } catch (error) {
        console.error('Error handling call:', error);
        if (peer.connectionId) {
          cleanupPeerConnection(peer.connectionId);
        }
      }
    };

    // Handle answer from called user
    const handleAnswerMade = async (data: {
      from: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      if (!socket.id) return;
      const connectionId = createConnectionId(socket.id, data.from);

      const peer = peersRef.current.get(connectionId);
      if (!peer) {
        console.warn(`No peer connection found for: ${connectionId}`);
        return;
      }

      if (peer.signalState !== ConnectionState.OFFER_SENT) {
        console.warn(
          `Received answer in wrong state (${peer.signalState}) for ${connectionId}`
        );
        return;
      }

      try {
        await peer.connection.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );

        peer.signalState = ConnectionState.ANSWER_RECEIVED;

        await processIceCandidateQueue(connectionId);
      } catch (error) {
        console.error('Error setting remote description:', error);
        cleanupPeerConnection(connectionId);
      }
    };

    // Handle ICE candidate
    const handleIceCandidate = async (data: {
      from: string;
      candidate: RTCIceCandidateInit;
    }) => {
      if (!socket.id) return;
      const connectionId = createConnectionId(socket.id, data.from);
      const peer = peersRef.current.get(connectionId);

      if (!peer) {
        const queue = iceCandidatesQueue.current.get(connectionId) || [];
        queue.push(data.candidate);
        iceCandidatesQueue.current.set(connectionId, queue);
        return;
      }

      if (
        !peer.connection.localDescription ||
        !peer.connection.remoteDescription
      ) {
        const queue = iceCandidatesQueue.current.get(connectionId) || [];
        queue.push(data.candidate);
        iceCandidatesQueue.current.set(connectionId, queue);
        return;
      }

      try {
        await peer.connection.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    };

    // Handle user left
    const handleUserLeft = (userId: string) => {
      if (!socket.id) return;
      cleanupPeerConnection(createConnectionId(socket.id, userId));
    };

    // Handle media state updates
    const handleMediaStateUpdate = (data: {
      userId: string;
      audioEnabled: boolean;
      videoEnabled: boolean;
    }) => {
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
      participantInfo?: Record<string, { email: string; userId: string }>;
    }) => {
      setPeerMediaState(new Map(Object.entries(data.mediaState)));

      // Update participant info if provided
      if (data.participantInfo && onParticipantInfoUpdate) {
        onParticipantInfoUpdate(data.participantInfo);
      }
    };

    // Handle initiate connection
    const handleInitiateConnection = ({
      targetUserId,
      isInitiator,
    }: {
      targetUserId: string;
      isInitiator: boolean;
    }) => {
      if (isInitiator) {
        createPeerConnection(targetUserId, true);
      }
    };

    // Register event listeners
    console.log(`🎧 [WebRTC] Registering event listeners...`);

    // Add a generic listener to catch all events for debugging
    const handleAnyEvent = (eventName: string, ...args: any[]) => {
      console.log(`📡 [WebRTC] Received socket event: ${eventName}`, args);
    };
    socket.onAny(handleAnyEvent);

    socket.on('call-user', handleCallUser);
    socket.on('answer-made', handleAnswerMade);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('user-left', handleUserLeft);
    socket.on('media-state-update', handleMediaStateUpdate);
    socket.on('room-data', handleRoomData);
    socket.on('initiate-connection', handleInitiateConnection);

    // Cleanup
    return () => {
      console.log(
        `🧹 [WebRTC] Cleaning up event listeners for socket ${socket.id}`
      );
      // socket.offAny(handleAnyEvent);
      socket.off('call-user', handleCallUser);
      socket.off('answer-made', handleAnswerMade);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('user-left', handleUserLeft);
      socket.off('media-state-update', handleMediaStateUpdate);
      socket.off('room-data', handleRoomData);
      socket.off('initiate-connection', handleInitiateConnection);

      // Clean up all connections
      peersRef.current.forEach((peer) => {
        if (peer.timeoutId) {
          clearTimeout(peer.timeoutId);
        }
        if (peer.connection.connectionState !== 'closed') {
          peer.connection.close();
        }
      });

      peersRef.current.clear();
      iceCandidatesQueue.current.clear();
      isProcessingRef.current.clear();
      setPeers(new Map());
      setPeerMediaState(new Map());
    };
  }, [
    socket,
    createPeerConnection,
    cleanupPeerConnection,
    processIceCandidateQueue,
  ]);

  return {
    peers,
    peerMediaState,
  };
};
