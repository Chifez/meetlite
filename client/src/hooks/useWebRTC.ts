// import { useState, useRef, useEffect } from 'react';
// import { Socket } from 'socket.io-client';
// import { PeerConnection, MediaState } from '@/components/room/types';

// // Configuration for production-ready WebRTC
// const ICE_SERVERS = [
//   { urls: 'stun:stun.l.google.com:19302' },
//   { urls: 'stun:stun1.l.google.com:19302' },
//   { urls: 'stun:stun2.l.google.com:19302' },
//   { urls: 'stun:stun3.l.google.com:19302' },
//   { urls: 'stun:stun4.l.google.com:19302' },
// ];

// const CONNECTION_TIMEOUT = 30000; // 30 seconds timeout for connection establishment

// // Helper to create a unique connection ID for each peer-to-peer connection
// const createConnectionId = (localId: string, remoteId: string) => {
//   return [localId, remoteId].sort().join('_');
// };

// export const useWebRTC = (
//   socket: Socket | null,
//   localStream: MediaStream | null
// ) => {
//   const [peers, setPeers] = useState<Map<string, PeerConnection>>(new Map());
//   const [peerMediaState, setPeerMediaState] = useState<Map<string, MediaState>>(
//     new Map()
//   );
//   const peersRef = useRef<Map<string, PeerConnection>>(new Map());
//   const iceCandidatesQueue = useRef<Map<string, RTCIceCandidateInit[]>>(
//     new Map()
//   );

//   // Create a new peer connection
//   const createPeerConnection = (userId: string, isInitiator: boolean) => {
//     if (!socket || !socket.id) return null;

//     // Create a unique connection ID for this peer connection
//     const connectionId = createConnectionId(socket.id, userId);

//     console.log(
//       `Creating peer connection ${connectionId}, isInitiator: ${isInitiator}`
//     );

//     // Clean up existing connection if any
//     const existingPeer = peersRef.current.get(connectionId);
//     if (existingPeer) {
//       console.log(`Cleaning up existing connection ${connectionId}`);
//       existingPeer.connection.close();
//       peersRef.current.delete(connectionId);
//     }

//     // Create connection with ICE servers
//     const connection = new RTCPeerConnection({
//       iceServers: ICE_SERVERS,
//       iceTransportPolicy: 'all',
//     });

//     // Add local stream tracks to the connection
//     if (localStream) {
//       localStream.getTracks().forEach((track) => {
//         connection.addTrack(track, localStream);
//       });
//     }

//     // Create peer object
//     const peer: PeerConnection = {
//       id: userId,
//       connection,
//       isLoading: true,
//     };

//     const checkAndUpdateLoadingState = () => {
//       if (
//         peer.isLoading &&
//         connection.connectionState === 'connected' &&
//         connection.iceConnectionState === 'connected'
//       ) {
//         peer.isLoading = false;
//         clearTimeout(timeoutId);
//         peersRef.current.set(connectionId, peer);
//         setPeers(new Map(peersRef.current));
//       }
//     };

//     // Set connection timeout
//     const timeoutId = setTimeout(() => {
//       if (peer.isLoading) {
//         console.warn(`Connection timeout for ${connectionId}`);
//         connection.close();
//         peersRef.current.delete(connectionId);
//         setPeers(new Map(peersRef.current));
//       }
//     }, CONNECTION_TIMEOUT);

//     // Handle ICE candidates
//     connection.onicecandidate = (event) => {
//       if (event.candidate) {
//         socket?.emit('ice-candidate', {
//           to: userId,
//           candidate: event.candidate,
//         });
//       }
//     };

//     // Connection state monitoring
//     connection.onsignalingstatechange = () => {
//       console.log(
//         `Signaling state changed for ${connectionId}:`,
//         connection.signalingState
//       );
//     };

//     connection.onconnectionstatechange = () => {
//       console.log(
//         `Connection state changed for ${connectionId}:`,
//         connection.connectionState
//       );

//       checkAndUpdateLoadingState();

