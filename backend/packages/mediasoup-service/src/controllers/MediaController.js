import { logger } from '../utils/logger.js';
import { mediasoupConfig } from '../config/mediasoup.js';

/**
 * MediaController - Handles all media-related Socket.IO events
 * Extracted from index.js for better separation of concerns
 */
export class MediaController {
  constructor(mediaSoupService, io) {
    this.mediaSoupService = mediaSoupService;
    this.io = io;
  }

  /**
   * Handle room creation via Socket.IO
   */
  async handleCreateRoom(socket, data) {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' });
        return;
      }

      // Validate room access
      const token = socket.handshake.auth.token;
      const validation = await this.mediaSoupService.validateRoomAccess(
        roomId,
        userId,
        token
      );

      if (!validation.valid) {
        socket.emit('error', { message: validation.error });
        return;
      }

      // Create room
      const roomData = await this.mediaSoupService.createRoom(roomId, userId);

      // Add participant
      await this.mediaSoupService.addParticipant(roomId, userId, {
        email: socket.user.email,
        userId: socket.user.userId,
      });

      // Join socket room
      socket.join(roomId);

      // Get RTP capabilities
      const rtpCapabilities = await this.mediaSoupService.getRtpCapabilities(
        roomId
      );

      socket.emit('room-created', {
        roomId,
        rtpCapabilities,
        iceServers: mediasoupConfig.iceServers,
        mediaSoupEnabled: true,
      });

