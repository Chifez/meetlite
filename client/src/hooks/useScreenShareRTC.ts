import { useState, useRef, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';

// Configuration for WebRTC
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

// Helper to create a unique connection ID for screen sharing
const createConnectionId = (localId: string, remoteId: string) => {
  return `screen_${[localId, remoteId].sort().join('_')}`;
};

interface ScreenPeerConnection {
  id: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
  isLoading?: boolean;
}

export const useScreenShareRTC = (
  socket: Socket | null,
  screenStream: MediaStream | null
) => {
  const [screenPeers, setScreenPeers] = useState<
    Map<string, ScreenPeerConnection>
  >(new Map());
  const peersRef = useRef<Map<string, ScreenPeerConnection>>(new Map());
  const iceCandidatesQueue = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map()
  );

  // Track pending initiation requests
  const pendingInitiations = useRef<
    Array<{ userId: string; isInitiator: boolean }>
  >([]);

  // Clean up a peer connection
  const cleanupPeerConnection = useCallback((connectionId: string) => {
    const peer = peersRef.current.get(connectionId);
    if (peer) {
      console.log(`Cleaning up screen sharing connection ${connectionId}`);
      peer.connection.close();
      peersRef.current.delete(connectionId);
      iceCandidatesQueue.current.delete(connectionId);
      setScreenPeers(new Map(peersRef.current));
    }
  }, []);

  // Process queued ICE candidates
  const processIceCandidateQueue = useCallback(async (connectionId: string) => {
    const peer = peersRef.current.get(connectionId);
    const queuedCandidates = iceCandidatesQueue.current.get(connectionId) || [];

    if (!peer || queuedCandidates.length === 0) return;

    if (
      !peer.connection.localDescription ||
      !peer.connection.remoteDescription
    ) {
      return;
    }

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

    iceCandidatesQueue.current.delete(connectionId);
  }, []);

  // Create a new peer connection
  const createPeerConnection = useCallback(
    (userId: string, isInitiator: boolean) => {
      if (!socket || !socket.id) {
        console.warn(
          '⚠️ [ScreenShare] Socket not available for peer connection'
        );
        return null;
      }

      // For initiators, we need screenStream to send. For receivers, we don't.
      if (isInitiator && !screenStream) {
        console.warn(
          '⚠️ [ScreenShare] Screen stream not available for peer connection'
        );
        // Queue the initiation for later processing
        pendingInitiations.current.push({ userId, isInitiator });
        console.log(`📋 [ScreenShare] Queued initiation for ${userId}`);
        return null;
      }

      const connectionId = createConnectionId(socket.id, userId);
      console.log(
        `🚀 [ScreenShare] Creating screen peer connection ${connectionId}, isInitiator: ${isInitiator}, hasScreenStream: ${!!screenStream}`
      );

      // Clean up existing connection
      cleanupPeerConnection(connectionId);

      // Create new RTCPeerConnection
      const connection = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
      });

      console.log(
        `🔧 [ScreenShare] RTCPeerConnection created for ${connectionId}`
      );

      // Add screen sharing tracks only if we have a stream (initiator)
      if (screenStream) {
        screenStream.getTracks().forEach((track) => {
          console.log(
            `📺 [ScreenShare] Adding ${track.kind} track to ${connectionId}`
          );
          connection.addTrack(track, screenStream);
        });
      } else {
        console.log(
          `📺 [ScreenShare] No tracks to add (receiving-only connection)`
        );
      }

      // Create peer object
      const peer: ScreenPeerConnection = {
        id: userId,
        connection,
        isLoading: true,
      };

      // Handle ICE candidates
      connection.onicecandidate = (event) => {
        if (event.candidate && socket) {
          console.log(
            `🧊 [ScreenShare] Sending ICE candidate for ${connectionId}:`,
            event.candidate.candidate
          );
          socket.emit('screen-share-candidate', {
            to: userId,
            candidate: event.candidate,
          });
        } else if (!event.candidate) {
          console.log(
            `🧊 [ScreenShare] ICE gathering complete for ${connectionId}`
          );
        }
      };

      // ICE gathering state monitoring
      connection.onicegatheringstatechange = () => {
        console.log(
          `🧊 [ScreenShare] ICE gathering state for ${connectionId}:`,
          connection.iceGatheringState
        );
      };

      // ICE connection state monitoring
      connection.oniceconnectionstatechange = () => {
        console.log(
          `🔗 [ScreenShare] ICE connection state for ${connectionId}:`,
          connection.iceConnectionState
        );
      };

      // Connection state monitoring
      connection.onconnectionstatechange = () => {
        const currentPeer = peersRef.current.get(connectionId);
        if (!currentPeer) return;

        console.log(
          `🔄 [ScreenShare] Connection state changed for ${connectionId}:`,
          connection.connectionState
        );

        if (connection.connectionState === 'connected') {
          console.log(
            `✅ [ScreenShare] Connection established for ${connectionId}`
          );
          currentPeer.isLoading = false;
          setScreenPeers(new Map(peersRef.current));
        } else if (connection.connectionState === 'failed') {
          console.error(
            `❌ [ScreenShare] Connection failed for ${connectionId}`
          );
          cleanupPeerConnection(connectionId);
        }
      };

      // Handle incoming stream
      connection.ontrack = (event) => {
        console.log(
          `📺 [ScreenShare] Received track for ${connectionId}:`,
          event.track.kind
        );
        if (event.streams && event.streams[0]) {
          const currentPeer = peersRef.current.get(connectionId);
          if (currentPeer) {
            console.log(`📺 [ScreenShare] Setting stream for ${connectionId}`);
            currentPeer.stream = event.streams[0];
            currentPeer.isLoading = false;
            setScreenPeers(new Map(peersRef.current));
          }
        }
      };

      // Store peer
      peersRef.current.set(connectionId, peer);
      setScreenPeers(new Map(peersRef.current));

      // Create offer if we're the initiator
      if (isInitiator) {
        console.log(`📞 [ScreenShare] Creating offer for ${connectionId}`);
        connection
          .createOffer()
          .then((offer) => {
            if (!peersRef.current.has(connectionId)) {
              throw new Error('Connection was closed during offer creation');
            }
            console.log(
              `📞 [ScreenShare] Offer created for ${connectionId}:`,
              offer.type
            );
            console.log(
              `📞 [ScreenShare] Setting local description for ${connectionId}`
            );
            return connection.setLocalDescription(offer);
          })
          .then(() => {
            console.log(
              `📞 [ScreenShare] Local description set for ${connectionId}`
            );
            console.log(`📞 [ScreenShare] Sending offer to ${userId}`);
            socket.emit('screen-share-call', {
              to: userId,
              offer: connection.localDescription,
            });
          })
          .catch((error) => {
            console.error(
              `❌ [ScreenShare] Error creating/sending screen offer for ${connectionId}:`,
              error
            );
            cleanupPeerConnection(connectionId);
          });
      }

      return peer;
    },
    [socket, screenStream, cleanupPeerConnection]
  );

  // Expose function to trigger connection initiation
  const initiateScreenConnection = useCallback(
    (userId: string, isInitiator: boolean) => {
      console.log(
        `🎯 [ScreenShare] Initiate screen connection request for ${userId}, isInitiator: ${isInitiator}`
      );
      createPeerConnection(userId, isInitiator);
    },
    [createPeerConnection]
  );

  // Single effect to handle both socket events and pending initiations
  useEffect(() => {
    if (!socket || !socket.id) return;

    // Process pending initiations when screen stream becomes available
    if (screenStream && pendingInitiations.current.length > 0) {
      console.log(
        `🎬 [ScreenShare] Screen stream available, processing ${pendingInitiations.current.length} pending initiations`
      );

      const toProcess = [...pendingInitiations.current];
      pendingInitiations.current = [];

      toProcess.forEach(({ userId, isInitiator }) => {
        console.log(
          `🔄 [ScreenShare] Processing pending initiation to ${userId}`
        );
        createPeerConnection(userId, isInitiator);
      });
    }

    // Handle incoming screen share call
    const handleScreenShareCall = async (data: {
      from: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      if (!socket.id) return;
      console.log(
        '📞 [ScreenShare] Received screen share call from:',
        data.from
      );
      console.log('📞 [ScreenShare] Offer type:', data.offer.type);
      const peer = createPeerConnection(data.from, false);
      if (!peer) {
        console.error(
          '❌ [ScreenShare] Failed to create peer connection for incoming screen share call'
        );
        return;
      }

      try {
        console.log(
          `📞 [ScreenShare] Setting remote description for ${createConnectionId(
            socket.id,
            data.from
          )}`
        );
        await peer.connection.setRemoteDescription(
          new RTCSessionDescription(data.offer)
        );
        console.log(
          `✅ [ScreenShare] Remote description set successfully for ${createConnectionId(
            socket.id,
            data.from
          )}`
        );

        console.log(
          `📞 [ScreenShare] Processing queued ICE candidates for ${createConnectionId(
            socket.id,
            data.from
          )}`
        );
        await processIceCandidateQueue(
          createConnectionId(socket.id, data.from)
        );

        console.log(
          `📞 [ScreenShare] Creating answer for ${createConnectionId(
            socket.id,
            data.from
          )}`
        );
        const answer = await peer.connection.createAnswer();
        console.log(`📞 [ScreenShare] Answer created:`, answer.type);

        console.log(
          `📞 [ScreenShare] Setting local description (answer) for ${createConnectionId(
            socket.id,
            data.from
          )}`
        );
        await peer.connection.setLocalDescription(answer);
        console.log(
          `✅ [ScreenShare] Local description (answer) set successfully`
        );

        console.log(`📞 [ScreenShare] Sending answer to ${data.from}`);
        socket.emit('screen-share-answer', {
          to: data.from,
          answer: peer.connection.localDescription,
        });
      } catch (error) {
        console.error(
          '❌ [ScreenShare] Error handling screen share call:',
          error
        );
        cleanupPeerConnection(createConnectionId(socket.id, data.from));
      }
    };

    // Handle screen share answer
    const handleScreenShareAnswer = async (data: {
      from: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      if (!socket.id) return;
      const connectionId = createConnectionId(socket.id, data.from);
      console.log(
        '📞 [ScreenShare] Received screen share answer from:',
        data.from
      );
      console.log('📞 [ScreenShare] Answer type:', data.answer.type);

      const peer = peersRef.current.get(connectionId);
      if (!peer) {
        console.warn(
          `⚠️ [ScreenShare] No peer connection found for: ${connectionId}`
        );
        return;
      }

      try {
        console.log(
          `📞 [ScreenShare] Setting remote description (answer) for ${connectionId}`
        );
        await peer.connection.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
        console.log(
          `✅ [ScreenShare] Remote description (answer) set successfully for ${connectionId}`
        );

        console.log(
          `📞 [ScreenShare] Processing queued ICE candidates for ${connectionId}`
        );
        await processIceCandidateQueue(connectionId);
      } catch (error) {
        console.error(
          '❌ [ScreenShare] Error setting screen remote description:',
          error
        );
        cleanupPeerConnection(connectionId);
      }
    };

    // Handle ICE candidate
    const handleScreenShareCandidate = async (data: {
      from: string;
      candidate: RTCIceCandidateInit;
    }) => {
      if (!socket.id) return;
      const connectionId = createConnectionId(socket.id, data.from);
      const peer = peersRef.current.get(connectionId);

      console.log(
        `🧊 [ScreenShare] Received ICE candidate from ${data.from}:`,
        data.candidate.candidate
      );

      if (
        !peer ||
        !peer.connection.localDescription ||
        !peer.connection.remoteDescription
      ) {
        console.log(
          `🧊 [ScreenShare] Queueing ICE candidate for ${connectionId} (waiting for descriptions)`
        );
        const queue = iceCandidatesQueue.current.get(connectionId) || [];
        queue.push(data.candidate);
        iceCandidatesQueue.current.set(connectionId, queue);
        return;
      }

      try {
        console.log(
          `🧊 [ScreenShare] Adding ICE candidate immediately for ${connectionId}`
        );
        await peer.connection.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
        console.log(
          `✅ [ScreenShare] ICE candidate added successfully for ${connectionId}`
        );
      } catch (error) {
        console.error(
          '❌ [ScreenShare] Error adding screen ICE candidate:',
          error
        );
      }
    };

    // Handle user left
    const handleUserLeft = (userId: string) => {
      if (!socket.id) return;
      console.log(
        '👋 [ScreenShare] User left, cleaning up screen connection:',
        userId
      );
      cleanupPeerConnection(createConnectionId(socket.id, userId));
    };

    // Register event listeners
    socket.on('screen-share-call', handleScreenShareCall);
    socket.on('screen-share-answer', handleScreenShareAnswer);
    socket.on('screen-share-candidate', handleScreenShareCandidate);
    socket.on('user-left', handleUserLeft);
    socket.on('initiate-screen-connection', ({ targetUserId, isInitiator }) => {
      console.log(
        `🎯 [ScreenShare] Received initiate-screen-connection for ${targetUserId}, isInitiator: ${isInitiator}`
      );
      initiateScreenConnection(targetUserId, isInitiator);
    });

    // Cleanup
    return () => {
      socket.off('screen-share-call', handleScreenShareCall);
      socket.off('screen-share-answer', handleScreenShareAnswer);
      socket.off('screen-share-candidate', handleScreenShareCandidate);
      socket.off('user-left', handleUserLeft);
      socket.off('initiate-screen-connection');

      // Clean up all connections
      peersRef.current.forEach((peer) => {
        peer.connection.close();
      });
      peersRef.current.clear();
      iceCandidatesQueue.current.clear();
      pendingInitiations.current = [];
      setScreenPeers(new Map());
    };
  }, [
    socket,
    screenStream,
    createPeerConnection,
    cleanupPeerConnection,
    processIceCandidateQueue,
    initiateScreenConnection,
  ]);

  return { screenPeers, initiateScreenConnection };
};
