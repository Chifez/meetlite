import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import { logger, requestLogger } from './utils/logger.js';
import { authMiddleware, httpAuthMiddleware } from './middleware/auth.js';
import { MediaSoupService } from './services/MediaSoupService.js';
import { CollaborationStateManager } from './services/CollaborationStateManager.js';
import { mediasoupConfig } from './config/mediasoup.js';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3003;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable for WebSocket connections
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5174',
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Create HTTP server
const httpServer = createServer(app);

// Create Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5174',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Initialize collaboration state manager
const collaborationStateManager = new CollaborationStateManager();

// Initialize MediaSoup service with collaboration state manager
const mediaSoupService = new MediaSoupService(collaborationStateManager);

// Health check endpoint
app.get('/health', (req, res) => {
  const stats = mediaSoupService.getStats();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    mediasoup: stats,
    config: {
      port: PORT,
      environment: process.env.NODE_ENV,
      workerPoolSize: mediasoupConfig.performance.workerPoolSize,
    },
  });
});

// MediaSoup REST API endpoints
app.post('/api/rooms/:roomId', httpAuthMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.user;

    // Validate room access
    const validation = await mediaSoupService.validateRoomAccess(
      roomId,
      userId,
      req.headers.authorization.split(' ')[1]
    );

    if (!validation.valid) {
      return res.status(403).json({
        success: false,
        message: validation.error,
      });
    }

    // Create room
    const roomData = await mediaSoupService.createRoom(roomId, userId);

    res.json({
      success: true,
      roomId,
      rtpCapabilities: await mediaSoupService.getRtpCapabilities(roomId),
      iceServers: mediasoupConfig.iceServers,
    });
  } catch (error) {
    logger.error('Failed to create room via REST API', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create room',
    });
  }
});

app.get('/api/rooms/:roomId', httpAuthMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.user;

    // Validate room access
    const validation = await mediaSoupService.validateRoomAccess(
      roomId,
      userId,
      req.headers.authorization.split(' ')[1]
    );

    if (!validation.valid) {
      return res.status(403).json({
        success: false,
        message: validation.error,
      });
    }

    // Get room data
    const roomData = mediaSoupService.getRoom(roomId);

    if (!roomData) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    res.json({
      success: true,
      roomId,
      participants: mediaSoupService.getParticipants(roomId),
      rtpCapabilities: await mediaSoupService.getRtpCapabilities(roomId),
      iceServers: mediasoupConfig.iceServers,
    });
  } catch (error) {
    logger.error('Failed to get room via REST API', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get room',
    });
  }
});

