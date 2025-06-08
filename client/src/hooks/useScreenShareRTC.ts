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
        return null;
      }

      // For initiators, we need screenStream to send. For receivers, we don't.
      if (isInitiator && !screenStream) {
        pendingInitiations.current.push({ userId, isInitiator });
        return null;
      }

      const connectionId = createConnectionId(socket.id, userId);
      cleanupPeerConnection(connectionId);

      const connection = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
      });

      // Add screen sharing tracks only if we have a stream (initiator)
      if (screenStream) {
        screenStream.getTracks().forEach((track) => {
          connection.addTrack(track, screenStream);
        });
      }

      const peer: ScreenPeerConnection = {
        id: userId,
        connection,
        isLoading: true,
      };

      connection.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('screen-share-candidate', {
            to: userId,
            candidate: event.candidate,
          });
        }
      };

      connection.onconnectionstatechange = () => {
        const currentPeer = peersRef.current.get(connectionId);
        if (!currentPeer) return;

        if (connection.connectionState === 'connected') {
          currentPeer.isLoading = false;
          setScreenPeers(new Map(peersRef.current));
        } else if (connection.connectionState === 'failed') {
          console.error(`Screen sharing connection failed for ${connectionId}`);
          cleanupPeerConnection(connectionId);
        }
      };

      connection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          const currentPeer = peersRef.current.get(connectionId);
          if (currentPeer) {
            currentPeer.stream = event.streams[0];
            currentPeer.isLoading = false;
            setScreenPeers(new Map(peersRef.current));
          }
        }
      };

      peersRef.current.set(connectionId, peer);
      setScreenPeers(new Map(peersRef.current));

      if (isInitiator) {
        connection
          .createOffer()
          .then((offer) => {
            if (!peersRef.current.has(connectionId)) {
              throw new Error('Connection was closed during offer creation');
            }
            return connection.setLocalDescription(offer);
          })
          .then(() => {
            socket.emit('screen-share-call', {
              to: userId,
              offer: connection.localDescription,
            });
          })
          .catch((error) => {
            console.error(
              `Error creating screen share offer for ${connectionId}:`,
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
      createPeerConnection(userId, isInitiator);
    },
    [createPeerConnection]
  );

  // Single effect to handle both socket events and pending initiations
  useEffect(() => {
    if (!socket || !socket.id) return;

    // Process pending initiations when screen stream becomes available
    if (screenStream && pendingInitiations.current.length > 0) {
      const toProcess = [...pendingInitiations.current];
      pendingInitiations.current = [];

      toProcess.forEach(({ userId, isInitiator }) => {
        createPeerConnection(userId, isInitiator);
      });
    }

    // Handle incoming screen share call
    const handleScreenShareCall = async (data: {
      from: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      if (!socket.id) return;

      const peer = createPeerConnection(data.from, false);
      if (!peer) {
        console.error(
          'Failed to create peer connection for incoming screen share call'
        );
        return;
      }

      try {
        await peer.connection.setRemoteDescription(
          new RTCSessionDescription(data.offer)
        );
        await processIceCandidateQueue(
          createConnectionId(socket.id, data.from)
        );

        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);

        socket.emit('screen-share-answer', {
          to: data.from,
          answer: peer.connection.localDescription,
        });
      } catch (error) {
        console.error('Error handling screen share call:', error);
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
      const peer = peersRef.current.get(connectionId);

      if (!peer) {
        console.warn(
          `⚠️ [ScreenShare] No peer connection found for: ${connectionId}`
        );
        return;
      }

      try {
        await peer.connection.setRemoteDescription(
          new RTCSessionDescription(data.answer)
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

      if (
        !peer ||
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

  return { screenPeers };
};
