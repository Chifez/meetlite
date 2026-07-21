import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import redisClient from './config/redis.js';

import { logger, requestLogger } from './utils/logger.js';
import { authMiddleware } from './middleware/auth.js';
import {
  errorHandler,
  notFoundHandler,
  socketErrorHandler,
} from './middleware/error-handler.js';
import { MediaSoupService } from './services/media-soup-service.js';
import { CollaborationStateManager } from './services/collaboration-state-manager.js';
import { TldrawService } from './services/tldraw-service.js';
import { YjsSyncService } from './services/yjs-sync-service.js';
import { RecordingService } from './services/recording-service.js';
import { mediasoupConfig } from './config/mediasoup.js';

// Import controllers
import { MediaController } from './controllers/media-controller.js';
import { CollaborationController } from './controllers/collaboration-controller.js';
import { RoomController } from './controllers/room-controller.js';
import { YjsController } from './controllers/yjs-controller.js';
import { RecordingController } from './controllers/recording-controller.js';
import { FileHandler } from './handlers/file-handler.js';

// Import routes
import { createMediaRoutes } from './routes/media.js';
import { setupSocketRoutes } from './routes/socket.js';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3003;

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// CORS configuration - Allow frontend to access MediaSoup service directly
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5174',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger as any);

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

// Create WebSocket server for Tldraw
const wss = new WebSocketServer({
  noServer: true,
});

// ============================================================================
// SERVICE INITIALIZATION
// ============================================================================

// Initialize collaboration state manager
const collaborationStateManager = new CollaborationStateManager();

// Initialize MediaSoup service with collaboration state manager
const mediaSoupService = new MediaSoupService(collaborationStateManager as any);
mediaSoupService.setSocketIo(io);

// Initialize Tldraw service
const tldrawService = new TldrawService();

// Initialize Yjs sync service
const yjsSyncService = new YjsSyncService();

// Start Yjs awareness cleanup task (runs every 60 seconds)
yjsSyncService.startAwarenessCleanup(60000);

// Initialize Recording service (after mediaSoupService)
const recordingService = new RecordingService(mediaSoupService);

// Initialize FileHandler
const fileHandler = new FileHandler();

// ============================================================================
// CONTROLLER INITIALIZATION
// ============================================================================

// Initialize controllers
const mediaController = new MediaController(mediaSoupService, io);
const collaborationController = new CollaborationController(
  mediaSoupService,
  collaborationStateManager,
  io
);
const roomController = new RoomController(mediaSoupService, io);
const yjsController = new YjsController(yjsSyncService, io);
const recordingController = new RecordingController(recordingService, io, mediaSoupService);

// Register recording service so mediaSoupService can stop recordings when rooms empty out
mediaSoupService.setRecordingService(recordingService);


// ============================================================================
// WEBSOCKET UPGRADE HANDLING FOR TLdraw
// ============================================================================

// Handle WebSocket upgrade for Tldraw
httpServer.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url!, `http://${request.headers.host}`)
    .pathname;

  if (pathname.startsWith('/connect')) {
    logger.info(`Tldraw WebSocket upgrade request: ${pathname}`);
    wss.handleUpgrade(request, socket, head, (ws: any) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Handle Tldraw WebSocket connections
wss.on('connection', (ws: any, req: any) => {
  tldrawService.handleWebSocketConnection(ws, req);
});

// ============================================================================
// FILE UPLOAD/SERVE HANDLING
// ============================================================================

// Handle file uploads and serving for Tldraw (must be BEFORE API routes)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.url.startsWith('/uploads/')) {
    return next();
  }

  // Handle file uploads
  if (req.method === 'POST' || req.method === 'PUT') {
    return (fileHandler as any).handleUpload(req, res);
  }

  // Handle file serving
  if (req.method === 'GET') {
    return (fileHandler as any).handleFileServe(req, res);
  }

  next();
});

// ============================================================================
// ROUTES SETUP
// ============================================================================

// API Routes
app.use('/api/media', createMediaRoutes(mediaController));

// ============================================================================
// SOCKET.IO SETUP
// ============================================================================

// Setup authentication middleware for Socket.IO
io.use(authMiddleware as any);

// Setup Socket.IO routes
setupSocketRoutes(
  io,
  mediaController,
  collaborationController,
  roomController,
  yjsController,
  recordingController as any
);

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

// Error handling middleware
app.use(errorHandler as any);

// 404 handler
app.use('*', notFoundHandler as any);

// ============================================================================
// GRACEFUL SHUTDOWN HANDLING
// ============================================================================

const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, shutting down gracefully...');

  try {
    // Close HTTP server
    httpServer.close(() => {
      logger.info('HTTP server closed');
    });

    // Cleanup Recording service first (stop active recordings)
    await recordingService.cleanup();

    // Shutdown MediaSoup service
    await mediaSoupService.shutdown();

    // Cleanup Tldraw service
    tldrawService.cleanup();

    logger.info('MediaSoup service shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// ============================================================================
// SERVER STARTUP
// ============================================================================

const startServer = async () => {
  try {
    // Initialize Redis client
    await redisClient.connect();
    const { pubClient, subClient } = redisClient.getPubSubClients();
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Redis adapter configured for Socket.IO');

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
// Trigger nodemon reload for shared updates
