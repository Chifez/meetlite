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
        `🚀 [WebRTC] Creating peer connection ${connectionId}, isInitiator: ${isInitiator}`
      );

      // Clean up existing connection
      cleanupPeerConnection(connectionId);

      // Create new RTCPeerConnection
      const connection = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        iceTransportPolicy: 'all',
      });

      console.log(`🔧 [WebRTC] RTCPeerConnection created for ${connectionId}`);

      // Add local stream tracks
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          console.log(
            `📹 [WebRTC] Adding track ${track.kind} to ${connectionId}`
          );
          connection.addTrack(track, localStream);
        });
      } else {
        console.warn(
          `⚠️ [WebRTC] No local stream available for ${connectionId}`
        );
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
          console.warn(`⏰ [WebRTC] Connection timeout for ${connectionId}`);
          cleanupPeerConnection(connectionId);
        }
      }, CONNECTION_TIMEOUT);

      // Handle ICE candidates
      connection.onicecandidate = (event) => {
        if (event.candidate && socket) {
          console.log(
            `🧊 [WebRTC] Sending ICE candidate for ${connectionId}:`,
            event.candidate.candidate
          );
          socket.emit('ice-candidate', {
            to: userId,
            candidate: event.candidate,
          });
        } else if (!event.candidate) {
          console.log(`🧊 [WebRTC] ICE gathering complete for ${connectionId}`);
        }
      };

      // ICE gathering state monitoring
      connection.onicegatheringstatechange = () => {
        console.log(
          `🧊 [WebRTC] ICE gathering state for ${connectionId}:`,
          connection.iceGatheringState
        );
      };

      // ICE connection state monitoring
      connection.oniceconnectionstatechange = () => {
        console.log(
          `🔗 [WebRTC] ICE connection state for ${connectionId}:`,
          connection.iceConnectionState
        );
      };

      // Connection state monitoring
      connection.onconnectionstatechange = () => {
        const currentPeer = peersRef.current.get(connectionId);
        if (!currentPeer) return;

        console.log(
          `🔄 [WebRTC] Connection state changed for ${connectionId}:`,
          connection.connectionState
        );

        if (connection.connectionState === 'connected') {
          console.log(`✅ [WebRTC] Connection established for ${connectionId}`);
          currentPeer.isLoading = false;
          currentPeer.signalState = ConnectionState.CONNECTED;
          if (currentPeer.timeoutId) {
            clearTimeout(currentPeer.timeoutId);
            currentPeer.timeoutId = undefined;
          }
          updatePeersState();
        } else if (connection.connectionState === 'failed') {
          console.error(`❌ [WebRTC] Connection failed for ${connectionId}`);
          cleanupPeerConnection(connectionId);

          // Retry connection after delay
          setTimeout(() => {
            if (!peersRef.current.has(connectionId) && socket && socket.id) {
              console.log(`🔄 [WebRTC] Retrying connection for ${userId}`);
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
    if (!socket || !socket.id) return;

    // Handle call from another user
    const handleCallUser = async (data: {
      from: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      console.log('📞 [WebRTC] Received call from:', data.from);
      console.log('📞 [WebRTC] Offer type:', data.offer.type);
      const peer = createPeerConnection(data.from, false);
      if (!peer) {
        console.error(
          '❌ [WebRTC] Failed to create peer connection for incoming call'
        );
        return;
      }

      try {
        console.log(
          `📞 [WebRTC] Setting remote description for ${peer.connectionId}`
        );
        await peer.connection.setRemoteDescription(
          new RTCSessionDescription(data.offer)
        );
        console.log(
          `✅ [WebRTC] Remote description set successfully for ${peer.connectionId}`
        );

        peer.signalState = ConnectionState.CREATING_OFFER;

        console.log(
          `📞 [WebRTC] Processing queued ICE candidates for ${peer.connectionId}`
        );
        await processIceCandidateQueue(peer.connectionId);

        console.log(`📞 [WebRTC] Creating answer for ${peer.connectionId}`);
        const answer = await peer.connection.createAnswer();
        console.log(
          `📞 [WebRTC] Answer created for ${peer.connectionId}:`,
          answer.type
        );

        console.log(
          `📞 [WebRTC] Setting local description (answer) for ${peer.connectionId}`
        );
        await peer.connection.setLocalDescription(answer);
        console.log(
          `✅ [WebRTC] Local description (answer) set for ${peer.connectionId}`
        );

        peer.signalState = ConnectionState.ANSWER_SENT;

        console.log(`📞 [WebRTC] Sending answer to ${data.from}`);
        socket.emit('make-answer', {
          to: data.from,
          answer: peer.connection.localDescription,
        });
      } catch (error) {
        console.error('❌ [WebRTC] Error handling call:', error);
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
      console.log('📞 [WebRTC] Received answer from:', data.from);
      console.log('📞 [WebRTC] Answer type:', data.answer.type);

      const peer = peersRef.current.get(connectionId);
      if (!peer) {
        console.warn(
          `⚠️ [WebRTC] No peer connection found for: ${connectionId}`
        );
        return;
      }

      if (peer.signalState !== ConnectionState.OFFER_SENT) {
        console.warn(
          `⚠️ [WebRTC] Received answer in wrong state (${peer.signalState}) for ${connectionId}`
        );
        return;
      }

      try {
        console.log(
          `📞 [WebRTC] Setting remote description (answer) for ${connectionId}`
        );
        await peer.connection.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
        console.log(
          `✅ [WebRTC] Remote description (answer) set successfully for ${connectionId}`
        );

        peer.signalState = ConnectionState.ANSWER_RECEIVED;

        console.log(
          `📞 [WebRTC] Processing queued ICE candidates for ${connectionId}`
        );
        await processIceCandidateQueue(connectionId);
      } catch (error) {
        console.error('❌ [WebRTC] Error setting remote description:', error);
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

      console.log(
        `🧊 [WebRTC] Received ICE candidate from ${data.from}:`,
        data.candidate.candidate
      );

      if (!peer) {
        console.log(
          `🧊 [WebRTC] Queueing ICE candidate for ${connectionId} (no peer yet)`
        );
        const queue = iceCandidatesQueue.current.get(connectionId) || [];
        queue.push(data.candidate);
        iceCandidatesQueue.current.set(connectionId, queue);
        return;
      }

      if (
        !peer.connection.localDescription ||
        !peer.connection.remoteDescription
      ) {
        console.log(
          `🧊 [WebRTC] Queueing ICE candidate for ${connectionId} (waiting for descriptions)`
        );
        const queue = iceCandidatesQueue.current.get(connectionId) || [];
        queue.push(data.candidate);
        iceCandidatesQueue.current.set(connectionId, queue);
        return;
      }

      try {
        console.log(
          `🧊 [WebRTC] Adding ICE candidate immediately for ${connectionId}`
        );
        await peer.connection.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
        console.log(
          `✅ [WebRTC] ICE candidate added successfully for ${connectionId}`
        );
      } catch (error) {
        console.error('❌ [WebRTC] Error adding ICE candidate:', error);
      }
    };

    // Handle user left
    const handleUserLeft = (userId: string) => {
      if (!socket.id) return;
      const connectionId = createConnectionId(socket.id, userId);
      console.log(
        '👋 [WebRTC] User left, cleaning up connection:',
        connectionId
      );
      cleanupPeerConnection(connectionId);
    };

    // Handle media state updates
    const handleMediaStateUpdate = (data: {
      userId: string;
      audioEnabled: boolean;
      videoEnabled: boolean;
    }) => {
      console.log('🎙️ [WebRTC] Media state update:', data);
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
      console.log('🏠 [WebRTC] Room data received:', data);
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
        `🚀 [WebRTC] Initiating connection with ${targetUserId}, isInitiator: ${isInitiator}`
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
