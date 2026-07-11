import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import { SOCKET_EVENTS } from '@/lib/constants';


interface MediaSoupPeer {
  id: string;
  sendTransport: mediasoupClient.types.Transport | null;
  recvTransport: mediasoupClient.types.Transport | null;
  producers: Map<string, mediasoupClient.types.Producer>;
  consumers: Map<string, mediasoupClient.types.Consumer>;
  stream: MediaStream | null;
  isLoading: boolean;
}

interface ScreenShareState {
  stream: MediaStream | null;
  sharingUserId: string | null;
  videoProducer: mediasoupClient.types.Producer | null;
  audioProducer: mediasoupClient.types.Producer | null;
  videoConsumer: mediasoupClient.types.Consumer | null;
  audioConsumer: mediasoupClient.types.Consumer | null;
}

interface MediaSoupState {
  device: mediasoupClient.types.Device | null;
  rtpCapabilities: mediasoupClient.types.RtpCapabilities | null;
  peers: Map<string, MediaSoupPeer>;
  isConnected: boolean;
  isLoading: boolean;
  screenShare: ScreenShareState;
}

export const useMediaSoup = (
  socket: Socket | null,
  localStream: MediaStream | null,
  roomId: string | undefined,
  currentUserId: string | undefined,
  onParticipantInfoUpdate?: (
    info: Record<string, { email: string; userId: string }>
  ) => void,
  onParticipantInfoRemove?: (userId: string) => void
) => {
  const [state, setState] = useState<MediaSoupState>({
    device: null,
    rtpCapabilities: null,
    peers: new Map(),
    isConnected: false,
    isLoading: false,
    screenShare: {
      stream: null,
      sharingUserId: null,
      videoProducer: null,
      audioProducer: null,
      videoConsumer: null,
      audioConsumer: null,
    },
  });

  // Track media state for each peer
  const [peerMediaState, setPeerMediaState] = useState<
    Map<string, { audioEnabled: boolean; videoEnabled: boolean }>
  >(new Map());

  const stateRef = useRef(state);
  stateRef.current = state;

  // CRITICAL FIX: Track consumed producers to prevent duplicates
  const consumedProducers = useRef(new Set<string>());

  // Track transport creation to prevent race conditions
  const creatingTransports = useRef(new Set<string>());

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

        return device;
      } catch (error) {
        console.error('Failed to initialize MediaSoup device:', error);
        updateState({ isLoading: false });
        throw error;
      }
    },
    [updateState]
  );

  // Create send transport
  const createSendTransport = useCallback(
    async (roomId: string, device: mediasoupClient.types.Device) => {
      if (!socket || !device) {
        throw new Error('Socket or device not available');
      }

      const transportData = await new Promise<{
        id: string;
        iceParameters: any;
        iceCandidates: any[];
        dtlsParameters: any;
      }>((resolve, reject) => {
        socket.emit(SOCKET_EVENTS.MEDIASOUP_CREATE_TRANSPORT, {
          roomId,
          direction: 'send',
        });

        socket.once('transport-created', resolve);
        socket.once(SOCKET_EVENTS.ERROR, reject);
      });

      const sendTransport = device.createSendTransport({
        id: transportData.id,
        iceParameters: transportData.iceParameters,
        iceCandidates: transportData.iceCandidates,
        dtlsParameters: transportData.dtlsParameters,
      });

      // Handle transport connection
      sendTransport.on(
        SOCKET_EVENTS.CONNECT,
        async ({ dtlsParameters }, callback, errback) => {
          try {
            await new Promise<void>((resolve, reject) => {
              socket.emit(SOCKET_EVENTS.MEDIASOUP_CONNECT_TRANSPORT, {
                roomId,
                transportId: transportData.id,
                dtlsParameters,
              });

              socket.once('transport-connected', () => {
                callback();
                resolve();
              });
              socket.once(SOCKET_EVENTS.ERROR, reject);
            });
          } catch (error) {
            errback(error as Error);
          }
        }
      );

      // Handle produce events
      sendTransport.on(
        'produce',
        async ({ kind, rtpParameters, appData }, callback, errback) => {
          try {
            const producerData = await new Promise<{ id: string }>(
              (resolve, reject) => {
                socket.emit(SOCKET_EVENTS.MEDIASOUP_CREATE_PRODUCER, {
                  roomId,
                  transportId: transportData.id,
                  rtpParameters,
                  kind,
                  appData, // Forward appData to server for screen share identification
                });

                socket.once('producer-created', resolve);
                socket.once(SOCKET_EVENTS.ERROR, reject);
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
    async (roomId: string, device: mediasoupClient.types.Device) => {
      if (!socket || !device) {
        throw new Error('Socket or device not available');
      }

      const transportData = await new Promise<{
        id: string;
        iceParameters: any;
        iceCandidates: any[];
        dtlsParameters: any;
      }>((resolve, reject) => {
        socket.emit(SOCKET_EVENTS.MEDIASOUP_CREATE_TRANSPORT, {
          roomId,
          direction: 'recv',
        });

        socket.once('transport-created', resolve);
        socket.once(SOCKET_EVENTS.ERROR, reject);
      });

      const recvTransport = device.createRecvTransport({
        id: transportData.id,
        iceParameters: transportData.iceParameters,
        iceCandidates: transportData.iceCandidates,
        dtlsParameters: transportData.dtlsParameters,
      });

      // Handle transport connection
      recvTransport.on(
        SOCKET_EVENTS.CONNECT,
        async ({ dtlsParameters }, callback, errback) => {
          try {
            await new Promise<void>((resolve, reject) => {
              socket.emit(SOCKET_EVENTS.MEDIASOUP_CONNECT_TRANSPORT, {
                roomId,
                transportId: transportData.id,
                dtlsParameters,
              });

              socket.once('transport-connected', () => {
                callback();
                resolve();
              });
              socket.once(SOCKET_EVENTS.ERROR, reject);
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
    async (
      roomId: string,
      stream: MediaStream,
      device: mediasoupClient.types.Device
    ) => {
      if (!device || !stream) return;

      try {
        const audioTrack = stream.getAudioTracks()[0];
        const videoTrack = stream.getVideoTracks()[0];

        // CRITICAL FIX: canProduce is a Device method, not Transport method
        const canProduceAudio = audioTrack && device.canProduce('audio');
        const canProduceVideo = videoTrack && device.canProduce('video');

        if (!canProduceAudio && !canProduceVideo) {
          return;
        }

        // Create transport
        const sendTransport = await createSendTransport(roomId, device);

        let audioProducer: mediasoupClient.types.Producer | null = null;
        let videoProducer: mediasoupClient.types.Producer | null = null;

        // Produce audio
        if (canProduceAudio && audioTrack) {
          audioProducer = await sendTransport.produce({ track: audioTrack });
        }

        // Produce video
        if (canProduceVideo && videoTrack) {
          videoProducer = await sendTransport.produce({ track: videoTrack });
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
      } catch (error) {
        console.error('Failed to produce local stream:', error);
        throw error;
      }
    },
    [createSendTransport, updatePeers]
  );

  // Produce screen share stream
  const produceScreenStream = useCallback(
    async (screenStream: MediaStream) => {
      if (!socket || !roomId || !screenStream) {
        console.warn('Cannot produce screen stream: missing requirements');
        return;
      }

      try {
        const device = stateRef.current.device;
        if (!device) {
          throw new Error('MediaSoup device not initialized');
        }

        // Get local peer's send transport (reuse existing transport!)
        const localPeer = stateRef.current.peers.get('local');
        let sendTransport = localPeer?.sendTransport;

        // Create transport if not exists
        if (!sendTransport) {
          sendTransport = await createSendTransport(roomId, device);
        }

        const videoTrack = screenStream.getVideoTracks()[0];
        const audioTrack = screenStream.getAudioTracks()[0];

        let videoProducer: mediasoupClient.types.Producer | null = null;
        let audioProducer: mediasoupClient.types.Producer | null = null;

        // Produce screen video
        if (videoTrack && device.canProduce('video')) {
          videoProducer = await sendTransport.produce({
            track: videoTrack,
            encodings: [
              {
                maxBitrate: 3000000, // 3 Mbps for screen share
                scaleResolutionDownBy: 1.0,
              },
            ],
            appData: {
              source: 'screen',
              mediaType: 'screen-video',
            },
          });

          console.log('✅ Screen video producer created:', videoProducer.id);
        }

        // Produce screen audio (if available)
        if (audioTrack && device.canProduce('audio')) {
          audioProducer = await sendTransport.produce({
            track: audioTrack,
            appData: {
              source: 'screen',
              mediaType: 'screen-audio',
            },
          });

          console.log('✅ Screen audio producer created:', audioProducer.id);
        }

        // Update screen share state
        setState((prev) => ({
          ...prev,
          screenShare: {
            ...prev.screenShare,
            stream: screenStream,
            sharingUserId: currentUserId || null,
            videoProducer,
            audioProducer,
          },
        }));

        return { videoProducer, audioProducer };
      } catch (error) {
        console.error('Failed to produce screen stream:', error);
        throw error;
      }
    },
    [socket, roomId, currentUserId, createSendTransport]
  );

  // Stop screen share production
  const stopScreenProduction = useCallback(async () => {
    try {
      const { videoProducer, audioProducer } = stateRef.current.screenShare;

      if (videoProducer) {
        videoProducer.close();
        console.log('✅ Screen video producer closed');
      }

      if (audioProducer) {
        audioProducer.close();
        console.log('✅ Screen audio producer closed');
      }

      // Clear screen share state
      setState((prev) => ({
        ...prev,
        screenShare: {
          stream: null,
          sharingUserId: null,
          videoProducer: null,
          audioProducer: null,
          videoConsumer: prev.screenShare.videoConsumer,
          audioConsumer: prev.screenShare.audioConsumer,
        },
      }));
    } catch (error) {
      console.error('Failed to stop screen production:', error);
    }
  }, []);

  // Consume screen share stream
  const consumeScreenStream = useCallback(
    async (producerId: string, userId: string, mediaType: string) => {
      if (!socket || !roomId) {
        console.warn('Cannot consume screen stream: missing socket or roomId');
        return;
      }

      try {
        const device = stateRef.current.device;
        if (!device) {
          throw new Error('MediaSoup device not initialized');
        }

        // Get or create receive transport
        let recvTransport = stateRef.current.peers.get('local')?.recvTransport;
        if (!recvTransport) {
          recvTransport = await createRecvTransport(roomId, device);
        }

        // Request consumer from server
        socket.emit(SOCKET_EVENTS.MEDIASOUP_CREATE_CONSUMER, {
          roomId,
          transportId: recvTransport.id,
          producerId,
          rtpCapabilities: device.rtpCapabilities,
        });

        // Wait for consumer creation response
        const consumerData: any = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Consumer creation timeout'));
          }, 10000);

          socket.once(SOCKET_EVENTS.CONSUMER_CREATED, (data) => {
            clearTimeout(timeout);
            resolve(data);
          });
        });

        // Create consumer
        const consumer = await recvTransport.consume({
          id: consumerData.id,
          producerId: consumerData.producerId,
          kind: consumerData.kind,
          rtpParameters: consumerData.rtpParameters,
        });

        // Update screen share state based on media type
        setState((prev) => {
          const screenShare = { ...prev.screenShare };

          if (mediaType === 'screen-video') {
            screenShare.videoConsumer = consumer;
            screenShare.sharingUserId = userId;
          } else if (mediaType === 'screen-audio') {
            screenShare.audioConsumer = consumer;
          }

          // Build screen stream if we have video
          if (screenShare.videoConsumer) {
            const tracks = [screenShare.videoConsumer.track];
            if (screenShare.audioConsumer) {
              tracks.push(screenShare.audioConsumer.track);
            }
            screenShare.stream = new MediaStream(tracks);
          }

          return { ...prev, screenShare };
        });

        console.log('✅ Screen consumer created:', {
          consumerId: consumer.id,
          mediaType,
          userId,
        });

        return consumer;
      } catch (error) {
        console.error('Failed to consume screen stream:', error);
        throw error;
      }
    },
    [socket, roomId, createRecvTransport]
  );

  // Stop screen consumption
  const stopScreenConsumption = useCallback(() => {
    const { videoConsumer, audioConsumer } = stateRef.current.screenShare;

    if (videoConsumer) {
      videoConsumer.close();
      console.log('✅ Screen video consumer closed');
    }

    if (audioConsumer) {
      audioConsumer.close();
      console.log('✅ Screen audio consumer closed');
    }

    setState((prev) => ({
      ...prev,
      screenShare: {
        stream: null,
        sharingUserId: null,
        videoProducer: prev.screenShare.videoProducer,
        audioProducer: prev.screenShare.audioProducer,
        videoConsumer: null,
        audioConsumer: null,
      },
    }));
  }, []);

  // Consume remote stream
  const consumeRemoteStream = useCallback(
    async (
      roomId: string,
      producerId: string,
      userId: string,
      device: mediasoupClient.types.Device
    ) => {
      if (!device || !socket) return;

      try {
        // CRITICAL FIX: Prevent duplicate consumption using Set
        if (consumedProducers.current.has(producerId)) {
          return;
        }

        // Mark as consumed immediately to prevent race conditions
        consumedProducers.current.add(producerId);

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

        // CRITICAL FIX: Prevent concurrent transport creation race condition
        let recvTransport = peer.recvTransport;

        if (!recvTransport) {
          // Check if we're already creating a transport for this user
          if (creatingTransports.current.has(userId)) {
            // Wait for the other call to finish creating the transport
            let attempts = 0;
            while (!recvTransport && attempts < 20) {
              await new Promise((resolve) => setTimeout(resolve, 50));
              peer = stateRef.current.peers.get(userId) || peer;
              recvTransport = peer.recvTransport;
              attempts++;
            }

            if (!recvTransport) {
              throw new Error(
                `Timeout waiting for transport creation for user ${userId}`
              );
            }
          } else {
            creatingTransports.current.add(userId);

            try {
              recvTransport = await createRecvTransport(roomId, device);
              updatePeers(userId, { recvTransport });

              // Update local peer reference
              peer = stateRef.current.peers.get(userId) || peer;
              peer.recvTransport = recvTransport;
            } finally {
              creatingTransports.current.delete(userId);
            }
          }
        }

        // CRITICAL FIX: Create unique event handlers to avoid cross-contamination
        const consumerData = await new Promise<{
          id: string;
          producerId: string;
          kind: string;
          rtpParameters: any;
          type: string;
          producerPaused: boolean;
        }>((resolve, reject) => {
          let resolved = false;

          const handleConsumerCreated = (data: any) => {
            // Ensure this response is for OUR producer
            if (data.producerId === producerId) {
              if (!resolved) {
                resolved = true;
                socket.off(SOCKET_EVENTS.CONSUMER_CREATED, handleConsumerCreated);
                socket.off(SOCKET_EVENTS.ERROR, handleError);
                clearTimeout(timeoutId);
                resolve(data);
              }
            }
          };

          const handleError = (error: any) => {
            if (!resolved) {
              resolved = true;
              socket.off(SOCKET_EVENTS.CONSUMER_CREATED, handleConsumerCreated);
              socket.off(SOCKET_EVENTS.ERROR, handleError);
              clearTimeout(timeoutId);
              reject(error);
            }
          };

          // Timeout after 10 seconds
          const timeoutId = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              socket.off(SOCKET_EVENTS.CONSUMER_CREATED, handleConsumerCreated);
              socket.off(SOCKET_EVENTS.ERROR, handleError);
              reject(
                new Error(
                  `Timeout waiting for consumer-created for producer ${producerId}`
                )
              );
            }
          }, 10000);

          socket.on(SOCKET_EVENTS.CONSUMER_CREATED, handleConsumerCreated);
          socket.on(SOCKET_EVENTS.ERROR, handleError);

          socket.emit(SOCKET_EVENTS.MEDIASOUP_CREATE_CONSUMER, {
            roomId,
            transportId: recvTransport!.id,
            producerId,
            rtpCapabilities: device.rtpCapabilities,
          });
        });

        const consumer = await recvTransport!.consume({
          id: consumerData.id,
          producerId: consumerData.producerId,
          kind: consumerData.kind as 'audio' | 'video',
          rtpParameters: consumerData.rtpParameters,
        });

        // Get latest peer reference
        peer = stateRef.current.peers.get(userId) || peer;

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
      } catch (error) {
        console.error(`Failed to consume remote stream for ${userId}:`, error);
        // Remove from consumed set on error to allow retry
        consumedProducers.current.delete(producerId);
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
      existingProducers?: Array<{
        id: string;
        userId: string;
        kind: 'audio' | 'video';
        source?: string;
        mediaType?: string;
      }>;
      screenSharing?: {
        userId: string;
        videoProducerId?: string;
        audioProducerId?: string;
      } | null;
    }) => {
      console.log('📡 Received room data:', data);

      if (!data.mediaSoupEnabled) {
        console.warn('⚠️ MediaSoup not enabled in room');
        return;
      }

      try {
        // CRITICAL FIX: Capture device directly to avoid race condition
        const device = await initializeDevice(data.rtpCapabilities);
        updateState({ isConnected: true });

        // Update participant info
        if (data.participantInfo && onParticipantInfoUpdate) {
          onParticipantInfoUpdate(data.participantInfo);
        }

        // CRITICAL FIX: Update peer media states
        if (data.mediaState) {
          const newMediaState = new Map<
            string,
            { audioEnabled: boolean; videoEnabled: boolean }
          >();
          Object.entries(data.mediaState).forEach(([userId, state]) => {
            newMediaState.set(
              userId,
              state as { audioEnabled: boolean; videoEnabled: boolean }
            );
          });
          setPeerMediaState(newMediaState);
        }

        // Produce local stream if available - pass device directly
        if (localStream && roomId && device) {
          await produceLocalStream(roomId, localStream, device);
        }

        // CRITICAL FIX: Consume existing producers in the room
        if (
          data.existingProducers &&
          data.existingProducers.length > 0 &&
          device &&
          roomId
        ) {
          for (const producer of data.existingProducers) {
            // Skip our own producers
            if (producer.userId === currentUserId) {
              continue;
            }

            // Check if this is a screen share producer
            if (producer.source === 'screen' && producer.mediaType) {
              await consumeScreenStream(
                producer.id,
                producer.userId,
                producer.mediaType
              );
            } else {
              // Regular camera/mic producer
              await consumeRemoteStream(
                roomId,
                producer.id,
                producer.userId,
                device
              );
            }
          }
        }

        // Handle screen sharing info from room data
        if (data.screenSharing && data.screenSharing.userId !== currentUserId) {
          console.log('📺 Active screen share detected:', data.screenSharing);
          // Consumers will be created from existing producers above
        }
      } catch (error) {
        console.error('Failed to handle room data:', error);
        updateState({ isConnected: false });
      }
    };

    // Handle new producer
    const handleNewProducer = (data: {
      producerId: string;
      userId: string;
      kind: 'audio' | 'video';
      source?: string;
      mediaType?: string;
    }) => {
      // CRITICAL FIX: Skip our own producers using actual userId
      if (data.userId === currentUserId) {
        return;
      }

      // Use device from state (safe after initialization)
      const device = stateRef.current.device;
      if (roomId && device) {
        // Check if this is a screen share producer
        if (data.source === 'screen' && data.mediaType) {
          // Consume screen stream
          consumeScreenStream(data.producerId, data.userId, data.mediaType);
        } else {
          // Consume regular camera/mic stream
          consumeRemoteStream(roomId, data.producerId, data.userId, device);
        }
      }
    };

    // Handle user joined
    const handleUserJoined = (data: {
      userId: string;
      userEmail: string;
      participantInfo?: {
        email: string;
        userId: string;
        name?: string;
        useNameInMeetings?: boolean;
      };
      mediaState?: {
        audioEnabled: boolean;
        videoEnabled: boolean;
      };
    }) => {
      // CRITICAL FIX: Update participant info for display names
      if (data.participantInfo && onParticipantInfoUpdate) {
        const info: Record<string, any> = {};
        info[data.userId] = data.participantInfo;
        onParticipantInfoUpdate(info);
      }

      // CRITICAL FIX: Update media state
      if (data.mediaState) {
        setPeerMediaState((prev) => {
          const newState = new Map(prev);
          newState.set(data.userId, data.mediaState!);
          return newState;
        });
      }
    };

    // Handle user left
    const handleUserLeft = (userId: string) => {
      // Clean up participant info
      if (onParticipantInfoRemove) {
        onParticipantInfoRemove(userId);
      }

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

          // Close consumers and remove from consumed set
          peer.consumers.forEach((consumer) => {
            consumer.close();
            consumedProducers.current.delete(consumer.producerId);
          });

          newPeers.delete(userId);
        }

        // Clean up transport creation tracking
        creatingTransports.current.delete(userId);

        return { ...prev, peers: newPeers };
      });
    };

    // Handle media state updates
    const handleMediaStateUpdate = (data: {
      userId: string;
      audioEnabled: boolean;
      videoEnabled: boolean;
    }) => {
      // CRITICAL FIX: Update peer media state
      setPeerMediaState((prev) => {
        const newState = new Map(prev);
        newState.set(data.userId, {
          audioEnabled: data.audioEnabled,
          videoEnabled: data.videoEnabled,
        });
        return newState;
      });
    };

    // Handle screen share events
    const handleScreenShareStarted = (data: { userId: string }) => {
      console.log('📺 Screen share started by:', data.userId);
      // Update screen share state to track who's sharing
      setState((prev) => ({
        ...prev,
        screenShare: {
          ...prev.screenShare,
          sharingUserId: data.userId,
        },
      }));
    };

    const handleScreenShareStopped = (data: { userId: string }) => {
      console.log('📺 Screen share stopped by:', data.userId);

      // If we're the viewer, close consumers
      if (data.userId !== currentUserId) {
        stopScreenConsumption();
      }

      // Clear sharing user
      setState((prev) => ({
        ...prev,
        screenShare: {
          ...prev.screenShare,
          sharingUserId: null,
        },
      }));
    };

    const handleError = (error: { message: string }) => {
      console.error('MediaSoup error:', error);
      updateState({ isConnected: false, isLoading: false });
    };

    // Register event listeners
    socket.on(SOCKET_EVENTS.ROOM_DATA, handleRoomData);
    socket.on(SOCKET_EVENTS.NEW_PRODUCER, handleNewProducer);
    socket.on(SOCKET_EVENTS.USER_JOINED, handleUserJoined);
    socket.on(SOCKET_EVENTS.PARTICIPANT_JOINED, handleUserJoined); // CRITICAL FIX: Also handle participant-joined
    socket.on(SOCKET_EVENTS.USER_LEFT, handleUserLeft);
    socket.on(SOCKET_EVENTS.MEDIA_STATE_UPDATE, handleMediaStateUpdate);
    socket.on(SOCKET_EVENTS.SCREEN_SHARE_STARTED, handleScreenShareStarted);
    socket.on(SOCKET_EVENTS.SCREEN_SHARE_STOPPED, handleScreenShareStopped);
    socket.on(SOCKET_EVENTS.ERROR, handleError);

    // Cleanup
    return () => {
      socket.off(SOCKET_EVENTS.ROOM_DATA, handleRoomData);
      socket.off(SOCKET_EVENTS.NEW_PRODUCER, handleNewProducer);
      socket.off(SOCKET_EVENTS.USER_JOINED, handleUserJoined);
      socket.off(SOCKET_EVENTS.PARTICIPANT_JOINED, handleUserJoined);
      socket.off(SOCKET_EVENTS.USER_LEFT, handleUserLeft);
      socket.off(SOCKET_EVENTS.MEDIA_STATE_UPDATE, handleMediaStateUpdate);
      socket.off(SOCKET_EVENTS.SCREEN_SHARE_STARTED, handleScreenShareStarted);
      socket.off(SOCKET_EVENTS.SCREEN_SHARE_STOPPED, handleScreenShareStopped);
      socket.off(SOCKET_EVENTS.ERROR, handleError);

      // Cleanup all peers
      stateRef.current.peers.forEach((peer) => {
        peer.sendTransport?.close();
        peer.recvTransport?.close();
        peer.producers.forEach((producer) => producer.close());
        peer.consumers.forEach((consumer) => consumer.close());
      });

      // Cleanup screen share
      const { videoProducer, audioProducer, videoConsumer, audioConsumer } =
        stateRef.current.screenShare;
      videoProducer?.close();
      audioProducer?.close();
      videoConsumer?.close();
      audioConsumer?.close();

      // Clear tracking sets
      consumedProducers.current.clear();
      creatingTransports.current.clear();

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
    roomId,
    currentUserId,
    initializeDevice,
    produceLocalStream,
    consumeRemoteStream,
    updateState,
    onParticipantInfoUpdate,
    onParticipantInfoRemove,
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
    peerMediaState,
    isConnected: state.isConnected,
    isLoading: state.isLoading,
    device: state.device,
    // Screen share functions and state
    screenShareStream: state.screenShare.stream,
    screenSharingUserId: state.screenShare.sharingUserId,
    produceScreenStream,
    stopScreenProduction,
    consumeScreenStream,
    stopScreenConsumption,
  };
};
