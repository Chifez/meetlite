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
  localStream: MediaStream | null
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
        console.log(`Cleaning up connection ${connectionId}`);

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
      console.log(
        `Waiting for descriptions before processing candidates for ${connectionId}`
      );
      return;
    }

    console.log(
      `Processing ${queuedCandidates.length} queued candidates for ${connectionId}`
    );

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
        console.log(`Already processing connection ${connectionId}`);
        return peersRef.current.get(connectionId) || null;
      }

      isProcessingRef.current.add(connectionId);

      console.log(
        `Creating peer connection ${connectionId}, isInitiator: ${isInitiator}`
      );

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

      // Connection state monitoring
      connection.onconnectionstatechange = () => {
        const currentPeer = peersRef.current.get(connectionId);
        if (!currentPeer) return;

        console.log(
          `Connection state changed for ${connectionId}:`,
          connection.connectionState
        );

        if (connection.connectionState === 'connected') {
          currentPeer.isLoading = false;
          currentPeer.signalState = ConnectionState.CONNECTED;
          if (currentPeer.timeoutId) {
            clearTimeout(currentPeer.timeoutId);
            currentPeer.timeoutId = undefined;
          }
          updatePeersState();
        } else if (connection.connectionState === 'failed') {
          console.warn(`Connection failed for ${connectionId}`);
          cleanupPeerConnection(connectionId);

          // Retry connection after delay
          setTimeout(() => {
            if (!peersRef.current.has(connectionId) && socket && socket.id) {
              console.log(`Retrying connection for ${userId}`);
              createPeerConnection(userId, true);
            }
          }, RECONNECTION_DELAY);
        }
      };

      // Handle incoming stream
      connection.ontrack = (event) => {
        console.log(`Received track for ${connectionId}`);
        if (event.streams && event.streams[0]) {
          const currentPeer = peersRef.current.get(connectionId);
          if (currentPeer) {
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
        peer.signalState = ConnectionState.CREATING_OFFER;
        connection
          .createOffer()
          .then((offer) => {
            if (!peersRef.current.has(connectionId)) {
              throw new Error('Connection was closed during offer creation');
            }

            console.log(`Setting local description for ${connectionId}`);
            return connection.setLocalDescription(offer);
          })
          .then(() => {
            const currentPeer = peersRef.current.get(connectionId);
            if (!currentPeer || !socket) {
              throw new Error('Connection or socket not available');
            }

            currentPeer.signalState = ConnectionState.OFFER_SENT;
            console.log(`Sending offer to ${userId}`);
            socket.emit('call-user', {
              to: userId,
              offer: connection.localDescription,
            });
          })
          .catch((error) => {
            console.error(
              `Error creating/sending offer for ${connectionId}:`,
              error
            );
            cleanupPeerConnection(connectionId);
          })
          .finally(() => {
            isProcessingRef.current.delete(connectionId);
          });
      } else {
        isProcessingRef.current.delete(connectionId);
      }

      return peer;
    },
    [socket, localStream, cleanupPeerConnection, updatePeersState]
  );

  // Effect to handle socket events
  useEffect(() => {
    if (!socket || !socket.id) return;

    // Handle call from another user
    const handleCallUser = async (data: {
      from: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      console.log('Received call from:', data.from);
      const peer = createPeerConnection(data.from, false);
      if (!peer) return;

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
      console.log('Received answer from:', data.from);

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
        console.log(`Queueing ICE candidate for ${connectionId}`);
        const queue = iceCandidatesQueue.current.get(connectionId) || [];
        queue.push(data.candidate);
        iceCandidatesQueue.current.set(connectionId, queue);
        return;
      }

      if (
        !peer.connection.localDescription ||
        !peer.connection.remoteDescription
      ) {
        console.log(`Queueing ICE candidate (waiting for descriptions)`);
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
      const connectionId = createConnectionId(socket.id, userId);
      console.log('User left, cleaning up connection:', connectionId);
      cleanupPeerConnection(connectionId);
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
    }) => {
      setPeerMediaState(new Map(Object.entries(data.mediaState)));
    };

    // Register event listeners
    socket.on('call-user', handleCallUser);
    socket.on('answer-made', handleAnswerMade);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('user-left', handleUserLeft);
    socket.on('media-state-update', handleMediaStateUpdate);
    socket.on('room-data', handleRoomData);
    socket.on('initiate-connection', ({ targetUserId, isInitiator }) => {
      console.log(
        `Initiating connection with ${targetUserId}, isInitiator: ${isInitiator}`
      );
      if (isInitiator) {
        createPeerConnection(targetUserId, true);
      }
    });

    // Cleanup
    return () => {
      socket.off('call-user', handleCallUser);
      socket.off('answer-made', handleAnswerMade);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('user-left', handleUserLeft);
      socket.off('media-state-update', handleMediaStateUpdate);
      socket.off('room-data', handleRoomData);
      socket.off('initiate-connection');

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