// Setup authentication middleware for Socket.IO
io.use(authMiddleware);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('User connected to MediaSoup service', {
    userId: socket.user.userId,
    email: socket.user.email,
    socketId: socket.id,
  });

  // Handle room creation
  socket.on('mediasoup:create-room', async (data) => {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' });
        return;
      }

      // Validate room access
      const token = socket.handshake.auth.token;
      const validation = await mediaSoupService.validateRoomAccess(
        roomId,
        userId,
        token
      );

      if (!validation.valid) {
        socket.emit('error', { message: validation.error });
        return;
      }

      // Create room
      const roomData = await mediaSoupService.createRoom(roomId, userId);

      // Add participant
      await mediaSoupService.addParticipant(roomId, userId, {
        email: socket.user.email,
        userId: socket.user.userId,
      });

      // Join socket room
      socket.join(roomId);

      // Get RTP capabilities
      const rtpCapabilities = await mediaSoupService.getRtpCapabilities(roomId);

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
  });

  // Handle ready event (matches current frontend flow)
  socket.on('ready', async (data) => {
    try {
      const { roomId, mediaState } = data;
      const userId = socket.user.userId;

      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' });
        return;
      }

      // Validate room access
      const token = socket.handshake.auth.token;
      const validation = await mediaSoupService.validateRoomAccess(
        roomId,
        userId,
        token
      );

      if (!validation.valid) {
        socket.emit('error', { message: validation.error });
        return;
      }

      // Create room if it doesn't exist
      let roomData = mediaSoupService.getRoom(roomId);
      if (!roomData) {
        roomData = await mediaSoupService.createRoom(roomId, userId);
      }

      // Add participant
      await mediaSoupService.addParticipant(roomId, userId, {
        email: socket.user.email,
        userId: socket.user.userId,
      });

      // Join socket room
      socket.join(roomId);

      // Get RTP capabilities
      const rtpCapabilities = await mediaSoupService.getRtpCapabilities(roomId);
      const participants = mediaSoupService.getParticipants(roomId);

      // Send room data to ALL participants (matches original signaling service)
      io.to(roomId).emit('room-data', {
        participants: participants.map((p) => p.userId),
        mediaState: participants.reduce((acc, p) => {
          acc[p.userId] = {
            audioEnabled:
              p.userId === userId ? mediaState?.audioEnabled ?? true : true,
            videoEnabled:
              p.userId === userId ? mediaState?.videoEnabled ?? true : true,
          };
          return acc;
        }, {}),
        participantInfo: participants.reduce((acc, p) => {
          acc[p.userId] = {
            email: p.userInfo.email,
            userId: p.userInfo.userId,
          };
          return acc;
        }, {}),
        rtpCapabilities,
        iceServers: mediasoupConfig.iceServers,
        mediaSoupEnabled: true,
      });

      // Notify other participants
      if (participants.length > 1) {
        socket.to(roomId).emit('user-joined', {
          userId,
          userEmail: socket.user.email,
        });
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
  });

  // Handle room joining
  socket.on('mediasoup:join-room', async (data) => {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' });
        return;
      }

      // Validate room access
      const token = socket.handshake.auth.token;
      const validation = await mediaSoupService.validateRoomAccess(
        roomId,
        userId,
        token
      );

      if (!validation.valid) {
        socket.emit('error', { message: validation.error });
        return;
      }

      // Create room if it doesn't exist
      let roomData = mediaSoupService.getRoom(roomId);
      if (!roomData) {
        roomData = await mediaSoupService.createRoom(roomId, userId);
      }

      // Add participant
      await mediaSoupService.addParticipant(roomId, userId, {
        email: socket.user.email,
        userId: socket.user.userId,
      });

      // Join socket room
      socket.join(roomId);

      // Get RTP capabilities
      const rtpCapabilities = await mediaSoupService.getRtpCapabilities(roomId);
      const participants = mediaSoupService.getParticipants(roomId);

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
      });

      // Notify other participants
      socket.to(roomId).emit('participant-joined', {
        userId,
        userInfo: {
          email: socket.user.email,
          userId: socket.user.userId,
        },
        joinedAt: Date.now(),
        isMediaSoupConnected: true,
      });

      logger.info('User joined room via Socket.IO', {
        roomId,
        userId,
      });
    } catch (error) {
      logger.error('Failed to join room via Socket.IO', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Handle transport creation
  socket.on('mediasoup:create-transport', async (data) => {
    try {
      const { roomId, direction } = data;
      const userId = socket.user.userId;

      const transportData = await mediaSoupService.createWebRtcTransport(
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
  });

  // Handle transport connection
  socket.on('mediasoup:connect-transport', async (data) => {
    try {
      const { roomId, transportId, dtlsParameters } = data;
      const userId = socket.user.userId;

      const result = await mediaSoupService.connectTransport(
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
  });

  // Handle producer creation
  socket.on('mediasoup:create-producer', async (data) => {
    try {
      const { roomId, transportId, rtpParameters, kind } = data;
      const userId = socket.user.userId;

      const producerData = await mediaSoupService.createProducer(
        roomId,
        transportId,
        rtpParameters,
        kind,
        userId
      );

      socket.emit('producer-created', producerData);

      // Notify other participants about new producer
      socket.to(roomId).emit('new-producer', {
        producerId: producerData.id,
        userId,
        kind,
      });

      logger.info('Producer created', {
        roomId,
        userId,
        kind,
        producerId: producerData.id,
      });
    } catch (error) {
      logger.error('Failed to create producer', error);
      socket.emit('error', { message: 'Failed to create producer' });
    }
  });

  // Handle consumer creation
  socket.on('mediasoup:create-consumer', async (data) => {
    try {
      const { roomId, transportId, producerId, rtpCapabilities } = data;
      const userId = socket.user.userId;

      const consumerData = await mediaSoupService.createConsumer(
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
  });

  // Handle producer pause/resume
  socket.on('mediasoup:producer-pause', async (data) => {
    try {
      const { roomId, producerId } = data;
      const userId = socket.user.userId;

      const result = await mediaSoupService.pauseProducer(
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
  });

  socket.on('mediasoup:producer-resume', async (data) => {
    try {
      const { roomId, producerId } = data;
      const userId = socket.user.userId;

      const result = await mediaSoupService.resumeProducer(
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
  });

  // Handle media state changes (matches current frontend flow)
  socket.on('media-state-change', async (data) => {
    try {
      const { roomId, audioEnabled, videoEnabled } = data;
      const userId = socket.user.userId;

      // Update participant media state
      await mediaSoupService.updateParticipantMediaState(roomId, userId, {
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
    }
  });

  // Handle user leaving (matches current frontend flow)
  socket.on('user-left', async (data) => {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      await mediaSoupService.removeParticipant(roomId, userId);
      socket.leave(roomId);

      // Notify other participants
      socket.to(roomId).emit('user-left', userId);

      logger.info('User left room', { roomId, userId });
    } catch (error) {
      logger.error('Failed to handle user leaving', error);
    }
  });

  // Handle participant activity
  socket.on('mediasoup:participant-activity', async (data) => {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      await mediaSoupService.updateParticipantActivity(roomId, userId);
    } catch (error) {
      logger.error('Failed to update participant activity', error);
    }
  });

  // Handle media state changes
  socket.on('media-state-change', async (data) => {
    try {
      const { roomId, audioEnabled, videoEnabled } = data;
      const userId = socket.user.userId;

      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' });
        return;
      }

      // Update participant media state
      await mediaSoupService.updateParticipantMediaState(roomId, userId, {
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
  });

  // Handle screen share started
  socket.on('screen-share-started', async (data) => {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' });
        return;
      }

      // Update participant activity
      await mediaSoupService.updateParticipantActivity(roomId, userId);

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
  });

  // Handle screen share stopped
  socket.on('screen-share-stopped', async (data) => {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' });
        return;
      }

      // Update participant activity
      await mediaSoupService.updateParticipantActivity(roomId, userId);

      // Broadcast to other participants
      socket.to(roomId).emit('screen-share-stopped');

      logger.info('Screen share stopped', {
        roomId,
        userId,
      });
    } catch (error) {
      logger.error('Failed to handle screen share stopped', error);
      socket.emit('error', { message: 'Failed to stop screen share' });
    }
  });

  // Handle screen share ready
  socket.on('screen-share-ready', async (data) => {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' });
        return;
      }

      // Update participant activity
      await mediaSoupService.updateParticipantActivity(roomId, userId);

      logger.info('Screen share ready', {
        roomId,
        userId,
      });
    } catch (error) {
      logger.error('Failed to handle screen share ready', error);
      socket.emit('error', { message: 'Failed to handle screen share ready' });
    }
  });

  // Chat handlers
  socket.on('chat:message', async (data) => {
    try {
      const { roomId, message, timestamp, type = 'text' } = data;
      const userId = socket.user.userId;

      if (!roomId || !message || message.trim().length === 0) {
        return;
      }

      // Verify user is in room
      if (!socket.rooms.has(roomId)) {
        return;
      }

      // Update participant activity
      await mediaSoupService.updateParticipantActivity(roomId, userId);

      // Broadcast message to all users in room (including sender for confirmation)
      io.to(roomId).emit('chat:message', {
        userId,
        userEmail: socket.user.email,
        message: message.trim(),
        timestamp,
        type,
      });

      logger.info('Chat message sent', {
        roomId,
        userId,
        messageLength: message.trim().length,
      });
    } catch (error) {
      logger.error('Failed to handle chat message', error);
    }
  });

  socket.on('chat:typing-start', async (data) => {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Update participant activity
      await mediaSoupService.updateParticipantActivity(roomId, userId);

      // Broadcast typing indicator to others (not to sender)
      socket.to(roomId).emit('chat:typing-start', {
        userId,
        userEmail: socket.user.email,
      });

      logger.debug('Typing started', { roomId, userId });
    } catch (error) {
      logger.error('Failed to handle typing start', error);
    }
  });

  socket.on('chat:typing-stop', async (data) => {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Update participant activity
      await mediaSoupService.updateParticipantActivity(roomId, userId);

      // Broadcast stop typing to others (not to sender)
      socket.to(roomId).emit('chat:typing-stop', {
        userId,
      });

      logger.debug('Typing stopped', { roomId, userId });
    } catch (error) {
      logger.error('Failed to handle typing stop', error);
    }
  });

  // Collaboration handlers
  socket.on('collaboration:mode', async (data) => {
    try {
      const { roomId, mode } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Update participant activity
      await mediaSoupService.updateParticipantActivity(roomId, userId);

      // Update collaboration state
      const updatedState = collaborationStateManager.updateCollaborationMode(
        roomId,
        mode,
        userId
      );

      // Broadcast mode change with proper state to all clients
      io.to(roomId).emit('collaboration:mode-changed', {
        mode,
        activeTool: mode,
        presenter: updatedState.presenter,
        changedBy: userId,
        timestamp: Date.now(),
      });

      logger.info('Collaboration mode changed', {
        roomId,
        userId,
        mode,
      });
    } catch (error) {
      logger.error('Failed to handle collaboration mode change', error);
    }
  });

  socket.on('collaboration:tool', async (data) => {
    try {
      const { roomId, tool } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Update participant activity
      await mediaSoupService.updateParticipantActivity(roomId, userId);

      // Broadcast tool change to all clients
      io.to(roomId).emit('collaboration:tool-changed', {
        tool,
        changedBy: userId,
        timestamp: Date.now(),
      });

      logger.info('Collaboration tool changed', {
        roomId,
        userId,
        tool,
      });
    } catch (error) {
      logger.error('Failed to handle collaboration tool change', error);
    }
  });

  socket.on('presentation:settings', async (data) => {
    try {
      const { roomId, settings } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Update participant activity
      await mediaSoupService.updateParticipantActivity(roomId, userId);

      // Update collaboration settings
      const success = collaborationStateManager.updateCollaborationSettings(
        roomId,
        settings,
        userId
      );

      if (success) {
        // Broadcast settings update to all clients
        io.to(roomId).emit('collaboration:settings-changed', {
          settings,
          changedBy: userId,
          timestamp: Date.now(),
        });

        logger.info('Presentation settings updated', {
          roomId,
          userId,
          settings,
        });
      } else {
        logger.warn(
          'Failed to update presentation settings - user not authorized',
          {
            roomId,
            userId,
          }
        );
      }
    } catch (error) {
      logger.error('Failed to handle presentation settings', error);
    }
  });

  socket.on('collaboration:request-state', async (data) => {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Get current collaboration state
      const state = collaborationStateManager.getCollaborationState(roomId);

      socket.emit('collaboration:state', state);

      logger.debug('Collaboration state requested', {
        roomId,
        userId,
        mode: state.mode,
      });
    } catch (error) {
      logger.error('Failed to handle collaboration state request', error);
    }
  });

  // Workflow handlers
  socket.on('workflow:operation', async (data) => {
    try {
      const { roomId, operation } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Check if user can edit
      if (!collaborationStateManager.canEdit(roomId, userId)) {
        logger.warn('Workflow operation rejected - user not authorized', {
          roomId,
          userId,
          operationType: operation.type,
        });
        return;
      }

      // Update participant activity
      await mediaSoupService.updateParticipantActivity(roomId, userId);

      // Update workflow data
      const updatedData = collaborationStateManager.updateWorkflowData(
        roomId,
        {
          ...operation,
          version: operation.version || 1,
        },
        userId
      );

      // Broadcast workflow operation to all clients
      io.to(roomId).emit('workflow:operation', {
        operation,
        userId,
        timestamp: Date.now(),
        version: updatedData.version,
      });

      logger.info('Workflow operation', {
        roomId,
        userId,
        operationType: operation.type,
        version: updatedData.version,
      });
    } catch (error) {
      logger.error('Failed to handle workflow operation', error);
    }
  });

  socket.on('workflow:request-sync', async (data) => {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Get current collaboration state
      const state = collaborationStateManager.getCollaborationState(roomId);

      socket.emit('workflow:state-sync', state);

      logger.debug('Workflow state sync requested', {
        roomId,
        userId,
        mode: state.mode,
        hasWorkflowData: !!state.workflowData,
      });
    } catch (error) {
      logger.error('Failed to handle workflow state sync request', error);
    }
  });

  // Whiteboard handlers
  socket.on('whiteboard:update', async (data) => {
    try {
      const { roomId, update } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Check if user can edit
      if (!collaborationStateManager.canEdit(roomId, userId)) {
        logger.warn('Whiteboard update rejected - user not authorized', {
          roomId,
          userId,
        });
        return;
      }

      // Update participant activity
      await mediaSoupService.updateParticipantActivity(roomId, userId);

      // Update whiteboard data
      const updatedData = collaborationStateManager.updateWhiteboardData(
        roomId,
        {
          ...update,
          version: update.version || 1,
        },
        userId
      );

      // Broadcast whiteboard update to all clients
      io.to(roomId).emit('whiteboard:update', {
        update,
        userId,
        timestamp: Date.now(),
        version: updatedData.version,
      });

      logger.info('Whiteboard update', {
        roomId,
        userId,
        updateVersion: updatedData.version,
      });
    } catch (error) {
      logger.error('Failed to handle whiteboard update', error);
    }
  });

  socket.on('whiteboard:request-sync', async (data) => {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Get current collaboration state
      const state = collaborationStateManager.getCollaborationState(roomId);

      // Send whiteboard data specifically
      socket.emit(
        'whiteboard:state-sync',
        state.whiteboardData || {
          version: 0,
          data: null,
          lastModified: new Date(),
          lastModifiedBy: null,
        }
      );

      logger.debug('Whiteboard state sync requested', {
        roomId,
        userId,
        hasWhiteboardData: !!state.whiteboardData,
      });
    } catch (error) {
      logger.error('Failed to handle whiteboard state sync request', error);
    }
  });

  // Presentation handlers
  socket.on('presentation:start', async (data) => {
    try {
      const { roomId, mode } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Update participant activity
      await mediaSoupService.updateParticipantActivity(roomId, userId);

      // Update collaboration mode
      const updatedState = collaborationStateManager.updateCollaborationMode(
        roomId,
        mode,
        userId
      );

      // Broadcast presentation start to all clients
      io.to(roomId).emit('collaboration:mode-changed', {
        mode,
        activeTool: mode,
        presenter: updatedState.presenter,
        changedBy: userId,
        timestamp: Date.now(),
      });

      logger.info('Presentation started', {
        roomId,
        userId,
        mode,
      });
    } catch (error) {
      logger.error('Failed to handle presentation start', error);
    }
  });

  socket.on('presentation:stop', async (data) => {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Update participant activity
      await mediaSoupService.updateParticipantActivity(roomId, userId);

      // Update collaboration mode to none
      const updatedState = collaborationStateManager.updateCollaborationMode(
        roomId,
        'none',
        userId
      );

      // Broadcast presentation stop to all clients
      io.to(roomId).emit('collaboration:mode-changed', {
        mode: 'none',
        activeTool: 'none',
        presenter: updatedState.presenter,
        changedBy: userId,
        timestamp: Date.now(),
      });

      logger.info('Presentation stopped', {
        roomId,
        userId,
      });
    } catch (error) {
      logger.error('Failed to handle presentation stop', error);
    }
  });

  // Handle leave room
  socket.on('mediasoup:leave-room', async (data) => {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      await mediaSoupService.removeParticipant(roomId, userId);
      socket.leave(roomId);

      // Notify other participants
      socket.to(roomId).emit('participant-left', { userId });

      logger.info('User left room', { roomId, userId });
    } catch (error) {
      logger.error('Failed to leave room', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    try {
      const userId = socket.user.userId;
      logger.info('User disconnected from MediaSoup service', { userId });

      // Clean up all rooms this user was in
      const rooms = Array.from(socket.rooms);
      for (const roomId of rooms) {
        if (roomId !== socket.id) {
          try {
            await mediaSoupService.removeParticipant(roomId, userId);
            socket.to(roomId).emit('participant-left', { userId });
          } catch (error) {
            logger.error('Error cleaning up user on disconnect', {
              roomId,
              userId,
              error,
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error handling disconnect', error);
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
  });
});

// Graceful shutdown handling
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, shutting down gracefully...');

  try {
    // Close HTTP server
    httpServer.close(() => {
      logger.info('HTTP server closed');
    });

    // Shutdown MediaSoup service
    await mediaSoupService.shutdown();

    logger.info('MediaSoup service shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const startServer = async () => {
  try {
    // Initialize MediaSoup service
    await mediaSoupService.initialize();

    // Start HTTP server
    httpServer.listen(PORT, () => {
      logger.info('MediaSoup service started successfully', {
        port: PORT,
        environment: process.env.NODE_ENV,
        workerPoolSize: mediasoupConfig.performance.workerPoolSize,
        roomServiceUrl: process.env.ROOM_SERVICE_URL,
      });
    });
  } catch (error) {
    logger.error('Failed to start MediaSoup service', error);
    process.exit(1);
  }
};

startServer();
