import { logger } from '../utils/logger.js';
import { mediasoupConfig } from '../config/mediasoup.js';
import { SOCKET_EVENTS, COLLABORATION_MODES } from '@minimeet/shared';


/**
 * MediaController - Handles all media-related Socket.IO events
 */
export class MediaController {
  public mediaSoupService: any;
  private io: any;

  constructor(mediaSoupService: any, io: any) {
    this.mediaSoupService = mediaSoupService;
    this.io = io;
  }

  /**
   * Handle room creation via Socket.IO
   */
  async handleCreateRoom(socket: any, data: any) {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Room ID is required' });
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
        socket.emit(SOCKET_EVENTS.ERROR, { message: validation.error });
        return;
      }

      // Create room
      await this.mediaSoupService.createRoom(roomId, userId);

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
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to create room' });
    }
  }

  /**
   * Handle ready event (main room join flow)
   */
  async handleReady(socket: any, data: any) {
    try {
      const { roomId, mediaState } = data;
      const userId = socket.user.userId;

      if (!roomId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Room ID is required' });
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
        socket.emit(SOCKET_EVENTS.ERROR, { message: validation.error });
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

      // Store initial media state
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

      // Get existing producers in the room
      const existingProducers =
        this.mediaSoupService.getProducersForRoom(roomId);

      // Get screen sharing info
      const screenShareInfo = this.mediaSoupService.getScreenSharing(roomId);

      // Get collaboration state
      let collaborationState = null;
      try {
        const collaborationStateManager =
          this.mediaSoupService.collaborationStateManager;
        if (collaborationStateManager) {
          collaborationState =
            collaborationStateManager.getCollaborationState(roomId);
        }
      } catch (error) {
        logger.warn('Failed to get collaboration state for room join', {
          error,
        });
      }

      socket.emit(SOCKET_EVENTS.ROOM_DATA, {
        participants: participants.map((p: any) => p.userId),
        mediaState: participants.reduce((acc: any, p: any) => {
          if (p.userId === userId) {
            acc[p.userId] = {
              audioEnabled: mediaState?.audioEnabled ?? true,
              videoEnabled: mediaState?.videoEnabled ?? true,
            };
          } else {
            acc[p.userId] = p.mediaState || {
              audioEnabled: true,
              videoEnabled: true,
            };
          }
          return acc;
        }, {}),
        participantInfo: participants.reduce((acc: any, p: any) => {
          const pInfo = {
            email: p.userInfo.email,
            userId: p.userInfo.userId,
            name: p.userInfo.name,
            useNameInMeetings: p.userInfo.useNameInMeetings,
          };

          logger.info('🔍 [READY] Participant info being sent:', {
            participantUserId: p.userId,
            participantInfo: pInfo,
          });

          acc[p.userId] = pInfo;
          return acc;
        }, {}),
        rtpCapabilities,
        iceServers: mediasoupConfig.iceServers,
        mediaSoupEnabled: true,
        existingProducers,
        screenSharing: screenShareInfo,
        collaborationState: collaborationState
          ? {
              mode: collaborationState.mode || 'none',
              activeTool: collaborationState.activeTool || 'none',
              presenter: collaborationState.presenter || null,
              screenSharingUserId: screenShareInfo?.userId || null,
              workflowData: collaborationState.workflowData || null,
              whiteboardData: collaborationState.whiteboardData || null,
              codeData: collaborationState.codeData || null,
              timestamp: Date.now(),
            }
          : null,
      });

      // Notify other participants with full participant info and media state
      if (participants.length > 1) {
        const userJoinedData = {
          userId,
          userEmail: socket.user.email,
          participantInfo: {
            email: socket.user.email,
            userId: socket.user.userId,
            name: socket.user.name,
            useNameInMeetings: socket.user.useNameInMeetings,
          },
          mediaState: {
            audioEnabled: mediaState?.audioEnabled ?? true,
            videoEnabled: mediaState?.videoEnabled ?? true,
          },
        };

        logger.info('🔍 [READY] Emitting user-joined to other participants:', {
          userId,
          data: userJoinedData,
        });

        socket.to(roomId).emit(SOCKET_EVENTS.USER_JOINED, userJoinedData);
      }

      // Notify recording service that a user joined (so they get access if recording is active)
      this.mediaSoupService.notifyRecordingParticipantJoined(roomId, userId);

      logger.info('User ready and joined room', {
        roomId,
        userId,
        participantsCount: participants.length,
      });
    } catch (error) {
      logger.error('Failed to handle ready event', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to join room' });
    }
  }

  /**
   * Handle room joining
   */
  async handleJoinRoom(socket: any, data: any) {
    try {
      const { roomId, mediaState } = data;
      const userId = socket.user.userId;

      if (!roomId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Room ID is required' });
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
        socket.emit(SOCKET_EVENTS.ERROR, { message: validation.error });
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

      // Store initial media state
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

      // Get existing producers in the room
      const existingProducers =
        this.mediaSoupService.getProducersForRoom(roomId);

      socket.emit('room-joined', {
        roomId,
        rtpCapabilities,
        iceServers: mediasoupConfig.iceServers,
        participants: participants.map((p: any) => ({
          userId: p.userId,
          userInfo: p.userInfo,
          joinedAt: p.joinedAt,
        })),
        mediaSoupEnabled: true,
        existingProducers,
      });

      // Notify other participants with full participant info and media state
      socket.to(roomId).emit(SOCKET_EVENTS.PARTICIPANT_JOINED, {
        userId,
        userInfo: {
          email: socket.user.email,
          userId: socket.user.userId,
        },
        joinedAt: Date.now(),
        isMediaSoupConnected: true,
        participantInfo: {
          email: socket.user.email,
          userId: socket.user.userId,
          name: socket.user.name,
          useNameInMeetings: socket.user.useNameInMeetings,
        },
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
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to join room' });
    }
  }

  /**
   * Handle transport creation
   */
  async handleCreateTransport(socket: any, data: any) {
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
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to create transport' });
    }
  }

  /**
   * Handle transport connection
   */
  async handleConnectTransport(socket: any, data: any) {
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
    } catch (error: any) {
      logger.error('Failed to connect transport', error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: error.message || 'Failed to connect transport',
        severity: 'warning',
        action: 'restart-ice'
      });
    }
  }

  /**
   * Handle setting consumer layers
   */
  async handleSetLayers(socket: any, data: any, callback?: Function) {
    try {
      const { consumerId, spatialLayer } = data;
      await this.mediaSoupService.worker.setConsumerLayers(
        consumerId,
        spatialLayer
      );
      if (callback) {
        callback({ success: true });
      }
    } catch (error: any) {
      logger.error('Failed to set consumer layers', error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: error.message || 'Failed to set layers',
        severity: 'warning'
      });
      if (callback) {
        callback({ error: error.message });
      }
    }
  }

  /**
   * Handle restarting ICE
   */
  async handleRestartIce(socket: any, data: any) {
    try {
      const { roomId, transportId } = data;
      const iceParameters = await this.mediaSoupService.worker.restartIce(transportId);
      socket.emit('ice-restarted', { transportId, iceParameters });
    } catch (error: any) {
      logger.error('Failed to restart ICE', error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: error.message || 'Failed to restart ICE',
        severity: 'warning'
      });
    }
  }

  /**
   * Handle producer creation
   */
  async handleCreateProducer(socket: any, data: any) {
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

      socket.to(roomId).emit(SOCKET_EVENTS.NEW_PRODUCER, {
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
    } catch (error: any) {
      logger.error('Failed to create producer', error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: error.message || 'Failed to create producer',
      });
    }
  }

  /**
   * Handle consumer creation
   */
  async handleCreateConsumer(socket: any, data: any) {
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

      socket.emit(SOCKET_EVENTS.CONSUMER_CREATED, consumerData);

      logger.info('Consumer created', {
        roomId,
        userId,
        producerId,
        consumerId: consumerData.id,
      });
    } catch (error) {
      logger.error('Failed to create consumer', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to create consumer' });
    }
  }

  /**
   * Handle producer pause
   */
  async handlePauseProducer(socket: any, data: any) {
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
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to pause producer' });
    }
  }

  /**
   * Handle producer resume
   */
  async handleResumeProducer(socket: any, data: any) {
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
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to resume producer' });
    }
  }

  /**
   * Handle media state changes
   */
  async handleMediaStateChange(socket: any, data: any) {
    try {
      const { roomId, audioEnabled, videoEnabled } = data;
      const userId = socket.user.userId;

      if (!roomId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Room ID is required' });
        return;
      }

      // Update participant media state
      await this.mediaSoupService.updateParticipantMediaState(roomId, userId, {
        audioEnabled,
        videoEnabled,
      });

      // Broadcast to other participants
      socket.to(roomId).emit(SOCKET_EVENTS.MEDIA_STATE_UPDATE, {
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
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to update media state' });
    }
  }

  /**
   * Handle screen share started
   */
  async handleScreenShareStarted(socket: any, data: any) {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Room ID is required' });
        return;
      }

      await this.mediaSoupService.updateParticipantActivity(roomId, userId);

      socket.to(roomId).emit(SOCKET_EVENTS.SCREEN_SHARE_STARTED, { userId });

      logger.info('Screen share started', {
        roomId,
        userId,
      });
    } catch (error) {
      logger.error('Failed to handle screen share started', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to start screen share' });
    }
  }

  /**
   * Handle screen share stopped
   */
  async handleScreenShareStopped(socket: any, data: any) {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Room ID is required' });
        return;
      }

      const screenShareInfo = this.mediaSoupService.getScreenSharing(roomId);

      if (screenShareInfo && screenShareInfo.userId === userId) {
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

        this.mediaSoupService.stopScreenSharing(roomId, userId);
      }

      await this.mediaSoupService.updateParticipantActivity(roomId, userId);

      socket.to(roomId).emit(SOCKET_EVENTS.SCREEN_SHARE_STOPPED, { userId });

      logger.info('Screen share stopped', {
        roomId,
        userId,
      });
    } catch (error) {
      logger.error('Failed to handle screen share stopped', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to stop screen share' });
    }
  }

  /**
   * Handle screen share ready
   */
  async handleScreenShareReady(socket: any, data: any) {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Room ID is required' });
        return;
      }

      await this.mediaSoupService.updateParticipantActivity(roomId, userId);

      logger.info('Screen share ready (DEPRECATED - using MediaSoup now)', {
        roomId,
        userId,
      });
    } catch (error) {
      logger.error('Failed to handle screen share ready', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to handle screen share ready' });
    }
  }

  /**
   * Handle participant activity
   */
  async handleParticipantActivity(socket: any, data: any) {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      await this.mediaSoupService.updateParticipantActivity(roomId, userId);
    } catch (error) {
      logger.error('Failed to update participant activity', error);
    }
  }
}
