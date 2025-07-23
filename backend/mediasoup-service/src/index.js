import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { MediasoupServer } from './lib/MediasoupServer.js';
import { config } from './config/mediasoup.js';

// Environment variables
const PORT = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'meetlite';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5174';

// Create HTTP server
const httpServer = createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health' && req.method === 'GET') {
    const health = {
      status: 'OK',
      service: 'mediasoup-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
    return;
  }

  // Stats endpoint
  if (req.url === '/stats' && req.method === 'GET') {
    try {
      const stats = mediasoupServer.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to get stats' }));
    }
    return;
  }

  // Default response
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Create Socket.io server
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

// Initialize mediasoup server
const mediasoupServer = new MediasoupServer();

// Authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      throw new Error('No token provided');
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;

    console.log(
      `🔐 [Auth] User authenticated: ${decoded.email} (${decoded.userId})`
    );
    next();
  } catch (error) {
    console.error('❌ [Auth] Authentication failed:', error.message);
    next(new Error('Authentication failed'));
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(
    `🔌 [Socket] User connected: ${socket.user.email} (${socket.id})`
  );

  let currentRoom = null;
  let currentParticipant = null;

  // Join room
  socket.on('join-room', async (data) => {
    try {
      const { roomId } = data;
      console.log(`🏠 [Socket] ${socket.user.email} joining room: ${roomId}`);

      // Leave current room if any
      if (currentRoom && currentParticipant) {
        currentRoom.removeParticipant(currentParticipant.id);
      }

      // Join socket room for signaling
      socket.join(roomId);
      currentRoom = await mediasoupServer.getOrCreateRoom(roomId);

      // Send router RTP capabilities to client
      socket.emit('router-rtp-capabilities', {
        rtpCapabilities: currentRoom.router.rtpCapabilities,
      });

      console.log(`✅ [Socket] ${socket.user.email} joined room: ${roomId}`);
    } catch (error) {
      console.error(`❌ [Socket] Failed to join room:`, error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Create WebRTC transport
  socket.on('create-webrtc-transport', async (data) => {
    try {
      const { roomId, direction } = data; // direction: 'send' or 'recv'

      if (!currentRoom || currentRoom.roomId !== roomId) {
        throw new Error('Not in room or room mismatch');
      }

      const transportData = await mediasoupServer.createWebRtcTransport(roomId);

      // Create participant if not exists
      if (!currentParticipant) {
        currentParticipant = await currentRoom.addParticipant(
          socket.user.userId,
          transportData.transport,
          socket,
          {
            email: socket.user.email,
            userId: socket.user.userId,
          }
        );
      }

      // Store transport based on direction
      if (direction === 'send') {
        currentParticipant.sendTransport = transportData.transport;
      } else if (direction === 'recv') {
        currentParticipant.recvTransport = transportData.transport;
      }

      socket.emit('webrtc-transport-created', {
        id: transportData.id,
        iceParameters: transportData.iceParameters,
        iceCandidates: transportData.iceCandidates,
        dtlsParameters: transportData.dtlsParameters,
        direction,
      });

      console.log(
        `🌐 [Socket] WebRTC ${direction} transport created for ${socket.user.email}`
      );
    } catch (error) {
      console.error('❌ [Socket] Failed to create WebRTC transport:', error);
      socket.emit('error', { message: 'Failed to create transport' });
    }
  });

  // Connect WebRTC transport
  socket.on('connect-webrtc-transport', async (data) => {
    try {
      const { dtlsParameters, direction } = data;

      if (!currentParticipant) {
        throw new Error('No participant available');
      }

      const transport =
        direction === 'send'
          ? currentParticipant.sendTransport
          : currentParticipant.recvTransport;

      if (!transport) {
        throw new Error(`No ${direction} transport available`);
      }

      await transport.connect({ dtlsParameters });
      console.log(
        `🔗 [Socket] WebRTC ${direction} transport connected for ${socket.user.email}`
      );
    } catch (error) {
      console.error('❌ [Socket] Failed to connect transport:', error);
      socket.emit('error', { message: 'Failed to connect transport' });
    }
  });

  // Set RTP capabilities
  socket.on('set-rtp-capabilities', async (data) => {
    try {
      const { rtpCapabilities } = data;

      if (!currentParticipant) {
        throw new Error('Participant not found');
      }

      currentParticipant.setRtpCapabilities(rtpCapabilities);

      // Create consumers for existing producers now that we have RTP capabilities
      await currentRoom.createConsumersForParticipant(currentParticipant);

      console.log(`📡 [Socket] RTP capabilities set for ${socket.user.email}`);
    } catch (error) {
      console.error('❌ [Socket] Failed to set RTP capabilities:', error);
      socket.emit('error', { message: 'Failed to set RTP capabilities' });
    }
  });

  // Create producer (enhanced for different media types)
  socket.on('create-producer', async (data) => {
    try {
      const { kind, rtpParameters, appData } = data;

      if (!currentParticipant || !currentParticipant.transport) {
        throw new Error('No transport available');
      }

      let producer;

      // Determine producer type based on appData
      if (appData?.screen) {
        if (kind === 'video') {
          producer = await currentParticipant.createScreenVideoProducer(
            rtpParameters
          );
        } else if (kind === 'audio') {
          producer = await currentParticipant.createScreenAudioProducer(
            rtpParameters
          );
        }
      } else {
        if (kind === 'video') {
          producer = await currentParticipant.createVideoProducer(
            rtpParameters
          );
        } else if (kind === 'audio') {
          producer = await currentParticipant.createAudioProducer(
            rtpParameters
          );
        }
      }

      if (!producer) {
        throw new Error('Failed to create producer');
      }

      socket.emit('producer-created', {
        producerId: producer.id,
        kind: producer.kind,
        appData: producer.appData,
      });

      console.log(
        `📹 [Socket] ${kind} producer created for ${socket.user.email}: ${producer.id}`
      );
    } catch (error) {
      console.error('❌ [Socket] Failed to create producer:', error);
      socket.emit('error', { message: 'Failed to create producer' });
    }
  });

  // Resume consumer (critical for media playback)
  socket.on('resume-consumer', async (data) => {
    try {
      const { consumerId } = data;

      if (!currentParticipant) {
        throw new Error('Participant not found');
      }

      await currentParticipant.resumeConsumer(consumerId);
      console.log(
        `▶️ [Socket] Consumer resumed for ${socket.user.email}: ${consumerId}`
      );
    } catch (error) {
      console.error('❌ [Socket] Failed to resume consumer:', error);
      socket.emit('error', { message: 'Failed to resume consumer' });
    }
  });

  // Pause consumer
  socket.on('pause-consumer', async (data) => {
    try {
      const { consumerId } = data;

      if (!currentParticipant) {
        throw new Error('Participant not found');
      }

      await currentParticipant.pauseConsumer(consumerId);
      console.log(
        `⏸️ [Socket] Consumer paused for ${socket.user.email}: ${consumerId}`
      );
    } catch (error) {
      console.error('❌ [Socket] Failed to pause consumer:', error);
      socket.emit('error', { message: 'Failed to pause consumer' });
    }
  });

  // Pause producer
  socket.on('pause-producer', async (data) => {
    try {
      const { kind } = data;

      if (!currentParticipant) {
        throw new Error('Participant not found');
      }

      await currentParticipant.pauseProducer(kind);
      console.log(
        `⏸️ [Socket] Producer paused for ${socket.user.email}: ${kind}`
      );
    } catch (error) {
      console.error('❌ [Socket] Failed to pause producer:', error);
      socket.emit('error', { message: 'Failed to pause producer' });
    }
  });

  // Resume producer
  socket.on('resume-producer', async (data) => {
    try {
      const { kind } = data;

      if (!currentParticipant) {
        throw new Error('Participant not found');
      }

      await currentParticipant.resumeProducer(kind);
      console.log(
        `▶️ [Socket] Producer resumed for ${socket.user.email}: ${kind}`
      );
    } catch (error) {
      console.error('❌ [Socket] Failed to resume producer:', error);
      socket.emit('error', { message: 'Failed to resume producer' });
    }
  });

  // Close producer
  socket.on('close-producer', async (data) => {
    try {
      const { kind } = data;

      if (!currentParticipant) {
        throw new Error('Participant not found');
      }

      await currentParticipant.closeProducer(kind);
      console.log(
        `🔴 [Socket] Producer closed for ${socket.user.email}: ${kind}`
      );
    } catch (error) {
      console.error('❌ [Socket] Failed to close producer:', error);
      socket.emit('error', { message: 'Failed to close producer' });
    }
  });

  // Get participant stats
  socket.on('get-participant-stats', () => {
    try {
      if (!currentParticipant) {
        throw new Error('Participant not found');
      }

      const stats = currentParticipant.getStats();
      socket.emit('participant-stats', stats);
    } catch (error) {
      console.error('❌ [Socket] Failed to get participant stats:', error);
      socket.emit('error', { message: 'Failed to get stats' });
    }
  });

  // Resume all consumers (useful for connection recovery)
  socket.on('resume-all-consumers', async () => {
    try {
      if (!currentParticipant) {
        throw new Error('Participant not found');
      }

      await currentParticipant.resumeAllConsumers();
      console.log(`🔄 [Socket] All consumers resumed for ${socket.user.email}`);
    } catch (error) {
      console.error('❌ [Socket] Failed to resume all consumers:', error);
      socket.emit('error', { message: 'Failed to resume all consumers' });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`🔌 [Socket] User disconnected: ${socket.user.email}`);

    // Clean up participant and room
    if (currentRoom && currentParticipant) {
      currentRoom.removeParticipant(currentParticipant.id);
    }
  });

  // Error handling
  socket.on('error', (error) => {
    console.error(`❌ [Socket] Socket error for ${socket.user.email}:`, error);
  });
});

// Initialize and start server
async function startServer() {
  try {
    // Initialize mediasoup
    await mediasoupServer.init();

    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`🚀 [Server] Mediasoup service listening on port ${PORT}`);
      console.log(`🔗 [Server] CORS origin: ${CORS_ORIGIN}`);
      console.log(`📊 [Server] Workers: ${config.numWorkers}`);
    });
  } catch (error) {
    console.error('❌ [Server] Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 [Server] Received SIGINT, shutting down gracefully...');

  try {
    await mediasoupServer.close();
    httpServer.close(() => {
      console.log('✅ [Server] Server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ [Server] Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 [Server] Received SIGTERM, shutting down gracefully...');

  try {
    await mediasoupServer.close();
    httpServer.close(() => {
      console.log('✅ [Server] Server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ [Server] Error during shutdown:', error);
    process.exit(1);
  }
});

// Start the server
startServer();
