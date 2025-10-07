import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';

interface MediaSoupPeer {
  id: string;
  sendTransport: mediasoupClient.types.Transport | null;
  recvTransport: mediasoupClient.types.Transport | null;
  producers: Map<string, mediasoupClient.types.Producer>;
  consumers: Map<string, mediasoupClient.types.Consumer>;
  stream: MediaStream | null;
  isLoading: boolean;
}

interface MediaSoupState {
  device: mediasoupClient.types.Device | null;
  rtpCapabilities: mediasoupClient.types.RtpCapabilities | null;
  peers: Map<string, MediaSoupPeer>;
  isConnected: boolean;
  isLoading: boolean;
}

export const useMediaSoup = (
  socket: Socket | null,
  localStream: MediaStream | null,
  roomId: string | undefined,
  onParticipantInfoUpdate?: (
    info: Record<string, { email: string; userId: string }>
  ) => void
) => {
  const [state, setState] = useState<MediaSoupState>({
    device: null,
    rtpCapabilities: null,
    peers: new Map(),
    isConnected: false,
    isLoading: false,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  // Update state helper
  const updateState = useCallback((updates: Partial<MediaSoupState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Update peers helper
  const updatePeers = useCallback(
    (peerId: string, updates: Partial<MediaSoupPeer>) => {
      setState((prev) => {
        const newPeers = new Map(prev.peers);
        const existingPeer = newPeers.get(peerId);
        if (existingPeer) {
          newPeers.set(peerId, { ...existingPeer, ...updates });
        }
        return { ...prev, peers: newPeers };
      });
    },
    []
  );

  // Initialize MediaSoup device
  const initializeDevice = useCallback(
    async (rtpCapabilities: mediasoupClient.types.RtpCapabilities) => {
      try {
        const device = new mediasoupClient.Device();
        await device.load({ routerRtpCapabilities: rtpCapabilities });

        updateState({
          device,
          rtpCapabilities,
          isLoading: false,
        });

        console.log('🎥 MediaSoup device initialized', {
          deviceId: device.id,
          rtpCapabilities: device.rtpCapabilities,
        });

        return device;
      } catch (error) {
        console.error('❌ Failed to initialize MediaSoup device:', error);
        updateState({ isLoading: false });
        throw error;
      }
    },
    [updateState]
  );

  // Create send transport
  const createSendTransport = useCallback(
    async (roomId: string) => {
      if (!socket || !stateRef.current.device) {
        throw new Error('Socket or device not available');
      }

      const transportData = await new Promise<{
        id: string;
        iceParameters: any;
        iceCandidates: any[];
        dtlsParameters: any;
      }>((resolve, reject) => {
        socket.emit('mediasoup:create-transport', {
          roomId,
          direction: 'send',
        });

        socket.once('transport-created', resolve);
        socket.once('error', reject);
      });

      const sendTransport = stateRef.current.device.createSendTransport({
        id: transportData.id,
        iceParameters: transportData.iceParameters,
        iceCandidates: transportData.iceCandidates,
        dtlsParameters: transportData.dtlsParameters,
      });

      // Handle transport connection
      sendTransport.on(
        'connect',
        async ({ dtlsParameters }, callback, errback) => {
          try {
            await new Promise<void>((resolve, reject) => {
              socket.emit('mediasoup:connect-transport', {
                roomId,
                transportId: transportData.id,
                dtlsParameters,
              });

              socket.once('transport-connected', () => {
                callback();
                resolve();
              });
              socket.once('error', reject);
            });
          } catch (error) {
            errback(error as Error);
          }
        }
      );

      // Handle produce events
      sendTransport.on(
        'produce',
        async ({ kind, rtpParameters }, callback, errback) => {
          try {
            const producerData = await new Promise<{ id: string }>(
              (resolve, reject) => {
                socket.emit('mediasoup:create-producer', {
                  roomId,
                  transportId: transportData.id,
                  rtpParameters,
                  kind,
                });

                socket.once('producer-created', resolve);
                socket.once('error', reject);
              }
            );

            callback({ id: producerData.id });
          } catch (error) {
            errback(error as Error);
          }
        }
      );

      return sendTransport;
    },
    [socket]
  );

  // Create receive transport
  const createRecvTransport = useCallback(
    async (roomId: string) => {
      if (!socket || !stateRef.current.device) {
        throw new Error('Socket or device not available');
      }

      const transportData = await new Promise<{
        id: string;
        iceParameters: any;
        iceCandidates: any[];
        dtlsParameters: any;
      }>((resolve, reject) => {
        socket.emit('mediasoup:create-transport', {
          roomId,
          direction: 'recv',
        });

        socket.once('transport-created', resolve);
        socket.once('error', reject);
      });

      const recvTransport = stateRef.current.device.createRecvTransport({
        id: transportData.id,
        iceParameters: transportData.iceParameters,
        iceCandidates: transportData.iceCandidates,
        dtlsParameters: transportData.dtlsParameters,
      });

      // Handle transport connection
      recvTransport.on(
        'connect',
        async ({ dtlsParameters }, callback, errback) => {
          try {
            await new Promise<void>((resolve, reject) => {
              socket.emit('mediasoup:connect-transport', {
                roomId,
                transportId: transportData.id,
                dtlsParameters,
              });

              socket.once('transport-connected', () => {
                callback();
                resolve();
              });
              socket.once('error', reject);
            });
          } catch (error) {
            errback(error as Error);
          }
        }
      );

      return recvTransport;
    },
    [socket]
  );

  // Produce local stream
  const produceLocalStream = useCallback(
    async (roomId: string, stream: MediaStream) => {
      if (!stateRef.current.device || !stream) return;

      try {
        const sendTransport = await createSendTransport(roomId);

        const audioTrack = stream.getAudioTracks()[0];
        const videoTrack = stream.getVideoTracks()[0];

        let audioProducer: mediasoupClient.types.Producer | null = null;
        let videoProducer: mediasoupClient.types.Producer | null = null;

        // Produce audio
        if (audioTrack && sendTransport.canProduce('audio')) {
          audioProducer = await sendTransport.produce({ track: audioTrack });
          console.log('🎤 Audio producer created:', audioProducer.id);
        }

        // Produce video
        if (videoTrack && sendTransport.canProduce('video')) {
          videoProducer = await sendTransport.produce({ track: videoTrack });
          console.log('📹 Video producer created:', videoProducer.id);
        }

        // Update local peer state
        const localPeerId = 'local';
        const existingPeer = stateRef.current.peers.get(localPeerId);

        if (existingPeer) {
          if (audioProducer)
            existingPeer.producers.set(audioProducer.id, audioProducer);
          if (videoProducer)
            existingPeer.producers.set(videoProducer.id, videoProducer);
          existingPeer.sendTransport = sendTransport;
          existingPeer.stream = stream;
          updatePeers(localPeerId, existingPeer);
        } else {
          const newPeer: MediaSoupPeer = {
            id: localPeerId,
            sendTransport,
            recvTransport: null,
            producers: new Map(),
            consumers: new Map(),
            stream,
            isLoading: false,
          };

          if (audioProducer)
            newPeer.producers.set(audioProducer.id, audioProducer);
          if (videoProducer)
            newPeer.producers.set(videoProducer.id, videoProducer);

          setState((prev) => ({
            ...prev,
            peers: new Map(prev.peers).set(localPeerId, newPeer),
          }));
        }

        console.log('✅ Local stream produced successfully');
      } catch (error) {
        console.error('❌ Failed to produce local stream:', error);
        throw error;
      }
    },
    [createSendTransport, updatePeers]
  );

  // Consume remote stream
  const consumeRemoteStream = useCallback(
    async (
      roomId: string,
      producerId: string,
      userId: string,
      kind: 'audio' | 'video'
    ) => {
      if (!stateRef.current.device || !socket) return;

      try {
        let peer = stateRef.current.peers.get(userId);

        // Create peer if doesn't exist
        if (!peer) {
          peer = {
            id: userId,
            sendTransport: null,
            recvTransport: null,
            producers: new Map(),
            consumers: new Map(),
            stream: null,
            isLoading: true,
          };
          setState((prev) => ({
            ...prev,
            peers: new Map(prev.peers).set(userId, peer!),
          }));
        }

        // Create receive transport if doesn't exist
        if (!peer.recvTransport) {
          peer.recvTransport = await createRecvTransport(roomId);
          updatePeers(userId, { recvTransport: peer.recvTransport });
        }

        // Create consumer
        const consumerData = await new Promise<{
          id: string;
          producerId: string;
          kind: string;
          rtpParameters: any;
          type: string;
          producerPaused: boolean;
        }>((resolve, reject) => {
          socket.emit('mediasoup:create-consumer', {
            roomId,
            transportId: peer.recvTransport!.id,
            producerId,
            rtpCapabilities: stateRef.current.device.rtpCapabilities,
          });

          socket.once('consumer-created', resolve);
          socket.once('error', reject);
        });

        const consumer = await peer.recvTransport.consume({
          id: consumerData.id,
          producerId: consumerData.producerId,
          kind: consumerData.kind as 'audio' | 'video',
          rtpParameters: consumerData.rtpParameters,
        });

        // Add consumer to peer
        peer.consumers.set(consumer.id, consumer);

        // Create or update stream
        if (!peer.stream) {
          peer.stream = new MediaStream();
        }
        peer.stream.addTrack(consumer.track);

        updatePeers(userId, {
          consumers: peer.consumers,
          stream: peer.stream,
          isLoading: false,
        });

        console.log(`📺 Consumer created for ${userId}:`, {
          consumerId: consumer.id,
          kind: consumer.kind,
          producerId: consumer.producerId,
        });
      } catch (error) {
        console.error(
          `❌ Failed to consume remote stream for ${userId}:`,
          error
        );
        updatePeers(userId, { isLoading: false });
      }
    },
    [createRecvTransport, updatePeers, socket]
  );

  // Handle socket events
  useEffect(() => {
    if (!socket) return;

    // Handle room data
    const handleRoomData = async (data: {
      participants: string[];
      mediaState: Record<
        string,
        { audioEnabled: boolean; videoEnabled: boolean }
      >;
      participantInfo?: Record<string, { email: string; userId: string }>;
      rtpCapabilities: mediasoupClient.types.RtpCapabilities;
      mediaSoupEnabled?: boolean;
    }) => {
      console.log('📡 Received room data:', data);

      if (!data.mediaSoupEnabled) {
        console.warn('⚠️ MediaSoup not enabled in room');
        return;
      }

      try {
        // Initialize device
        await initializeDevice(data.rtpCapabilities);
        updateState({ isConnected: true });

        // Update participant info
        if (data.participantInfo && onParticipantInfoUpdate) {
          onParticipantInfoUpdate(data.participantInfo);
        }

        // Produce local stream if available
        if (localStream && roomId) {
          await produceLocalStream(roomId, localStream);
        }
      } catch (error) {
        console.error('❌ Failed to handle room data:', error);
        updateState({ isConnected: false });
      }
    };

    // Handle new producer
    const handleNewProducer = (data: {
      producerId: string;
      userId: string;
      kind: 'audio' | 'video';
    }) => {
      console.log('📺 New producer available:', data);

      if (data.userId === 'local') return; // Skip our own producers

      if (roomId) {
        consumeRemoteStream(roomId, data.producerId, data.userId, data.kind);
      }
    };

    // Handle user joined
    const handleUserJoined = (data: { userId: string; userEmail: string }) => {
      console.log('👋 User joined:', data);
    };

    // Handle user left
    const handleUserLeft = (userId: string) => {
      console.log('👋 User left:', userId);

      // Clean up peer
      setState((prev) => {
        const newPeers = new Map(prev.peers);
        const peer = newPeers.get(userId);

        if (peer) {
          // Close transports
          peer.sendTransport?.close();
          peer.recvTransport?.close();

          // Close producers
          peer.producers.forEach((producer) => producer.close());

          // Close consumers
          peer.consumers.forEach((consumer) => consumer.close());

          newPeers.delete(userId);
        }

        return { ...prev, peers: newPeers };
      });
    };

    // Handle errors
    // Handle media state updates
    const handleMediaStateUpdate = (data: {
      userId: string;
      audioEnabled: boolean;
      videoEnabled: boolean;
    }) => {
      console.log('📱 Media state update:', data);
      // Media state is handled by the main room context
    };

    // Handle screen share events
    const handleScreenShareStarted = (data: { userId: string }) => {
      console.log('🖥️ Screen share started:', data);
      // Screen share state is handled by the screen share hook
    };

    const handleScreenShareStopped = () => {
      console.log('🖥️ Screen share stopped');
      // Screen share state is handled by the screen share hook
    };

    const handleError = (error: { message: string }) => {
      console.error('❌ MediaSoup error:', error);
      updateState({ isConnected: false, isLoading: false });
    };

    // Register event listeners
    socket.on('room-data', handleRoomData);
    socket.on('new-producer', handleNewProducer);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('media-state-update', handleMediaStateUpdate);
    socket.on('screen-share-started', handleScreenShareStarted);
    socket.on('screen-share-stopped', handleScreenShareStopped);
    socket.on('error', handleError);

    // Cleanup
    return () => {
      socket.off('room-data', handleRoomData);
      socket.off('new-producer', handleNewProducer);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('media-state-update', handleMediaStateUpdate);
      socket.off('screen-share-started', handleScreenShareStarted);
      socket.off('screen-share-stopped', handleScreenShareStopped);
      socket.off('error', handleError);

      // Cleanup all peers
      stateRef.current.peers.forEach((peer) => {
        peer.sendTransport?.close();
        peer.recvTransport?.close();
        peer.producers.forEach((producer) => producer.close());
        peer.consumers.forEach((consumer) => consumer.close());
      });

      updateState({
        peers: new Map(),
        isConnected: false,
        device: null,
        rtpCapabilities: null,
      });
    };
  }, [
    socket,
    localStream,
    initializeDevice,
    produceLocalStream,
    consumeRemoteStream,
    updateState,
    onParticipantInfoUpdate,
  ]);

  // Convert MediaSoup peers to format expected by VideoGrid
  const peers = useMemo(() => {
    const peerMap = new Map();

    state.peers.forEach((peer, userId) => {
      if (userId !== 'local' && peer.stream) {
        peerMap.set(userId, {
          id: userId,
          connection: null, // Not used in MediaSoup
          stream: peer.stream,
          isLoading: peer.isLoading,
        });
      }
    });

    return peerMap;
  }, [state.peers]);

  return {
    peers,
    isConnected: state.isConnected,
    isLoading: state.isLoading,
    device: state.device,
  };
};
