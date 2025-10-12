import { createServer } from 'http';
import { Server } from 'socket.io';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { createAdapter } from '@socket.io/redis-adapter';

import {
  connectRedis,
  disconnectRedis,
  isRedisReady,
  getRedisHealth,
  pubClient,
  subClient,
  getPerformanceMetrics,
  getErrorMetrics,
  getComprehensiveHealth,
  isCircuitBreakerOpen,
} from './config/redis.js';

import { authMiddleware } from './middleware/auth.js';
import { HybridStateManager } from './services/hybridStateManager.js';
import { ConnectionManager } from './services/connectionManager.js';
import { ScreenShareManager } from './services/screenShareManager.js';
import { TldrawService } from './services/tldrawService.js';
import { SessionManager } from './services/sessionManager.js';
import { FileHandler } from './handlers/fileHandler.js';

import { RoomHandler } from './handlers/roomHandler.js';
import { MediaHandler } from './handlers/mediaHandler.js';
import { ChatHandler } from './handlers/chatHandler.js';
import { CollaborationHandler } from './handlers/collaborationHandler.js';
import { WorkflowHandler } from './handlers/workflowHandler.js';
import { WhiteboardHandler } from './handlers/whiteboardHandler.js';

dotenv.config();

// Initialize Redis connection
let redisConnected = false;

const initializeRedis = async () => {
  try {
    redisConnected = await connectRedis();
  } catch (error) {
    console.error('Redis initialization error:', error);
    redisConnected = false;
  }
};

// Initialize FileHandler
const fileHandler = new FileHandler();

