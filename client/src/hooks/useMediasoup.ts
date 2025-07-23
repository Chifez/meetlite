import { useState, useRef, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { Device } from 'mediasoup-client';
import { Transport, Producer, Consumer } from 'mediasoup-client/types';

// Types
interface MediasoupPeer {
  id: string;
  stream: MediaStream | null;
  isLoading: boolean;
}

interface MediaState {
  audioEnabled: boolean;
  videoEnabled: boolean;
}

interface UseMediasoupProps {
  socket: Socket | null;
  localStream: MediaStream | null;
  onParticipantInfoUpdate?: (
    info: Record<string, { email: string; userId: string }>
  ) => void;
}

interface ProducerInfo {
  kind: 'audio' | 'video' | 'screen-video' | 'screen-audio';
  producer: Producer | null;
  paused: boolean;
}

interface ConsumerInfo {
  consumer: Consumer;
  participantId: string;
  kind: string;
  stream: MediaStream;
}

export const useMediasoup = ({
  socket,
  localStream,
  onParticipantInfoUpdate,
}: UseMediasoupProps) => {
  // State
  const [peers, setPeers] = useState<Map<string, MediasoupPeer>>(new Map());
  const [peerMediaState, setPeerMediaState] = useState<Map<string, MediaState>>(
    new Map()
  );
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<
    'connecting' | 'connected' | 'failed' | 'disconnected'
  >('disconnected');

  // Refs
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const producersRef = useRef<Map<string, ProducerInfo>>(new Map());
  const consumersRef = useRef<Map<string, ConsumerInfo>>(new Map());
  const roomIdRef = useRef<string | null>(null);

  // Debug logging
  const debug = useCallback((message: string, data?: any) => {
    console.log(`🔧 [Mediasoup Debug] ${message}`, data || '');
  }, []);

  // 🔍 LOGGING: Connection state changes
  useEffect(() => {
    console.log('🔗 [Mediasoup] Connection state update:', {
      isConnected,
      connectionState,
      peerCount: peers.size,
      hasSocket: !!socket,
      hasLocalStream: !!localStream,
    });
  }, [isConnected, connectionState, peers.size, socket, localStream]);

  // Utility function to update peers state
  const updatePeersState = useCallback(() => {
    debug('Updating peers state', {
      consumerCount: consumersRef.current.size,
      consumers: Array.from(consumersRef.current.keys()),
    });

    const peerMap = new Map<string, MediasoupPeer>();

    // Group consumers by participant
    const participantStreams = new Map<string, MediaStream[]>();

    for (const [consumerId, consumerInfo] of consumersRef.current) {
      const { participantId, stream } = consumerInfo;

      if (!participantStreams.has(participantId)) {
        participantStreams.set(participantId, []);
      }
      participantStreams.get(participantId)!.push(stream);
    }

    // Create peers from grouped streams
    for (const [participantId, streams] of participantStreams) {
      // Combine all tracks from this participant into one stream
      const combinedStream = new MediaStream();
      streams.forEach((stream) => {
        stream.getTracks().forEach((track) => {
          combinedStream.addTrack(track);
        });
      });

      peerMap.set(participantId, {
        id: participantId,
        stream: combinedStream,
        isLoading: false,
      });
    }

    debug('Updated peers state', {
      peerCount: peerMap.size,
      participantIds: Array.from(peerMap.keys()),
    });

    setPeers(peerMap);
  }, [debug]);

  // Initialize mediasoup device
  const initializeDevice = useCallback(
    async (rtpCapabilities: any) => {
      try {
        debug('Initializing device...');

        const device = new Device();
        await device.load({ routerRtpCapabilities: rtpCapabilities });

        deviceRef.current = device;
        debug('Device initialized successfully', {
          canProduce: device.canProduce('video'),
          rtpCapabilities: !!device.rtpCapabilities,
        });

        return device;
      } catch (error) {
        console.error('❌ [Mediasoup] Failed to initialize device:', error);
        setConnectionState('failed');
        throw error;
      }
    },
    [debug]
  );

  // Create WebRTC transport
  const createTransport = useCallback(
    async (roomId: string, direction: 'send' | 'recv') => {
      try {
        if (!socket) {
          throw new Error('Socket not available');
        }

        debug(`Creating ${direction} transport...`);

        // Request transport creation from server
        socket.emit('create-webrtc-transport', { roomId, direction });

        return new Promise<Transport>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`${direction} transport creation timeout`));
          }, 10000);

          socket.once('webrtc-transport-created', async (data) => {
            clearTimeout(timeout);

            try {
              const {
                id,
                iceParameters,
                iceCandidates,
                dtlsParameters,
                direction: responseDirection,
              } = data;

              // Only handle the response for the direction we requested
              if (responseDirection !== direction) {
                return;
              }

              debug(`${direction} transport parameters received`, {
                id,
                hasIceParams: !!iceParameters,
              });

              if (!deviceRef.current) {
                throw new Error('Device not initialized');
              }

              let transport: Transport;

              if (direction === 'send') {
                // Create send transport for producing
                transport = deviceRef.current.createSendTransport({
                  id,
                  iceParameters,
                  iceCandidates,
                  dtlsParameters,
                });

                // Handle produce event
                transport.on(
                  'produce',
                  async (parameters, callback, errback) => {
                    try {
                      debug(`Producing ${parameters.kind}...`);

                      socket.emit('create-producer', {
                        kind: parameters.kind,
                        rtpParameters: parameters.rtpParameters,
                        appData: parameters.appData,
                      });

                      socket.once('producer-created', (data) => {
                        debug('Producer created', data);
                        callback({ id: data.producerId });
                      });

                      setTimeout(() => {
                        errback(new Error('Producer creation timeout'));
                      }, 5000);
                    } catch (error) {
                      console.error(
                        '❌ [Mediasoup] Producer creation error:',
                        error instanceof Error
                          ? error
                          : new Error(String(error))
                      );
                      errback(
                        error instanceof Error
                          ? error
                          : new Error(String(error))
                      );
                    }
                  }
                );

                sendTransportRef.current = transport;
              } else {
                // Create receive transport for consuming
                transport = deviceRef.current.createRecvTransport({
                  id,
                  iceParameters,
                  iceCandidates,
                  dtlsParameters,
                });

                recvTransportRef.current = transport;
              }

              // Handle transport events (common for both)
              transport.on(
                'connect',
                async ({ dtlsParameters }, callback, errback) => {
                  try {
                    debug(`Connecting ${direction} transport...`);
                    socket.emit('connect-webrtc-transport', {
                      dtlsParameters,
                      direction,
                    });
                    callback();
                  } catch (error) {
                    console.error(
                      `❌ [Mediasoup] ${direction} transport connect error:`,
                      error instanceof Error ? error : new Error(String(error))
                    );
                    errback(
                      error instanceof Error ? error : new Error(String(error))
                    );
                  }
                }
              );

              transport.on('connectionstatechange', (state) => {
                console.log(
                  `🔗 [Mediasoup] ${direction} transport connection state changed:`,
                  {
                    state,
                    direction,
                    transportId: transport.id,
                    currentIsConnected: isConnected,
                  }
                );

                debug(`${direction} transport connection state: ${state}`);

                if (direction === 'send' && state === 'connected') {
                  console.log(
                    '🎉 [Mediasoup] SEND TRANSPORT CONNECTED! Setting isConnected = true'
                  );
                  setIsConnected(true);
                  setConnectionState('connected');
                } else if (state === 'failed' || state === 'disconnected') {
                  console.log(
                    `❌ [Mediasoup] ${direction} transport ${state}! Setting isConnected = false`
                  );
                  setIsConnected(false);
                  setConnectionState(state as any);
                }
              });

              debug(`${direction} transport created successfully`);
              resolve(transport);
            } catch (error) {
              console.error(
                `❌ [Mediasoup] Failed to create ${direction} transport:`,
                error
              );
              reject(error);
            }
          });

          socket.once('error', (error) => {
            clearTimeout(timeout);
            reject(
              new Error(
                error.message || `${direction} transport creation failed`
              )
            );
          });
        });
      } catch (error) {
        console.error(
          `❌ [Mediasoup] ${direction} transport creation failed:`,
          error
        );
        setConnectionState('failed');
        throw error;
      }
    },
    [socket, debug, isConnected]
  );

  // Create producer for local media
  const createProducer = useCallback(
    async (track: MediaStreamTrack, appData?: any) => {
      try {
        if (!sendTransportRef.current) {
          throw new Error('Send transport not available');
        }

        debug(`Creating ${track.kind} producer...`);

        const producer = await sendTransportRef.current.produce({
          track,
          appData,
        });

        const producerInfo: ProducerInfo = {
          kind: track.kind as 'audio' | 'video',
          producer,
          paused: track.enabled === false,
        };

        // Adjust kind for screen sharing
        if (appData?.screen) {
          producerInfo.kind =
            track.kind === 'video' ? 'screen-video' : 'screen-audio';
        }

        producersRef.current.set(producerInfo.kind, producerInfo);

        // Handle producer events
        producer.on('@close', () => {
          debug(`Producer ${producer.id} closed`);
          producersRef.current.delete(producerInfo.kind);
        });

        producer.on('@pause', () => {
          debug(`Producer ${producer.id} paused`);
          const info = producersRef.current.get(producerInfo.kind);
          if (info) {
            info.paused = true;
          }
        });

        producer.on('@resume', () => {
          debug(`Producer ${producer.id} resumed`);
          const info = producersRef.current.get(producerInfo.kind);
          if (info) {
            info.paused = false;
          }
        });

        debug(`${track.kind} producer created: ${producer.id}`);
        return producer;
      } catch (error) {
        console.error(
          `❌ [Mediasoup] Failed to create ${track.kind} producer:`,
          error
        );
        throw error;
      }
    },
    [debug]
  );

  // Handle new consumer from server
  const handleNewConsumer = useCallback(
    async (data: any) => {
      try {
        const {
          participantId,
          producerId,
          consumerId,
          kind,
          rtpParameters,
          producerPaused,
        } = data;

        debug('Handling new consumer', { participantId, consumerId, kind });

        if (!deviceRef.current || !recvTransportRef.current) {
          console.error(
            '❌ [Mediasoup] Device or receive transport not available for consumer'
          );
          return;
        }

        // Create consumer using the receive transport
        const consumer = await recvTransportRef.current.consume({
          id: consumerId,
          producerId,
          kind,
          rtpParameters,
        });

        // Create stream from consumer
        const stream = new MediaStream([consumer.track]);

        const consumerInfo: ConsumerInfo = {
          consumer,
          participantId,
          kind,
          stream,
        };

        consumersRef.current.set(consumerId, consumerInfo);

        // Handle consumer events
        consumer.on('@close', () => {
          debug(`Consumer ${consumerId} closed`);
          consumersRef.current.delete(consumerId);
          updatePeersState();
        });

        // Resume consumer to start receiving media
        if (socket) {
          debug(`Resuming consumer ${consumerId}`);
          socket.emit('resume-consumer', { consumerId });
        }

        debug(`Consumer created: ${consumerId}`, { participantId, kind });
        console.log('🎉 [Mediasoup] PEER CONNECTION ESTABLISHED!', {
          participantId,
          consumerId,
          kind,
          totalPeers: consumersRef.current.size,
        });
        updatePeersState();
      } catch (error) {
        console.error('❌ [Mediasoup] Failed to handle new consumer:', error);
        debug('Consumer creation failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [socket, updatePeersState, debug]
  );

  // Handle consumer events
  const handleConsumerEvents = useCallback(() => {
    if (!socket) return;

    debug('Setting up consumer event handlers');

    socket.on('new-consumer', (data) => {
      debug('Received new-consumer event', data);
      handleNewConsumer(data);
    });

    socket.on('consumer-closed', (data) => {
      const { consumerId } = data;
      debug(`Consumer ${consumerId} closed by server`);

      const consumerInfo = consumersRef.current.get(consumerId);
      if (consumerInfo) {
        consumerInfo.consumer.close();
        consumersRef.current.delete(consumerId);
        updatePeersState();
      }
    });

    socket.on('consumer-producer-paused', (data) => {
      debug(`Producer paused for consumer ${data.consumerId}`);
    });

    socket.on('consumer-producer-resumed', (data) => {
      debug(`Producer resumed for consumer ${data.consumerId}`);
    });

    socket.on('consumer-resumed', (data) => {
      debug(`Consumer resumed: ${data.consumerId}`);
    });

    return () => {
      socket.off('new-consumer');
      socket.off('consumer-closed');
      socket.off('consumer-producer-paused');
      socket.off('consumer-producer-resumed');
      socket.off('consumer-resumed');
    };
  }, [socket, handleNewConsumer, updatePeersState, debug]);

  // Join room and initialize mediasoup
  const joinRoom = useCallback(
    async (roomId: string) => {
      try {
        console.log('🚀 [Mediasoup] JOIN ROOM FLOW STARTED:', {
          roomId,
          hasSocket: !!socket,
          socketConnected: socket?.connected,
          socketId: socket?.id,
        });

        if (!socket) {
          throw new Error('Socket not available');
        }

        roomIdRef.current = roomId;
        setConnectionState('connecting');

        debug(`Joining room: ${roomId}`);

        console.log('📡 [Mediasoup] Emitting join-room event to server');
        // Join room on server
        console.log('📡 [Mediasoup] Emitting join-room event:', {
          roomId,
          socketId: socket.id,
        });
        socket.emit('join-room', { roomId });

        // Wait for router RTP capabilities
        return new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.error('⏰ [Mediasoup] Join room TIMEOUT after 10 seconds');
            reject(new Error('Join room timeout'));
          }, 10000);

          console.log('⏳ [Mediasoup] Waiting for router-rtp-capabilities...');

          socket.once('router-rtp-capabilities', async (data) => {
            clearTimeout(timeout);

            try {
              console.log('✅ [Mediasoup] Received router RTP capabilities!', {
                hasRtpCapabilities: !!data.rtpCapabilities,
                codecCount: data.rtpCapabilities?.mediaCodecs?.length || 0,
              });

              debug('Received router RTP capabilities');

              // Initialize device with router capabilities
              console.log('🔧 [Mediasoup] Initializing device...');
              await initializeDevice(data.rtpCapabilities);

              // Create both send and receive transports
              console.log('🚚 [Mediasoup] Creating send transport...');
              await createTransport(roomId, 'send');

              console.log('🚚 [Mediasoup] Creating receive transport...');
              await createTransport(roomId, 'recv');

              // Send our RTP capabilities to server
              console.log('📤 [Mediasoup] Sending RTP capabilities to server');
              socket.emit('set-rtp-capabilities', {
                rtpCapabilities: deviceRef.current!.rtpCapabilities,
              });

              console.log(
                '🎉 [Mediasoup] JOIN ROOM FLOW COMPLETED SUCCESSFULLY!',
                {
                  roomId,
                  hasDevice: !!deviceRef.current,
                  hasSendTransport: !!sendTransportRef.current,
                  hasRecvTransport: !!recvTransportRef.current,
                }
              );

              debug(`Successfully joined room: ${roomId}`);
              resolve();
            } catch (error) {
              console.error('❌ [Mediasoup] Failed to join room:', error);
              setConnectionState('failed');
              reject(error);
            }
          });

          socket.once('error', (error) => {
            clearTimeout(timeout);
            console.error(
              '💥 [Mediasoup] Socket error during room join:',
              error
            );
            reject(new Error(error.message || 'Failed to join room'));
          });
        });
      } catch (error) {
        console.error('❌ [Mediasoup] Join room failed:', error);
        setConnectionState('failed');
        throw error;
      }
    },
    [socket, initializeDevice, createTransport, debug]
  );

  // Produce local media
  const produceMedia = useCallback(async () => {
    try {
      console.log('🎬 [Mediasoup] produceMedia() called with:', {
        hasLocalStream: !!localStream,
        hasSendTransport: !!sendTransportRef.current,
        localStreamTracks: localStream
          ? {
              audio: localStream.getAudioTracks().length,
              video: localStream.getVideoTracks().length,
            }
          : null,
      });

      if (!localStream || !sendTransportRef.current) {
        console.warn('🚫 [Mediasoup] Media production BLOCKED:', {
          hasLocalStream: !!localStream,
          hasSendTransport: !!sendTransportRef.current,
        });
        debug(
          'No local stream or send transport available for media production'
        );
        return;
      }

      debug('Producing local media...');

      // Produce audio track
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        debug('Producing audio track');
        await createProducer(audioTrack);
      }

      // Produce video track
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        debug('Producing video track');
        await createProducer(videoTrack);
      }

      console.log('🎬 [Mediasoup] LOCAL MEDIA PRODUCTION COMPLETE!', {
        audioProduced: !!localStream?.getAudioTracks()[0],
        videoProduced: !!localStream?.getVideoTracks()[0],
        producers: Array.from(producersRef.current.keys()),
      });
      debug('Local media production complete');
    } catch (error) {
      console.error('❌ [Mediasoup] Failed to produce media:', error);
    }
  }, [localStream, createProducer, debug]);

  // Control producer states
  const pauseProducer = useCallback(
    async (kind: string) => {
      const producerInfo = producersRef.current.get(kind);
      if (producerInfo?.producer && !producerInfo.paused) {
        await producerInfo.producer.pause();
        if (socket) {
          socket.emit('pause-producer', { kind });
        }
      }
    },
    [socket]
  );

  const resumeProducer = useCallback(
    async (kind: string) => {
      const producerInfo = producersRef.current.get(kind);
      if (producerInfo?.producer && producerInfo.paused) {
        await producerInfo.producer.resume();
        if (socket) {
          socket.emit('resume-producer', { kind });
        }
      }
    },
    [socket]
  );

  // Setup socket event handlers
  useEffect(() => {
    if (!socket) return;

    debug('Setting up socket event handlers');

    // Handle participant events
    socket.on('participant-joined', (data) => {
      debug(`Participant joined: ${data.participantId}`);
    });

    socket.on('participant-left', (data) => {
      debug(`Participant left: ${data.participantId}`);

      // Remove all consumers for this participant
      for (const [consumerId, consumerInfo] of consumersRef.current) {
        if (consumerInfo.participantId === data.participantId) {
          consumerInfo.consumer.close();
          consumersRef.current.delete(consumerId);
        }
      }
      updatePeersState();
    });

    socket.on('existing-participants', (data) => {
      debug(`Existing participants:`, data.participants);
      // Consumers will be created via 'new-consumer' events
    });

    socket.on('media-state-update', (data) => {
      debug('Media state update', data);
      setPeerMediaState((prev) => {
        const next = new Map(prev);
        next.set(data.userId, {
          audioEnabled: data.audioEnabled,
          videoEnabled: data.videoEnabled,
        });
        return next;
      });
    });

    socket.on('room-data', (data) => {
      debug('Room data received', {
        participants: data.participants,
        mediaStateCount: Object.keys(data.mediaState).length,
      });
      setPeerMediaState(new Map(Object.entries(data.mediaState)));
      if (data.participantInfo && onParticipantInfoUpdate) {
        onParticipantInfoUpdate(data.participantInfo);
      }
    });

    // Setup consumer event handlers
    const cleanupConsumerEvents = handleConsumerEvents();

    return () => {
      debug('Cleaning up socket event handlers');
      socket.off('participant-joined');
      socket.off('participant-left');
      socket.off('existing-participants');
      socket.off('media-state-update');
      socket.off('room-data');
      cleanupConsumerEvents?.();
    };
  }, [
    socket,
    handleConsumerEvents,
    onParticipantInfoUpdate,
    updatePeersState,
    debug,
  ]);

  // Auto-produce media when transport is ready
  useEffect(() => {
    console.log('🎬 [Mediasoup] Auto-produce media check:', {
      isConnected,
      hasLocalStream: !!localStream,
      hasSendTransport: !!sendTransportRef.current,
      localStreamTracks: localStream
        ? {
            audio: localStream.getAudioTracks().length,
            video: localStream.getVideoTracks().length,
          }
        : null,
      shouldProduce: isConnected && localStream && sendTransportRef.current,
    });

    if (isConnected && localStream && sendTransportRef.current) {
      console.log('🚀 [Mediasoup] Triggering media production!');
      debug('Auto-producing media after connection');
      produceMedia();
    } else {
      console.log('⏸️ [Mediasoup] Media production blocked:', {
        reason: !isConnected
          ? 'Not connected'
          : !localStream
          ? 'No local stream'
          : 'No send transport',
      });
    }
  }, [isConnected, localStream, produceMedia, debug]);

  // 🔧 FIX: Retry media production when localStream becomes available after connection
  useEffect(() => {
    console.log('🔄 [Mediasoup] Stream availability check:', {
      hasLocalStream: !!localStream,
      isConnected,
      hasSendTransport: !!sendTransportRef.current,
      hasProducers: producersRef.current.size > 0,
    });

    // If we're connected but have no producers yet, and now we have a stream, produce media
    if (
      isConnected &&
      localStream &&
      sendTransportRef.current &&
      producersRef.current.size === 0
    ) {
      console.log(
        '🚀 [Mediasoup] RETRY: Producing media for late-arriving stream'
      );
      produceMedia();
    }
  }, [localStream, isConnected, produceMedia]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debug('Cleaning up mediasoup hook');

      // Close all producers
      for (const producerInfo of producersRef.current.values()) {
        if (producerInfo.producer) {
          producerInfo.producer.close();
        }
      }
      producersRef.current.clear();

      // Close all consumers
      for (const consumerInfo of consumersRef.current.values()) {
        consumerInfo.consumer.close();
      }
      consumersRef.current.clear();

      // Close transports
      if (sendTransportRef.current) {
        sendTransportRef.current.close();
      }
      if (recvTransportRef.current) {
        recvTransportRef.current.close();
      }

      // Close device
      deviceRef.current = null;
    };
  }, [debug]);

  return {
    peers,
    peerMediaState,
    isConnected,
    connectionState,
    joinRoom,
    pauseProducer,
    resumeProducer,
    // Expose for debugging
    device: deviceRef.current,
    sendTransport: sendTransportRef.current,
    recvTransport: recvTransportRef.current,
    producers: producersRef.current,
    consumers: consumersRef.current,
  };
};
