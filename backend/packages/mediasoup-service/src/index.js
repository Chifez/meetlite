import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';

import { logger, requestLogger } from './utils/logger.js';
import { authMiddleware } from './middleware/auth.js';
import {
  errorHandler,
  notFoundHandler,
  socketErrorHandler,
} from './middleware/errorHandler.js';
import { MediaSoupService } from './services/MediaSoupService.js';
import { CollaborationStateManager } from './services/CollaborationStateManager.js';
import { TldrawService } from './services/TldrawService.js';
import { mediasoupConfig } from './config/mediasoup.js';

// Import controllers
import { MediaController } from './controllers/MediaController.js';
import { CollaborationController } from './controllers/CollaborationController.js';
import { RoomController } from './controllers/RoomController.js';
import { FileHandler } from './handlers/FileHandler.js';

// Import routes
import { createMediaRoutes } from './routes/media.js';
import { setupSocketRoutes } from './routes/socket.js';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3003;

// Security middleware - Disabled due to CORS conflicts
// Helmet's Cross-Origin-Resource-Policy: same-origin blocks file serving to frontend
// For production, consider custom security headers or Helmet with proper CORP configuration
// app.use(helmet());

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
const mediaSoupService = new MediaSoupService(collaborationStateManager);

// Initialize Tldraw service
const tldrawService = new TldrawService();

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

// ============================================================================
// WEBSOCKET UPGRADE HANDLING FOR TLdraw
// ============================================================================

// Handle WebSocket upgrade for Tldraw
httpServer.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`)
    .pathname;

  if (pathname.startsWith('/connect')) {
    logger.info(`Tldraw WebSocket upgrade request: ${pathname}`);
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Handle Tldraw WebSocket connections
wss.on('connection', (ws, req) => {
  tldrawService.handleWebSocketConnection(ws, req);
});

// ============================================================================
// FILE UPLOAD/SERVE HANDLING
// ============================================================================

// Handle file uploads and serving for Tldraw (must be BEFORE API routes)
app.use((req, res, next) => {
  if (!req.url.startsWith('/uploads/')) {
    return next();
  }

  // Handle file uploads
  if (req.method === 'POST' || req.method === 'PUT') {
    return fileHandler.handleUpload(req, res);
  }

  // Handle file serving
  if (req.method === 'GET') {
    return fileHandler.handleFileServe(req, res);
  }

  // Continue for other methods (OPTIONS handled by CORS middleware)
  next();
});

// ============================================================================
// ROUTES SETUP
// ============================================================================

// Health check endpoint
app.get('/health', (req, res) => {
  const stats = mediaSoupService.getStats();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    mediasoup: stats,
    tldrawRooms: tldrawService.getRoomStats(),
    config: {
      port: PORT,
      environment: process.env.NODE_ENV,
      workerPoolSize: mediasoupConfig.performance.workerPoolSize,
    },
  });
});

// API Routes
app.use('/api/media', createMediaRoutes(mediaController));

// ============================================================================
// SOCKET.IO SETUP
// ============================================================================

// Setup authentication middleware for Socket.IO
io.use(authMiddleware);

// Setup Socket.IO routes
setupSocketRoutes(io, mediaController, collaborationController, roomController);

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', notFoundHandler);

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
