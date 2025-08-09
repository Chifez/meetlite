import { createServer } from 'http';
import { Server } from 'socket.io';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';

import { authMiddleware } from './middleware/auth.js';
import { StateManager } from './services/stateManager.js';
import { ConnectionManager } from './services/connectionManager.js';
import { ScreenShareManager } from './services/screenShareManager.js';
import { TldrawService } from './services/tldrawService.js';
import { FileHandler } from './handlers/fileHandler.js';

import { RoomHandler } from './handlers/roomHandler.js';
import { MediaHandler } from './handlers/mediaHandler.js';
import { ChatHandler } from './handlers/chatHandler.js';
import { CollaborationHandler } from './handlers/collaborationHandler.js';
import { WorkflowHandler } from './handlers/workflowHandler.js';
import { WhiteboardHandler } from './handlers/whiteboardHandler.js';

dotenv.config();

// Initialize FileHandler
const fileHandler = new FileHandler();

// Create HTTP server
const httpServer = createServer((req, res) => {
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
    };
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
const stateManager = new StateManager();
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
  console.log('User connected:', socket.user.email, 'Socket ID:', socket.id);

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
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  tldrawService.cleanup();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  tldrawService.cleanup();
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 5002;
httpServer.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