//       // Handle failed connections
//       if (connection.connectionState === 'failed') {
//         console.warn(`Connection failed for ${connectionId}, recreating...`);
//         connection.close();
//         peersRef.current.delete(connectionId);
//         setPeers(new Map(peersRef.current));
//         createPeerConnection(userId, true);
//       }
//     };

//     connection.oniceconnectionstatechange = () => {
//       console.log(
//         `ICE connection state changed for ${connectionId}:`,
//         connection.iceConnectionState
//       );

//       checkAndUpdateLoadingState();

//       // Handle disconnected state
//       if (connection.iceConnectionState === 'disconnected') {
//         console.warn(`ICE connection disconnected for ${connectionId}`);
//         // Wait briefly for potential recovery
//         setTimeout(() => {
//           if (connection.iceConnectionState === 'disconnected') {
//             connection.close();
//             peersRef.current.delete(connectionId);
//             setPeers(new Map(peersRef.current));
//             createPeerConnection(userId, true);
//           }
//         }, 5000);
//       }
//     };

//     // Handle incoming stream
//     connection.ontrack = (event) => {
//       if (event.streams && event.streams[0]) {
//         peer.stream = event.streams[0];
//         peer.isLoading = false;
//         clearTimeout(timeoutId);
//         peersRef.current.set(connectionId, peer);
//         setPeers(new Map(peersRef.current));
//       }
//     };

//     // If we're the initiator, create and send the offer
//     if (isInitiator && socket) {
//       console.log(`Creating offer for ${connectionId}`);
//       connection
//         .createOffer()
//         .then((offer) => {
//           console.log(`Setting local description for ${connectionId}`);
//           return connection.setLocalDescription(offer);
//         })
//         .then(() => {
//           console.log(`Sending offer to ${userId}`);
//           socket.emit('call-user', {
//             to: userId,
//             offer: connection.localDescription,
//           });
//         })
//         .catch((error) => {
//           console.error('Error creating/sending offer:', error);
//           connection.close();
//           peersRef.current.delete(connectionId);
//           setPeers(new Map(peersRef.current));
//         });
//     }

//     peersRef.current.set(connectionId, peer);
//     setPeers(new Map(peersRef.current));
//     return peer;
//   };

//   // Function to process queued ICE candidates
//   const processIceCandidateQueue = (userId: string) => {
//     if (!socket || !socket.id) return;

//     const connectionId = createConnectionId(socket.id, userId);
//     const queuedCandidates = iceCandidatesQueue.current.get(connectionId) || [];
//     const peer = peersRef.current.get(connectionId);

//     if (peer && queuedCandidates.length > 0) {
//       console.log(
//         `Processing ${queuedCandidates.length} queued candidates for ${connectionId}`
//       );
//       queuedCandidates.forEach((candidate) => {
//         peer.connection
//           .addIceCandidate(new RTCIceCandidate(candidate))
//           .catch((error) => {
//             console.warn('Error adding queued ICE candidate:', error);
//           });
//       });
//       iceCandidatesQueue.current.delete(connectionId);
//     }
//   };

//   useEffect(() => {
//     if (!socket || !socket.id || !localStream) return;

//     // Handle new user joining
//     const handleUserJoined = (userId: string) => {
//       console.log('New user joined:', userId);
//       createPeerConnection(userId, true);
//     };

//     // Handle incoming call
//     const handleCallUser = async (data: {
//       from: string;
//       offer: RTCSessionDescriptionInit;
//     }) => {
//       console.log('Received call from:', data.from);
//       const peer = createPeerConnection(data.from, false);
//       if (!peer) return;

//       try {
//         console.log('Setting remote description (offer)...');
//         await peer.connection.setRemoteDescription(
//           new RTCSessionDescription(data.offer)
//         );

//         // Process any queued candidates after setting remote description
//         processIceCandidateQueue(data.from);

//         console.log('Creating answer...');
//         const answer = await peer.connection.createAnswer();

//         console.log('Setting local description (answer)...');
//         await peer.connection.setLocalDescription(answer);

//         console.log('Sending answer...');
//         socket.emit('answer', {
//           to: data.from,
//           answer: peer.connection.localDescription,
//         });
//       } catch (error) {
//         console.error('Error in call handling:', error);
//         if (!socket?.id) return;
//         const connectionId = createConnectionId(socket.id, data.from);
//         peer.connection.close();
//         peersRef.current.delete(connectionId);
//         setPeers(new Map(peersRef.current));
//       }
//     };