// Create HTTP server
const httpServer = createServer(async (req, res) => {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === '/health' && req.method === 'GET') {
    const health = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      connections: io?.engine?.clientsCount || 0,
      rooms: io?.sockets?.adapter?.rooms?.size || 0,
      tldrawRooms: tldrawService.getRoomStats(),
      redis: getRedisHealth(),
      mode: redisConnected ? 'redis' : 'memory-only',
      adapter: {
        type: io.sockets.adapter.constructor.name,
        isRedis: isRedisAdapterActive(),
        rooms: io.sockets.adapter.rooms.size || 0,
      },
      services: {
        stateManager: 'active',
        sessionManager: sessionManager.isAvailable ? 'active' : 'inactive',
        connectionManager: 'active',
        screenShareManager: 'active',
      },
      connections: await connectionManager.getConnectionStats(),
      connectionHealth: await stateManager.getAllConnectionHealth(),
      performance: {
        redis: getPerformanceMetrics(),
        stateManager: await stateManager.getRedisStats(),
        detailed: await stateManager.redisState.getPerformanceMetrics(),
        connectionManager: connectionManager.getPerformanceMetrics(),
      },
      errorHandling: {
        redis: getErrorMetrics(),
        comprehensive: getComprehensiveHealth(),
        circuitBreaker: {
          isOpen: isCircuitBreakerOpen(),
          state: getComprehensiveHealth().circuitBreaker,
        },
        stateManager: stateManager.redisState.getComprehensiveHealth(),
        errorRecovery: await stateManager.getErrorRecoveryMetrics(),
      },
    };

    // Add Redis statistics if available
    if (redisConnected) {
      try {
        const redisStats = await stateManager.getRedisStats();
        const sessionStats = await sessionManager.getSessionStats();
        const redisPerformance =
          await stateManager.redisState.getPerformanceStats();
        const redisMemory = await stateManager.redisState.getMemoryAnalysis();
        const redisConnections =
          await stateManager.redisState.getConnectionPoolStatus();

        health.redisStats = redisStats;
        health.sessionStats = sessionStats;
        health.redisPerformance = redisPerformance;
        health.redisMemory = redisMemory;
        health.redisConnections = redisConnections;
      } catch (error) {
        health.redisStats = { error: error.message };
        health.sessionStats = { error: error.message };
        health.redisPerformance = { error: error.message };
        health.redisMemory = { error: error.message };
        health.redisConnections = { error: error.message };
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
    return;
  }

  // Handle file uploads
  if (
    req.url.startsWith('/uploads/') &&
    (req.method === 'POST' || req.method === 'PUT')
  ) {
    fileHandler.handleUpload(req, res);
    return;
  }

  // Handle file serving
  if (req.url.startsWith('/uploads/') && req.method === 'GET') {
    fileHandler.handleFileServe(req, res);
    return;
  }

  // Default response for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Create Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

// Setup Redis adapter for Socket.IO scaling when Redis is ready
const setupRedisAdapter = () => {
  if (redisConnected && isRedisReady()) {
    try {
      const redisAdapter = createAdapter(pubClient, subClient);

      // Monitor Redis client health
      const healthCheckInterval = setInterval(async () => {
        if (!isRedisReady()) {
          clearInterval(healthCheckInterval);
          fallbackToMemoryAdapter();
        }
      }, 30000); // Check every 30 seconds

      io.adapter(redisAdapter);
    } catch (error) {
      console.error('Failed to setup Redis adapter:', error);
      fallbackToMemoryAdapter();
    }
  }
};

// Check if Redis adapter is currently active
const isRedisAdapterActive = () => {
  return io.sockets.adapter.constructor.name === 'RedisAdapter';
};

// Fallback to memory adapter when Redis fails
const fallbackToMemoryAdapter = () => {
  try {
    // Remove Redis adapter
    io.adapter();

    // Attempt to reconnect Redis adapter after delay
    setTimeout(() => {
      if (redisConnected && isRedisReady()) {
        setupRedisAdapter();
      }
    }, 5000); // Wait 5 seconds before retry
  } catch (error) {
    console.error('Error during fallback to memory adapter:', error);
  }
};

// Create WebSocket server for Tldraw
const wss = new WebSocketServer({
  noServer: true,
});

// Initialize Tldraw service
const tldrawService = new TldrawService();

// Handle WebSocket upgrade for Tldraw
httpServer.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`)
    .pathname;

  if (pathname.startsWith('/connect')) {
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

// Initialize services
const stateManager = new HybridStateManager();
const sessionManager = new SessionManager();
const connectionManager = new ConnectionManager(io, stateManager);
const screenShareManager = new ScreenShareManager(io, stateManager);

// Initialize handlers
const collaborationHandler = new CollaborationHandler(io, stateManager);
const roomHandler = new RoomHandler(
  io,
  stateManager,
  connectionManager,
  screenShareManager
);
const mediaHandler = new MediaHandler(io, stateManager);
const chatHandler = new ChatHandler(io, stateManager);
const workflowHandler = new WorkflowHandler(
  io,
  stateManager,
  collaborationHandler
);
const whiteboardHandler = new WhiteboardHandler(
  io,
  stateManager,
  collaborationHandler
);

// Setup authentication middleware
io.use(authMiddleware);

// Handle socket connections
io.on('connection', (socket) => {
  // Initialize user state
  stateManager.setUserSocket(socket.user.userId, socket.id);
  stateManager.setUserInfo(socket.user.userId, {
    email: socket.user.email,
    userId: socket.user.userId,
  });

  // Setup all handlers
  roomHandler.setupSocketHandlers(socket);
  mediaHandler.setupSocketHandlers(socket);
  chatHandler.setupSocketHandlers(socket);
  collaborationHandler.setupSocketHandlers(socket);
  workflowHandler.setupSocketHandlers(socket);
  whiteboardHandler.setupSocketHandlers(socket);
  connectionManager.setupSocketHandlers(socket);
  screenShareManager.setupSocketHandlers(socket);
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  tldrawService.cleanup();
  await stateManager.shutdown();
  await sessionManager.shutdown();

  // Cleanup connection manager
  if (connectionManager && typeof connectionManager.cleanup === 'function') {
    connectionManager.cleanup();
  }

  if (redisConnected) {
    await disconnectRedis();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  tldrawService.cleanup();
  await stateManager.shutdown();
  await sessionManager.shutdown();

  // Cleanup connection manager
  if (connectionManager && typeof connectionManager.cleanup === 'function') {
    connectionManager.cleanup();
  }

  if (redisConnected) {
    await disconnectRedis();
  }
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 5002;
httpServer.listen(PORT, async () => {
  console.log(`Signaling server started on port ${PORT}`);

  // Initialize Redis after server starts
  await initializeRedis();

  // Setup Redis adapter after Redis is ready
  if (redisConnected) {
    // Wait a bit for Redis to be fully ready
    setTimeout(() => {
      setupRedisAdapter();
    }, 1000);
  }

  // Load state from Redis
  await stateManager.loadFromRedis();

  // Wait for session manager to be ready
  await new Promise((resolve) => setTimeout(resolve, 1000));
});
