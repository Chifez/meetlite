import fetch from 'node-fetch';
import { MediaSoupWorker } from './MediaSoupWorker.js';
import { logger } from '../utils/logger.js';
import { mediasoupConfig } from '../config/mediasoup.js';

/**
 * Main MediaSoup Service
 * High-level service that orchestrates MediaSoupWorker and handles business logic
 */
export class MediaSoupService {
  constructor(collaborationStateManager = null) {
    this.worker = new MediaSoupWorker();
    this.rooms = new Map();
    this.participants = new Map();
    this.screenSharing = new Map(); // Track screen sharing per room
    this.roomServiceUrl =
      process.env.ROOM_SERVICE_URL || 'http://localhost:5001';
    this.collaborationStateManager = collaborationStateManager;

    logger.info('MediaSoupService initialized', {
      roomServiceUrl: this.roomServiceUrl,
      hasCollaborationManager: !!collaborationStateManager,
    });
  }

  /**
   * Initialize the service
   */
  async initialize() {
    try {
      await this.worker.initializeWorkers();
      logger.info('MediaSoupService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MediaSoupService', error);
      throw error;
    }
  }

  /**
   * Validate room access with room service
   */
  async validateRoomAccess(roomId, userId, token) {
    try {
      const response = await fetch(
        `${this.roomServiceUrl}/api/v1/rooms/${roomId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status === 404) {
        return { valid: false, error: 'Room not found' };
      }

      if (response.status === 403) {
        return { valid: false, error: 'Access denied to this room' };
      }

      if (!response.ok) {
        return { valid: false, error: 'Room validation failed' };
      }

      const room = await response.json();
      return { valid: true, room };
    } catch (error) {
      logger.error('Failed to validate room access', {
        roomId,
        userId,
        error: error.message,
      });
      return { valid: false, error: 'Room service unavailable' };
    }
  }

  /**
   * Create a new room
   */
  async createRoom(roomId, userId) {
    try {
      // Check if room already exists
      if (this.rooms.has(roomId)) {
        logger.info('Room already exists', { roomId });
        return this.rooms.get(roomId);
      }

      // Create router for the room
      const router = await this.worker.createRouter(roomId);

      // Store room data
      const roomData = {
        roomId,
        router,
        participants: new Set(),
        createdAt: Date.now(),
        createdBy: userId,
      };

      this.rooms.set(roomId, roomData);

      // Initialize collaboration state for the room
      if (this.collaborationStateManager) {
        this.collaborationStateManager.initializeRoom(roomId);
      }

      logger.info('Room created successfully', {
        roomId,
        createdBy: userId,
        routerId: router.id,
      });

      return roomData;
    } catch (error) {
      logger.error('Failed to create room', { roomId, userId, error });
      throw error;
    }
  }

  /**
   * Get room data
   */
  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Add participant to room
   */
  async addParticipant(roomId, userId, userInfo) {
    try {
      let roomData = this.rooms.get(roomId);

      // Create room if it doesn't exist
      if (!roomData) {
        roomData = await this.createRoom(roomId, userId);
      }

      // Check if participant already exists
      if (roomData.participants.has(userId)) {
        logger.info('Participant already in room', { roomId, userId });
        return roomData;
      }

      // Add participant to room
      roomData.participants.add(userId);

      // Store participant data
      const participantData = {
        userId,
        userInfo,
        joinedAt: Date.now(),
        transports: new Set(),
        producers: new Set(),
        consumers: new Set(),
      };

      this.participants.set(`${roomId}_${userId}`, participantData);

      logger.info('Participant added to room', {
        roomId,
        userId,
        participantCount: roomData.participants.size,
      });

      return participantData;
    } catch (error) {
      logger.error('Failed to add participant', { roomId, userId, error });
      throw error;
    }
  }

  /**
   * Remove participant from room
   */
  async removeParticipant(roomId, userId) {
    try {
      const roomData = this.rooms.get(roomId);
      if (!roomData) {
        logger.warn('Room not found when removing participant', {
          roomId,
          userId,
        });
        return { success: true };
      }

      // Remove participant from room
      roomData.participants.delete(userId);

      // Clean up participant resources
      const participantKey = `${roomId}_${userId}`;
      const participantData = this.participants.get(participantKey);

      if (participantData) {
        // Close all transports
        for (const transportId of participantData.transports) {
          try {
            await this.worker.connectTransport(transportId, {}); // Close transport
          } catch (error) {
            logger.warn('Error closing transport during participant removal', {
              transportId,
              error,
            });
          }
        }

        // Remove participant data
        this.participants.delete(participantKey);
      }

      // Clean up room if empty
      if (roomData.participants.size === 0) {
        await this.cleanupRoom(roomId);
      }

      logger.info('Participant removed from room', {
        roomId,
        userId,
        remainingParticipants: roomData.participants.size,
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to remove participant', { roomId, userId, error });
      throw error;
    }
  }

  /**
   * Get room RTP capabilities
   */
  async getRtpCapabilities(roomId) {
    try {
      const roomData = this.rooms.get(roomId);
      if (!roomData) {
        throw new Error(`Room not found: ${roomId}`);
      }

      return await this.worker.getRtpCapabilities(roomId);
    } catch (error) {
      logger.error('Failed to get RTP capabilities', { roomId, error });
      throw error;
    }
  }

  /**
   * Create WebRTC transport
   */
  async createWebRtcTransport(roomId, direction, userId) {
    try {
      const roomData = this.rooms.get(roomId);
      if (!roomData) {
        throw new Error(`Room not found: ${roomId}`);
      }

      // Validate user is in room
      if (!roomData.participants.has(userId)) {
        throw new Error(`User not in room: ${userId}`);
      }

      const transportData = await this.worker.createWebRtcTransport(
        roomId,
        direction
      );

      // Track transport for participant
      const participantKey = `${roomId}_${userId}`;
      const participantData = this.participants.get(participantKey);
      if (participantData) {
        participantData.transports.add(transportData.id);
      }

      logger.info('WebRTC transport created', {
        roomId,
        userId,
        direction,
        transportId: transportData.id,
      });

      return transportData;
    } catch (error) {
      logger.error('Failed to create WebRTC transport', {
        roomId,
        userId,
        direction,
        error,
      });
      throw error;
    }
  }

  /**
   * Connect transport
   */
  async connectTransport(roomId, transportId, dtlsParameters, userId) {
    try {
      // Validate user access
      const roomData = this.rooms.get(roomId);
      if (!roomData || !roomData.participants.has(userId)) {
        throw new Error(`User not authorized for room: ${roomId}`);
      }

      const result = await this.worker.connectTransport(
        transportId,
        dtlsParameters
      );

      logger.info('Transport connected', {
        roomId,
        userId,
        transportId,
      });

      return result;
    } catch (error) {
      logger.error('Failed to connect transport', {
        roomId,
        userId,
        transportId,
        error,
      });
      throw error;
    }
  }

  /**
   * Create producer
   */
  async createProducer(
    roomId,
    transportId,
    rtpParameters,
    kind,
    userId,
    appData = {}
  ) {
    try {
      const roomData = this.rooms.get(roomId);
      if (!roomData || !roomData.participants.has(userId)) {
        throw new Error(`User not authorized for room: ${roomId}`);
      }

      // Check if user is already screen sharing (single sharer enforcement)
      if (appData.source === 'screen') {
        const currentSharer = this.screenSharing.get(roomId);
        if (currentSharer && currentSharer.userId !== userId) {
          throw new Error('Another user is already sharing their screen');
        }
      }

      const producerData = await this.worker.createProducer(
        transportId,
        rtpParameters,
        kind,
        userId,
        appData
      );

      // Track screen sharing state
      if (appData.source === 'screen') {
        const screenShareData = this.screenSharing.get(roomId) || {
          userId,
          producers: {},
          startedAt: Date.now(),
        };

        if (appData.mediaType === 'screen-video') {
          screenShareData.videoProducerId = producerData.id;
        } else if (appData.mediaType === 'screen-audio') {
          screenShareData.audioProducerId = producerData.id;
        }

        this.screenSharing.set(roomId, screenShareData);
      }

      // Track producer for participant
      const participantKey = `${roomId}_${userId}`;
      const participantData = this.participants.get(participantKey);
      if (participantData) {
        participantData.producers.add(producerData.id);
      }

      logger.info('Producer created', {
        roomId,
        userId,
        kind,
        source: appData.source || 'camera',
        mediaType: appData.mediaType || `camera-${kind}`,
        producerId: producerData.id,
      });

      return producerData;
    } catch (error) {
      logger.error('Failed to create producer', {
        roomId,
        userId,
        kind,
        error,
      });
      throw error;
    }
  }

  /**
   * Create consumer
   */
  async createConsumer(
    roomId,
    transportId,
    producerId,
    rtpCapabilities,
    userId
  ) {
    try {
      const roomData = this.rooms.get(roomId);
      if (!roomData || !roomData.participants.has(userId)) {
        throw new Error(`User not authorized for room: ${roomId}`);
      }

      const consumerData = await this.worker.createConsumer(
        transportId,
        producerId,
        rtpCapabilities,
        userId
      );

      // Track consumer for participant
      const participantKey = `${roomId}_${userId}`;
      const participantData = this.participants.get(participantKey);
      if (participantData) {
        participantData.consumers.add(consumerData.id);
      }

      logger.info('Consumer created', {
        roomId,
        userId,
        producerId,
        consumerId: consumerData.id,
      });

      return consumerData;
    } catch (error) {
      logger.error('Failed to create consumer', {
        roomId,
        userId,
        producerId,
        error,
      });
      throw error;
    }
  }

  /**
   * Pause producer
   */
  async pauseProducer(roomId, producerId, userId) {
    try {
      const roomData = this.rooms.get(roomId);
      if (!roomData || !roomData.participants.has(userId)) {
        throw new Error(`User not authorized for room: ${roomId}`);
      }

      const result = await this.worker.pauseProducer(producerId);

      logger.info('Producer paused', {
        roomId,
        userId,
        producerId,
      });

      return result;
    } catch (error) {
      logger.error('Failed to pause producer', {
        roomId,
        userId,
        producerId,
        error,
      });
      throw error;
    }
  }

  /**
   * Resume producer
   */
  async resumeProducer(roomId, producerId, userId) {
    try {
      const roomData = this.rooms.get(roomId);
      if (!roomData || !roomData.participants.has(userId)) {
        throw new Error(`User not authorized for room: ${roomId}`);
      }

      const result = await this.worker.resumeProducer(producerId);

      logger.info('Producer resumed', {
        roomId,
        userId,
        producerId,
      });

      return result;
    } catch (error) {
      logger.error('Failed to resume producer', {
        roomId,
        userId,
        producerId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get room participants
   */
  getParticipants(roomId) {
    const roomData = this.rooms.get(roomId);
    if (!roomData) {
      return [];
    }

    return Array.from(roomData.participants).map((userId) => {
      const participantKey = `${roomId}_${userId}`;
      const participantData = this.participants.get(participantKey);
      return participantData || { userId, joinedAt: Date.now() };
    });
  }

  /**
   * Update participant activity
   */
  async updateParticipantActivity(roomId, userId) {
    try {
      const participantKey = `${roomId}_${userId}`;
      const participantData = this.participants.get(participantKey);

      if (participantData) {
        participantData.lastActivity = Date.now();
      }

      return { success: true };
    } catch (error) {
      logger.error('Failed to update participant activity', {
        roomId,
        userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Cleanup room
   */
  async cleanupRoom(roomId) {
    try {
      logger.info('Cleaning up room', { roomId });

      // Remove all participants
      const roomData = this.rooms.get(roomId);
      if (roomData) {
        for (const userId of roomData.participants) {
          const participantKey = `${roomId}_${userId}`;
          this.participants.delete(participantKey);
        }
      }

      // Cleanup worker resources
      await this.worker.cleanupRoom(roomId);

      // Cleanup collaboration state
      if (this.collaborationStateManager) {
        this.collaborationStateManager.removeRoom(roomId);
      }

      // Remove room from map
      this.rooms.delete(roomId);

      logger.info('Room cleaned up', { roomId });
    } catch (error) {
      logger.error('Failed to cleanup room', { roomId, error });
      throw error;
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    const workerStats = this.worker.getStats();

    return {
      ...workerStats,
      rooms: this.rooms.size,
      participants: this.participants.size,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  /**
   * Shutdown service
   */
  async shutdown() {
    logger.info('Shutting down MediaSoupService...');

    // Cleanup all rooms
    for (const roomId of this.rooms.keys()) {
      try {
        await this.cleanupRoom(roomId);
      } catch (error) {
        logger.error('Error cleaning up room during shutdown', {
          roomId,
          error,
        });
      }
    }

    // Shutdown worker
    await this.worker.shutdown();

    logger.info('MediaSoupService shut down');
  }

  /**
   * Get participants in a room
   */
  getParticipants(roomId) {
    const roomData = this.rooms.get(roomId);
    if (!roomData) return [];

    return Array.from(roomData.participants)
      .map((userId) => {
        const participantKey = `${roomId}_${userId}`;
        return this.participants.get(participantKey);
      })
      .filter(Boolean);
  }

  /**
   * Update participant media state
   */
  async updateParticipantMediaState(roomId, userId, mediaState) {
    try {
      const participantKey = `${roomId}_${userId}`;
      const participantData = this.participants.get(participantKey);

      if (participantData) {
        participantData.mediaState = mediaState;
        participantData.lastActive = Date.now();

        logger.info('Participant media state updated', {
          roomId,
          userId,
          mediaState,
        });

        return { success: true };
      }

      return { success: false, error: 'Participant not found' };
    } catch (error) {
      logger.error('Failed to update participant media state', {
        roomId,
        userId,
        mediaState,
        error,
      });
      throw error;
    }
  }

  /**
   * Update participant activity
   */
  async updateParticipantActivity(roomId, userId) {
    try {
      const participantKey = `${roomId}_${userId}`;
      const participantData = this.participants.get(participantKey);

      if (participantData) {
        participantData.lastActive = Date.now();
        return { success: true };
      }

      return { success: false, error: 'Participant not found' };
    } catch (error) {
      logger.error('Failed to update participant activity', {
        roomId,
        userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get all producers for a room
   */
  getProducersForRoom(roomId) {
    return this.worker.getProducersForRoom(roomId);
  }

  /**
   * Get screen sharing info for a room
   */
  getScreenSharing(roomId) {
    return this.screenSharing.get(roomId) || null;
  }

  /**
   * Stop screen sharing in a room
   */
  stopScreenSharing(roomId, userId) {
    const screenShareData = this.screenSharing.get(roomId);

    if (screenShareData && screenShareData.userId === userId) {
      this.screenSharing.delete(roomId);

      logger.info('Screen sharing stopped', {
        roomId,
        userId,
      });

      return true;
    }

    return false;
  }

  /**
   * Check if a user is currently screen sharing
   */
  isUserScreenSharing(roomId, userId) {
    const screenShareData = this.screenSharing.get(roomId);
    return screenShareData && screenShareData.userId === userId;
  }
}