//     // Handle call answer
//     const handleAnswerMade = async (data: {
//       from: string;
//       answer: RTCSessionDescriptionInit;
//     }) => {
//       if (!socket.id) return;
//       const connectionId = createConnectionId(socket.id, data.from);
//       console.log('Received answer from:', connectionId);
//       const peer = peersRef.current.get(connectionId);

//       if (!peer) {
//         console.warn('No peer connection found for:', connectionId);
//         return;
//       }

//       try {
//         await peer.connection.setRemoteDescription(
//           new RTCSessionDescription(data.answer)
//         );
//         // Process any queued candidates after setting remote description
//         processIceCandidateQueue(data.from);
//       } catch (error) {
//         console.error('Error setting remote description:', error);
//         peer.connection.close();
//         peersRef.current.delete(connectionId);
//         setPeers(new Map(peersRef.current));
//       }
//     };

//     // Handle ICE candidate
//     const handleIceCandidate = (data: {
//       from: string;
//       candidate: RTCIceCandidateInit;
//     }) => {
//       if (!socket.id) return;
//       const connectionId = createConnectionId(socket.id, data.from);
//       const peer = peersRef.current.get(connectionId);

//       // Queue the candidate if we don't have a peer yet or remote description isn't set
//       if (!peer || !peer.connection.remoteDescription) {
//         console.log(`Queueing ICE candidate for ${connectionId}`);
//         const queue = iceCandidatesQueue.current.get(connectionId) || [];
//         queue.push(data.candidate);
//         iceCandidatesQueue.current.set(connectionId, queue);
//         return;
//       }

//       // Add the candidate if we're ready
//       peer.connection
//         .addIceCandidate(new RTCIceCandidate(data.candidate))
//         .catch((error) => {
//           console.error('Error adding ICE candidate:', error);
//         });
//     };

//     // Handle user leaving
//     const handleUserLeft = (userId: string) => {
//       if (!socket.id) return;
//       const connectionId = createConnectionId(socket.id, userId);
//       console.log('User left:', connectionId);
//       const peer = peersRef.current.get(connectionId);
//       if (peer) {
//         peer.connection.close();
//         peersRef.current.delete(connectionId);
//         setPeers(new Map(peersRef.current));
//       }
//     };

//     // Handle media state updates
//     const handleMediaStateUpdate = (data: {
//       userId: string;
//       audioEnabled: boolean;
//       videoEnabled: boolean;
//     }) => {
//       console.log('Received media state update:', data);
//       setPeerMediaState((prev) => {
//         const next = new Map(prev);
//         next.set(data.userId, {
//           audioEnabled: data.audioEnabled,
//           videoEnabled: data.videoEnabled,
//         });
//         return next;
//       });
//     };

//     // Handle room data updates
//     const handleRoomData = (data: {
//       participants: string[];
//       mediaState: Record<string, MediaState>;
//     }) => {
//       console.log('Received room data:', data);
//       setPeerMediaState(new Map(Object.entries(data.mediaState)));
//     };

//     // Register event listeners
//     socket.on('user-joined', handleUserJoined);
//     socket.on('call-user', handleCallUser);
//     socket.on('answer-made', handleAnswerMade);
//     socket.on('ice-candidate', handleIceCandidate);
//     socket.on('user-left', handleUserLeft);
//     socket.on('media-state-update', handleMediaStateUpdate);
//     socket.on('room-data', handleRoomData);

//     // Cleanup
//     return () => {
//       socket.off('user-joined', handleUserJoined);
//       socket.off('call-user', handleCallUser);
//       socket.off('answer-made', handleAnswerMade);
//       socket.off('ice-candidate', handleIceCandidate);
//       socket.off('user-left', handleUserLeft);
//       socket.off('media-state-update', handleMediaStateUpdate);
//       socket.off('room-data', handleRoomData);