      logger.info('Room created via Socket.IO', {
        roomId,
        userId,
      });
    } catch (error) {
      logger.error('Failed to create room via Socket.IO', error);
      socket.emit('error', { message: 'Failed to create room' });
    }
  }

  /**
   * Handle ready event (main room join flow)
   */
  async handleReady(socket, data) {
    try {
      const { roomId, mediaState } = data;
      const userId = socket.user.userId;

      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' });
        return;
      }

      // Validate room access
      const token = socket.handshake.auth.token;
      const validation = await this.mediaSoupService.validateRoomAccess(
        roomId,
        userId,
        token
      );

      if (!validation.valid) {
        socket.emit('error', { message: validation.error });
        return;
      }

      // Create room if it doesn't exist
      let roomData = this.mediaSoupService.getRoom(roomId);
      if (!roomData) {
        roomData = await this.mediaSoupService.createRoom(roomId, userId);
      }

      // Add participant
      logger.info('🔍 [READY] Adding participant with user data:', {
        email: socket.user.email,
        userId: socket.user.userId,
        name: socket.user.name,
        useNameInMeetings: socket.user.useNameInMeetings,
      });

      await this.mediaSoupService.addParticipant(roomId, userId, {
        email: socket.user.email,
        userId: socket.user.userId,
        name: socket.user.name,
        useNameInMeetings: socket.user.useNameInMeetings,
      });

      // CRITICAL FIX: Store initial media state (like signaling service does)
      await this.mediaSoupService.updateParticipantMediaState(roomId, userId, {
        audioEnabled: mediaState?.audioEnabled ?? true,
        videoEnabled: mediaState?.videoEnabled ?? true,
      });

      // Join socket room
      socket.join(roomId);

      // Get RTP capabilities and participants
      const rtpCapabilities = await this.mediaSoupService.getRtpCapabilities(
        roomId
      );
      const participants = this.mediaSoupService.getParticipants(roomId);

      // Get existing producers in the room (CRITICAL FIX: Notify about existing producers)
      const existingProducers =
        this.mediaSoupService.getProducersForRoom(roomId);

      // Get screen sharing info
      const screenShareInfo = this.mediaSoupService.getScreenSharing(roomId);

      // CRITICAL FIX: Send room data ONLY to the newly joined user, not ALL participants
      // This prevents existing users from receiving room-data and trying to re-consume producers
      socket.emit('room-data', {
        participants: participants.map((p) => p.userId),
        mediaState: participants.reduce((acc, p) => {
          // CRITICAL FIX: Use actual participant media state from stored data
          if (p.userId === userId) {
            // For current user, use the mediaState from the request
            acc[p.userId] = {
              audioEnabled: mediaState?.audioEnabled ?? true,
              videoEnabled: mediaState?.videoEnabled ?? true,
            };
          } else {
            // For other users, use their stored media state
            acc[p.userId] = p.mediaState || {
              audioEnabled: true,
              videoEnabled: true,
            };
          }
          return acc;
        }, {}),
        participantInfo: participants.reduce((acc, p) => {
          const participantInfo = {
            email: p.userInfo.email,
            userId: p.userInfo.userId,
            name: p.userInfo.name,
            useNameInMeetings: p.userInfo.useNameInMeetings,
          };

          logger.info('🔍 [READY] Participant info being sent:', {
            participantUserId: p.userId,
            participantInfo,
          });

          acc[p.userId] = participantInfo;
          return acc;
        }, {}),
        rtpCapabilities,
        iceServers: mediasoupConfig.iceServers,
        mediaSoupEnabled: true,
        existingProducers, // Existing producers for the new user to consume
        screenSharing: screenShareInfo, // Include screen sharing info
      });

      // Notify other participants with full participant info and media state
      if (participants.length > 1) {
        const userJoinedData = {
          userId,
          userEmail: socket.user.email,
          // CRITICAL FIX: Include participant info for display names
          participantInfo: {
            email: socket.user.email,
            userId: socket.user.userId,
            name: socket.user.name,
            useNameInMeetings: socket.user.useNameInMeetings,
          },
          // CRITICAL FIX: Include initial media state
          mediaState: {
            audioEnabled: mediaState?.audioEnabled ?? true,
            videoEnabled: mediaState?.videoEnabled ?? true,
          },
        };

        logger.info('🔍 [READY] Emitting user-joined to other participants:', {
          userId,
          data: userJoinedData,
        });

        socket.to(roomId).emit('user-joined', userJoinedData);
      }

      logger.info('User ready and joined room', {
        roomId,
        userId,
        participantsCount: participants.length,
      });
    } catch (error) {
      logger.error('Failed to handle ready event', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  }

  /**
   * Handle room joining
   */
  async handleJoinRoom(socket, data) {
    try {
      const { roomId, mediaState } = data;
      const userId = socket.user.userId;

      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' });
        return;
      }

      // Validate room access
      const token = socket.handshake.auth.token;
      const validation = await this.mediaSoupService.validateRoomAccess(
        roomId,
        userId,
        token
      );

      if (!validation.valid) {
        socket.emit('error', { message: validation.error });
        return;
      }

      // Create room if it doesn't exist
      let roomData = this.mediaSoupService.getRoom(roomId);
      if (!roomData) {
        roomData = await this.mediaSoupService.createRoom(roomId, userId);
      }

      // Add participant
      await this.mediaSoupService.addParticipant(roomId, userId, {
        email: socket.user.email,
        userId: socket.user.userId,
        name: socket.user.name,
        useNameInMeetings: socket.user.useNameInMeetings,
      });

      // CRITICAL FIX: Store initial media state (like signaling service does)
      if (mediaState) {
        await this.mediaSoupService.updateParticipantMediaState(
          roomId,
          userId,
          {
            audioEnabled: mediaState.audioEnabled ?? true,
            videoEnabled: mediaState.videoEnabled ?? true,
          }
        );
      }

      // Join socket room
      socket.join(roomId);

      // Get RTP capabilities and participants
      const rtpCapabilities = await this.mediaSoupService.getRtpCapabilities(
        roomId
      );
      const participants = this.mediaSoupService.getParticipants(roomId);

      // Get existing producers in the room (CRITICAL FIX: Notify about existing producers)
      const existingProducers =
        this.mediaSoupService.getProducersForRoom(roomId);

      socket.emit('room-joined', {
        roomId,
        rtpCapabilities,
        iceServers: mediasoupConfig.iceServers,
        participants: participants.map((p) => ({
          userId: p.userId,
          userInfo: p.userInfo,
          joinedAt: p.joinedAt,
        })),
        mediaSoupEnabled: true,
        existingProducers, // CRITICAL FIX: Include existing producers
      });

      // Notify other participants with full participant info and media state
      socket.to(roomId).emit('participant-joined', {
        userId,
        userInfo: {
          email: socket.user.email,
          userId: socket.user.userId,
        },
        joinedAt: Date.now(),
        isMediaSoupConnected: true,
        // CRITICAL FIX: Include participant info for display names
        participantInfo: {
          email: socket.user.email,
          userId: socket.user.userId,
          name: socket.user.name,
          useNameInMeetings: socket.user.useNameInMeetings,
        },
        // CRITICAL FIX: Include initial media state
        mediaState: mediaState
          ? {
              audioEnabled: mediaState.audioEnabled ?? true,
              videoEnabled: mediaState.videoEnabled ?? true,
            }
          : {
              audioEnabled: true,
              videoEnabled: true,
            },
      });

      logger.info('User joined room via Socket.IO', {
        roomId,
        userId,
      });
    } catch (error) {
      logger.error('Failed to join room via Socket.IO', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  }

  /**
   * Handle transport creation
   */
  async handleCreateTransport(socket, data) {
    try {
      const { roomId, direction } = data;
      const userId = socket.user.userId;

      const transportData = await this.mediaSoupService.createWebRtcTransport(
        roomId,
        direction,
        userId
      );

      socket.emit('transport-created', transportData);

      logger.info('Transport created', {
        roomId,
        userId,
        direction,
        transportId: transportData.id,
      });
    } catch (error) {
      logger.error('Failed to create transport', error);
      socket.emit('error', { message: 'Failed to create transport' });
    }
  }

  /**
   * Handle transport connection
   */
  async handleConnectTransport(socket, data) {
    try {
      const { roomId, transportId, dtlsParameters } = data;
      const userId = socket.user.userId;

      const result = await this.mediaSoupService.connectTransport(
        roomId,
        transportId,
        dtlsParameters,
        userId
      );

      socket.emit('transport-connected', { transportId, ...result });

      logger.info('Transport connected', {
        roomId,
        userId,
        transportId,
      });
    } catch (error) {
      logger.error('Failed to connect transport', error);
      socket.emit('error', { message: 'Failed to connect transport' });
    }
  }

  /**
   * Handle producer creation
   */
  async handleCreateProducer(socket, data) {
    try {
      const { roomId, transportId, rtpParameters, kind, appData } = data;
      const userId = socket.user.userId;

      const producerData = await this.mediaSoupService.createProducer(
        roomId,
        transportId,
        rtpParameters,
        kind,
        userId,
        appData || {}
      );

      socket.emit('producer-created', producerData);

      // Notify other participants about new producer with metadata
      logger.info('[NEW-PRODUCER] Emitting to room:', {
        roomId,
        producerId: producerData.id,
        userId,
        kind,
        source: producerData.source,
        mediaType: producerData.mediaType,
        targetSockets: Array.from(
          this.io.sockets.adapter.rooms.get(roomId) || []
        ).filter((id) => id !== socket.id),
      });

      socket.to(roomId).emit('new-producer', {
        producerId: producerData.id,
        userId,
        kind,
        source: producerData.source,
        mediaType: producerData.mediaType,
      });

      logger.info('Producer created', {
        roomId,
        userId,
        kind,
        source: producerData.source,
        mediaType: producerData.mediaType,
        producerId: producerData.id,
      });
    } catch (error) {
      logger.error('Failed to create producer', error);
      socket.emit('error', {
        message: error.message || 'Failed to create producer',
      });
    }
  }

  /**
   * Handle consumer creation
   */
  async handleCreateConsumer(socket, data) {
    try {
      const { roomId, transportId, producerId, rtpCapabilities } = data;
      const userId = socket.user.userId;

      const consumerData = await this.mediaSoupService.createConsumer(
        roomId,
        transportId,
        producerId,
        rtpCapabilities,
        userId
      );

      socket.emit('consumer-created', consumerData);

      logger.info('Consumer created', {
        roomId,
        userId,
        producerId,
        consumerId: consumerData.id,
      });
    } catch (error) {
      logger.error('Failed to create consumer', error);
      socket.emit('error', { message: 'Failed to create consumer' });
    }
  }

  /**
   * Handle producer pause
   */
  async handlePauseProducer(socket, data) {
    try {
      const { roomId, producerId } = data;
      const userId = socket.user.userId;

      const result = await this.mediaSoupService.pauseProducer(
        roomId,
        producerId,
        userId
      );
      socket.emit('producer-paused', { producerId, ...result });

      logger.info('Producer paused', { roomId, userId, producerId });
    } catch (error) {
      logger.error('Failed to pause producer', error);
      socket.emit('error', { message: 'Failed to pause producer' });
    }
  }

  /**
   * Handle producer resume
   */
  async handleResumeProducer(socket, data) {
    try {
      const { roomId, producerId } = data;
      const userId = socket.user.userId;

      const result = await this.mediaSoupService.resumeProducer(
        roomId,
        producerId,
        userId
      );
      socket.emit('producer-resumed', { producerId, ...result });

      logger.info('Producer resumed', { roomId, userId, producerId });
    } catch (error) {
      logger.error('Failed to resume producer', error);
      socket.emit('error', { message: 'Failed to resume producer' });
    }
  }

  /**
   * Handle media state changes
   */
  async handleMediaStateChange(socket, data) {
    try {
      const { roomId, audioEnabled, videoEnabled } = data;
      const userId = socket.user.userId;

      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' });
        return;
      }

      // Update participant media state
      await this.mediaSoupService.updateParticipantMediaState(roomId, userId, {
        audioEnabled,
        videoEnabled,
      });

      // Broadcast to other participants
      socket.to(roomId).emit('media-state-update', {
        userId,
        audioEnabled,
        videoEnabled,
      });

      logger.info('Media state updated', {
        roomId,
        userId,
        audioEnabled,
        videoEnabled,
      });
    } catch (error) {
      logger.error('Failed to update media state', error);
      socket.emit('error', { message: 'Failed to update media state' });
    }
  }

  /**
   * Handle screen share started
   */
  async handleScreenShareStarted(socket, data) {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' });
        return;
      }

      // Update participant activity
      await this.mediaSoupService.updateParticipantActivity(roomId, userId);

      // Broadcast to other participants
      socket.to(roomId).emit('screen-share-started', { userId });

      logger.info('Screen share started', {
        roomId,
        userId,
      });
    } catch (error) {
      logger.error('Failed to handle screen share started', error);
      socket.emit('error', { message: 'Failed to start screen share' });
    }
  }

  /**
   * Handle screen share stopped
   */
  async handleScreenShareStopped(socket, data) {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' });
        return;
      }

      // Get screen share info
      const screenShareInfo = this.mediaSoupService.getScreenSharing(roomId);

      if (screenShareInfo && screenShareInfo.userId === userId) {
        // Close screen producers (MediaSoup will auto-close consumers)
        const allProducers = this.mediaSoupService.getProducersForRoom(roomId);

        for (const producer of allProducers) {
          if (producer.userId === userId && producer.source === 'screen') {
            try {
              await this.mediaSoupService.worker.closeProducer(producer.id);
              logger.info('Screen producer closed', {
                roomId,
                userId,
                producerId: producer.id,
                mediaType: producer.mediaType,
              });
            } catch (error) {
              logger.error('Failed to close screen producer', {
                producerId: producer.id,
                error,
              });
            }
          }
        }

        // Clear screen sharing state
        this.mediaSoupService.stopScreenSharing(roomId, userId);
      }

      // Update participant activity
      await this.mediaSoupService.updateParticipantActivity(roomId, userId);

      // Broadcast to other participants
      socket.to(roomId).emit('screen-share-stopped', { userId });

      logger.info('Screen share stopped', {
        roomId,
        userId,
      });
    } catch (error) {
      logger.error('Failed to handle screen share stopped', error);
      socket.emit('error', { message: 'Failed to stop screen share' });
    }
  }

  /**
   * Handle screen share ready
   * DEPRECATED: Screen sharing now uses MediaSoup producers/consumers
   * Kept for backward compatibility only
   */
  async handleScreenShareReady(socket, data) {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' });
        return;
      }

      // Update participant activity
      await this.mediaSoupService.updateParticipantActivity(roomId, userId);

      logger.info('Screen share ready (DEPRECATED - using MediaSoup now)', {
        roomId,
        userId,
      });
    } catch (error) {
      logger.error('Failed to handle screen share ready', error);
      socket.emit('error', { message: 'Failed to handle screen share ready' });
    }
  }

  /**
   * Handle participant activity
   */
  async handleParticipantActivity(socket, data) {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      await this.mediaSoupService.updateParticipantActivity(roomId, userId);
    } catch (error) {
      logger.error('Failed to update participant activity', error);
    }
  }
}