//       // Clear all timeouts and close connections
//       peersRef.current.forEach((peer) => {
//         peer.connection.close();
//       });
//       peersRef.current.clear();
//       setPeers(new Map());
//       iceCandidatesQueue.current.clear();
//     };
//   }, [socket, localStream]);

//   return {
//     peers,
//     peerMediaState,
//   };
// };

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

      const handleConnectionEstablished = (connectionId: string) => {
        if (socket) {
          const peer = peersRef.current.get(connectionId);
          if (peer) {
            socket.emit('connection-established', { to: peer.id });
          }
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

          // Notify server about successful connection
          handleConnectionEstablished(connectionId);
        } else if (connection.connectionState === 'failed') {
          console.warn(`Connection failed for ${connectionId}`);
          cleanupPeerConnection(connectionId);

          // Retry connection after delay if we're not already processing
          setTimeout(() => {
            if (!peersRef.current.has(connectionId) && socket && socket.id) {
              console.log(`Retrying connection for ${userId}`);
              createPeerConnection(userId, true);
            }
          }, RECONNECTION_DELAY);
        }
      };

      connection.oniceconnectionstatechange = () => {
        const currentPeer = peersRef.current.get(connectionId);
        if (!currentPeer) return;

        console.log(
          `ICE connection state changed for ${connectionId}:`,
          connection.iceConnectionState
        );

        if (
          connection.iceConnectionState === 'connected' ||
          connection.iceConnectionState === 'completed'
        ) {
          currentPeer.isLoading = false;
          if (currentPeer.timeoutId) {
            clearTimeout(currentPeer.timeoutId);
            currentPeer.timeoutId = undefined;
          }
          updatePeersState();
        } else if (connection.iceConnectionState === 'disconnected') {
          console.warn(`ICE connection disconnected for ${connectionId}`);
          setTimeout(() => {
            if (
              peersRef.current.has(connectionId) &&
              connection.iceConnectionState === 'disconnected'
            ) {
              cleanupPeerConnection(connectionId);
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

      // Store peer and initiate connection if needed
      peersRef.current.set(connectionId, peer);
      updatePeersState();

      // Create offer if we're the initiator
      if (isInitiator) {
        peer.signalState = ConnectionState.CREATING_OFFER;
        connection
          .createOffer()
          .then((offer) => {
            // Check if connection is still valid
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
            // Notify server about connection failure
            if (socket) {
              socket.emit('connection-failed', {
                to: userId,
                reason: error.message,
              });
            }
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
    [
      socket,
      localStream,
      cleanupPeerConnection,
      updatePeersState,
      processIceCandidateQueue,
    ]
  );

  useEffect(() => {
    if (!socket || !socket.id || !localStream) return;

    // Handle coordinated connection initiation from server
    const handleInitiateConnection = (data: {
      targetUserId: string;
      isInitiator: boolean;
    }) => {
      console.log('Server requested connection initiation:', data);
      createPeerConnection(data.targetUserId, data.isInitiator);
    };

    // Handle connection establishment notification
    const handleConnectionEstablished = (connectionId: string) => {
      if (socket) {
        const peer = peersRef.current.get(connectionId);
        if (peer) {
          socket.emit('connection-established', { to: peer.id });
        }
      }
    };

    // Handle connection failure notification
    const handleConnectionFailed = (data: { from: string; reason: string }) => {
      if (!socket?.id) return;
      const connectionId = createConnectionId(socket.id, data.from);
      console.log(`Connection failed from ${data.from}: ${data.reason}`);
      cleanupPeerConnection(connectionId);
    };

    // Handle incoming call with proper state checking
    const handleCallUser = async (data: {
      from: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      if (!socket.id) return;

      const connectionId = createConnectionId(socket.id, data.from);
      console.log('Received call from:', data.from);

      // Check if we already have a connection in progress
      const existingPeer = peersRef.current.get(connectionId);
      if (existingPeer && existingPeer.signalState !== ConnectionState.FAILED) {
        console.log(
          `Connection ${connectionId} already exists, ignoring duplicate call`
        );
        return;
      }

      const peer = createPeerConnection(data.from, false);
      if (!peer) return;

      try {
        console.log(`Setting remote description (offer) for ${connectionId}`);
        await peer.connection.setRemoteDescription(
          new RTCSessionDescription(data.offer)
        );

        peer.signalState = ConnectionState.CREATING_OFFER;

        // Process any queued candidates
        await processIceCandidateQueue(connectionId);

        console.log(`Creating answer for ${connectionId}`);
        const answer = await peer.connection.createAnswer();

        console.log(`Setting local description (answer) for ${connectionId}`);
        await peer.connection.setLocalDescription(answer);

        peer.signalState = ConnectionState.ANSWER_SENT;

        console.log(`Sending answer to ${data.from}`);
        socket.emit('answer', {
          to: data.from,
          answer: peer.connection.localDescription,
        });
      } catch (error) {
        console.error(`Error handling call from ${data.from}:`, error);
        cleanupPeerConnection(connectionId);
      }
    };

    // Handle call answer with state validation
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

      // Check if we're in the correct state to receive an answer
      if (peer.signalState !== ConnectionState.OFFER_SENT) {
        console.warn(
          `Received answer in wrong state (${peer.signalState}) for ${connectionId}`
        );
        return;
      }

      try {
        console.log(`Setting remote description (answer) for ${connectionId}`);
        await peer.connection.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );

        peer.signalState = ConnectionState.ANSWER_RECEIVED;

        // Process any queued candidates
        await processIceCandidateQueue(connectionId);
      } catch (error) {
        console.error(
          `Error setting remote description for ${connectionId}:`,
          error
        );
        cleanupPeerConnection(connectionId);
      }
    };

    // Handle ICE candidate with improved queueing
    const handleIceCandidate = async (data: {
      from: string;
      candidate: RTCIceCandidateInit;
    }) => {
      if (!socket.id) return;

      const connectionId = createConnectionId(socket.id, data.from);
      const peer = peersRef.current.get(connectionId);

      if (!peer) {
        console.log(
          `Queueing ICE candidate for non-existent peer ${connectionId}`
        );
        const queue = iceCandidatesQueue.current.get(connectionId) || [];
        queue.push(data.candidate);
        iceCandidatesQueue.current.set(connectionId, queue);
        return;
      }

      // Queue candidate if we don't have both descriptions yet
      if (
        !peer.connection.localDescription ||
        !peer.connection.remoteDescription
      ) {
        console.log(
          `Queueing ICE candidate for ${connectionId} (waiting for descriptions)`
        );
        const queue = iceCandidatesQueue.current.get(connectionId) || [];
        queue.push(data.candidate);
        iceCandidatesQueue.current.set(connectionId, queue);
        return;
      }

      // Add candidate immediately if we're ready
      try {
        await peer.connection.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
      } catch (error) {
        console.error(`Error adding ICE candidate for ${connectionId}:`, error);
      }
    };

    // Handle user leaving
    const handleUserLeft = (userId: string) => {
      if (!socket.id) return;
      const connectionId = createConnectionId(socket.id, userId);
      console.log('User left:', userId);
      cleanupPeerConnection(connectionId);
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
    socket.on('initiate-connection', handleInitiateConnection);
    socket.on('call-user', handleCallUser);
    socket.on('answer-made', handleAnswerMade);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('user-left', handleUserLeft);
    socket.on('connection-failed', handleConnectionFailed);
    socket.on('connection-established', handleConnectionEstablished);
    socket.on('media-state-update', handleMediaStateUpdate);
    socket.on('room-data', handleRoomData);

    // Cleanup function
    return () => {
      console.log('Cleaning up WebRTC connections');

      socket.off('initiate-connection', handleInitiateConnection);
      socket.off('call-user', handleCallUser);
      socket.off('answer-made', handleAnswerMade);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('user-left', handleUserLeft);
      socket.off('connection-failed', handleConnectionFailed);
      socket.off('connection-established', handleConnectionEstablished);
      socket.off('media-state-update', handleMediaStateUpdate);
      socket.off('room-data', handleRoomData);

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
    };
  }, [
    socket,
    localStream,
    createPeerConnection,
    cleanupPeerConnection,
    processIceCandidateQueue,
  ]);

  return {
    peers,
    peerMediaState,
  };
};
