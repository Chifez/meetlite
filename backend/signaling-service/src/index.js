import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const httpServer = createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health' && req.method === 'GET') {
    const health = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      connections: io?.engine?.clientsCount || 0,
      rooms: io?.sockets?.adapter?.rooms?.size || 0,
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
    return;
  }

  // Default response for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

// Enhanced room state management
const roomState = new Map();
const userToSocket = new Map();
const socketToUser = new Map();
const activeConnections = new Map(); // Track active peer connections
const screenSharingState = new Map(); // Track screen sharing state per room
const userInfo = new Map(); // Store user information by userId
const collaborationState = new Map(); // New: Track collaboration state

// Helper function to determine who should initiate the connection
const shouldInitiateConnection = (userA, userB) => {
  // Use lexicographic ordering to ensure consistent initiator selection
  return userA < userB;
};

// Helper function to create connection key
const createConnectionKey = (userA, userB) => {
  return [userA, userB].sort().join('_');
};

// Helper function to create screen sharing connection key
const createScreenConnectionKey = (userA, userB) => {
  return `screen_${[userA, userB].sort().join('_')}`;
};

// Middleware to verify JWT
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Authentication error'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.user.email, 'Socket ID:', socket.id);

  userToSocket.set(socket.user.userId, socket.id);
  socketToUser.set(socket.id, socket.user.userId);

  // Store user information for this session
  userInfo.set(socket.user.userId, {
    email: socket.user.email,
    userId: socket.user.userId,
  });

  socket.on('ready', ({ roomId, mediaState, collaborationData }) => {
    console.log(`User ${socket.user.userId} joining room ${roomId}`);

    socket.join(roomId);

    // Initialize states
    if (!roomState.has(roomId)) {
      roomState.set(roomId, new Map());
    }

    if (!screenSharingState.has(roomId)) {
      screenSharingState.set(roomId, null);
    }

    if (!collaborationState.has(roomId)) {
      collaborationState.set(roomId, {
        mode: 'none',
        activeTool: 'none',
        workflowData: null,
        whiteboardData: null,
      });
    }

    const existingParticipants = [];
    const roomSockets = io.sockets.adapter.rooms.get(roomId);

    if (roomSockets) {
      roomSockets.forEach((socketId) => {
        if (socketId !== socket.id) {
          const userId = socketToUser.get(socketId);
          if (userId) {
            existingParticipants.push(userId);
          }
        }
      });
    }

    const room = roomState.get(roomId);
    room.set(socket.user.userId, {
      audioEnabled: mediaState.audioEnabled,
      videoEnabled: mediaState.videoEnabled,
    });

    existingParticipants.forEach((existingUserId) => {
      const connectionKey = createConnectionKey(
        socket.user.userId,
        existingUserId
      );

      if (activeConnections.has(connectionKey)) {
        return;
      }

      activeConnections.set(connectionKey, {
        users: [socket.user.userId, existingUserId],
        timestamp: Date.now(),
        status: 'initiating',
      });

      const shouldInitiate = shouldInitiateConnection(
        socket.user.userId,
        existingUserId
      );

      if (shouldInitiate) {
        socket.emit('initiate-connection', {
          targetUserId: existingUserId,
          isInitiator: true,
        });

        const targetSocketId = userToSocket.get(existingUserId);
        if (targetSocketId) {
          io.to(targetSocketId).emit('initiate-connection', {
            targetUserId: socket.user.userId,
            isInitiator: false,
          });
        }
      } else {
        const targetSocketId = userToSocket.get(existingUserId);
        if (targetSocketId) {
          io.to(targetSocketId).emit('initiate-connection', {
            targetUserId: socket.user.userId,
            isInitiator: true,
          });
        }

        socket.emit('initiate-connection', {
          targetUserId: existingUserId,
          isInitiator: false,
        });
      }
    });

    const allParticipants = [socket.user.userId, ...existingParticipants];
    const roomStateData = Object.fromEntries(room);

    // Create participant info with user details
    const participantInfo = {};
    allParticipants.forEach((participantId) => {
      const user = userInfo.get(participantId);
      if (user) {
        participantInfo[participantId] = {
          email: user.email,
          userId: user.userId,
        };
      }
    });

    io.to(roomId).emit('room-data', {
      participants: allParticipants,
      mediaState: roomStateData,
      participantInfo, // Send user information for all participants
    });

    if (existingParticipants.length > 0) {
      socket.to(roomId).emit('user-joined', {
        userId: socket.user.userId,
        userEmail: socket.user.email,
      });
    }

    const currentScreenSharer = screenSharingState.get(roomId);
    if (currentScreenSharer) {
      socket.emit('screen-share-started', { userId: currentScreenSharer });

      const connectionKey = createScreenConnectionKey(
        currentScreenSharer,
        socket.user.userId
      );
      if (!activeConnections.has(connectionKey)) {
        activeConnections.set(connectionKey, {
          users: [currentScreenSharer, socket.user.userId],
          timestamp: Date.now(),
          status: 'screen-initiating',
        });

        const sharerSocketId = userToSocket.get(currentScreenSharer);
        if (sharerSocketId) {
          io.to(sharerSocketId).emit('initiate-screen-connection', {
            targetUserId: socket.user.userId,
            isInitiator: true,
          });
        }
      }
    }

    // Send current collaboration state
    const currentCollabState = collaborationState.get(roomId);
    socket.emit('collaboration:state', currentCollabState);

    // Clean up old connection tracking
    const oneMinuteAgo = Date.now() - 60000;
    for (const [key, connection] of activeConnections.entries()) {
      if (connection.timestamp < oneMinuteAgo) {
        activeConnections.delete(key);
      }
    }
  });

  // WebRTC signaling
  socket.on('call-user', ({ to, offer }) => {
    const targetSocketId = userToSocket.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call-user', {
        from: socket.user.userId,
        offer,
      });
    }
  });

  socket.on('make-answer', ({ to, answer }) => {
    const targetSocketId = userToSocket.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('answer-made', {
        from: socket.user.userId,
        answer,
      });
    }
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    const targetSocketId = userToSocket.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice-candidate', {
        from: socket.user.userId,
        candidate,
      });
    }
  });

  // Screen sharing signaling
  socket.on('screen-share-call', ({ to, offer }) => {
    const targetSocketId = userToSocket.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('screen-share-call', {
        from: socket.user.userId,
        offer,
      });
    }
  });

  socket.on('screen-share-answer', ({ to, answer }) => {
    const targetSocketId = userToSocket.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('screen-share-answer', {
        from: socket.user.userId,
        answer,
      });
    }
  });

  socket.on('screen-share-candidate', ({ to, candidate }) => {
    const targetSocketId = userToSocket.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('screen-share-candidate', {
        from: socket.user.userId,
        candidate,
      });
    }
  });

  socket.on('screen-share-started', ({ roomId }) => {
    console.log(
      `Screen sharing started by ${socket.user.userId} in room ${roomId}`
    );
    screenSharingState.set(roomId, socket.user.userId);

    socket
      .to(roomId)
      .emit('screen-share-started', { userId: socket.user.userId });
  });

  socket.on('screen-share-ready', ({ roomId }) => {
    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    if (roomSockets) {
      roomSockets.forEach((socketId) => {
        if (socketId !== socket.id) {
          const userId = socketToUser.get(socketId);
          if (userId) {
            io.to(socket.id).emit('initiate-screen-connection', {
              targetUserId: userId,
              isInitiator: true,
            });
          }
        }
      });
    }
  });

  socket.on('screen-share-stopped', ({ roomId }) => {
    console.log(
      `Screen sharing stopped by ${socket.user.userId} in room ${roomId}`
    );
    screenSharingState.set(roomId, null);
    socket.to(roomId).emit('screen-share-stopped');
  });

  socket.on('media-state-change', ({ roomId, audioEnabled, videoEnabled }) => {
    const room = roomState.get(roomId);
    if (room && room.has(socket.user.userId)) {
      room.set(socket.user.userId, { audioEnabled, videoEnabled });

      socket.to(roomId).emit('media-state-update', {
        userId: socket.user.userId,
        audioEnabled,
        videoEnabled,
      });
    }
  });

  // Collaboration mode change
  socket.on('collaboration:mode', ({ roomId, mode }) => {
    const collabState = collaborationState.get(roomId);
    if (collabState) {
      collabState.mode = mode;
      collabState.activeTool = mode; // Initially set tool to match mode

      io.to(roomId).emit('collaboration:mode-changed', {
        mode,
        activeTool: mode,
        changedBy: socket.user.userId,
      });
    }
  });

  // Tool switching
  socket.on('collaboration:tool', ({ roomId, tool }) => {
    const collabState = collaborationState.get(roomId);
    if (collabState && collabState.mode !== 'none') {
      collabState.activeTool = tool;

      io.to(roomId).emit('collaboration:tool-changed', {
        tool,
        changedBy: socket.user.userId,
      });
    }
  });

  // Workflow operations
  socket.on('workflow:operation', ({ roomId, operation }) => {
    const collabState = collaborationState.get(roomId);
    if (collabState && collabState.mode === 'workflow') {
      // Update workflow state
      if (!collabState.workflowData) {
        collabState.workflowData = { nodes: [], edges: [] };
      }

      // Apply operation to workflow data
      applyWorkflowOperation(collabState.workflowData, operation);

      // Broadcast to other participants
      socket.to(roomId).emit('workflow:operation', {
        operation,
        userId: socket.user.userId,
        timestamp: Date.now(),
      });
    }
  });

  // Whiteboard updates
  socket.on('whiteboard:update', ({ roomId, update }) => {
    const collabState = collaborationState.get(roomId);
    if (collabState && collabState.mode === 'whiteboard') {
      if (!collabState.whiteboardData) {
        collabState.whiteboardData = {
          version: 0,
          lastModified: new Date(),
          lastModifiedBy: socket.user.userId,
        };
      }

      collabState.whiteboardData.version++;
      collabState.whiteboardData.lastModified = new Date();
      collabState.whiteboardData.lastModifiedBy = socket.user.userId;

      // Broadcast update to other participants
      socket.to(roomId).emit('whiteboard:update', {
        update,
        userId: socket.user.userId,
        timestamp: Date.now(),
        version: collabState.whiteboardData.version,
      });
    }
  });

  // Chat functionality
  socket.on('chat:message', (data) => {
    const { roomId, userId, userEmail, message, timestamp, type } = data;

    // Validate the message
    if (!roomId || !message || message.trim().length === 0) {
      return;
    }

    // Verify user is in the room
    if (!socket.rooms.has(roomId)) {
      return;
    }

    // Broadcast message to all users in the room (including sender for confirmation)
    io.to(roomId).emit('chat:message', {
      userId,
      userEmail,
      message: message.trim(),
      timestamp,
      type: type || 'text',
    });
  });

  socket.on('chat:typing-start', (data) => {
    const { roomId, userId, userEmail } = data;

    if (!roomId || !socket.rooms.has(roomId)) {
      return;
    }

    // Broadcast typing indicator to others in the room (not to sender)
    socket.to(roomId).emit('chat:typing-start', {
      userId,
      userEmail,
    });
  });

  socket.on('chat:typing-stop', (data) => {
    const { roomId, userId } = data;

    if (!roomId || !socket.rooms.has(roomId)) {
      return;
    }

    // Broadcast stop typing to others in the room (not to sender)
    socket.to(roomId).emit('chat:typing-stop', {
      userId,
    });
  });

  // Enhanced user leaving handling
  socket.on('user-left', ({ roomId }) => {
    handleUserLeaving(socket, roomId);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.user.email);

    // Find and leave all rooms the user was in
    const rooms = Array.from(socket.rooms);
    rooms.forEach((roomId) => {
      if (roomId !== socket.id) {
        handleUserLeaving(socket, roomId, false);
      }
    });

    // Clean up user mappings and info
    userToSocket.delete(socket.user.userId);
    socketToUser.delete(socket.id);
    userInfo.delete(socket.user.userId);
  });
});

// Helper function to handle user leaving
function handleUserLeaving(socket, roomId, emitUserLeft = true) {
  console.log(`User ${socket.user.userId} leaving room ${roomId}`);

  // Remove user from room state
  const room = roomState.get(roomId);
  if (room) {
    room.delete(socket.user.userId);
    if (room.size === 0) {
      roomState.delete(roomId);
      screenSharingState.delete(roomId);
      collaborationState.delete(roomId); // Clean up collaboration state
    }
  }

  // Check if user was sharing screen
  if (screenSharingState.get(roomId) === socket.user.userId) {
    screenSharingState.set(roomId, null);
    socket.to(roomId).emit('screen-share-stopped');
  }

  // Clean up any active connections involving this user
  for (const [key, connection] of activeConnections.entries()) {
    if (connection.users.includes(socket.user.userId)) {
      console.log(`Cleaning up connection ${key} for leaving user`);
      activeConnections.delete(key);
    }
  }

  // Notify others in the room
  if (emitUserLeft) {
    socket.to(roomId).emit('user-left', socket.user.userId);
  }

  // Leave the room
  socket.leave(roomId);
}

// Helper function to apply workflow operations
function applyWorkflowOperation(workflowData, operation) {
  switch (operation.type) {
    case 'add_node':
      workflowData.nodes.push(operation.node);
      break;
    case 'update_node':
      const nodeIndex = workflowData.nodes.findIndex(
        (n) => n.id === operation.nodeId
      );
      if (nodeIndex !== -1) {
        workflowData.nodes[nodeIndex] = {
          ...workflowData.nodes[nodeIndex],
          ...operation.data,
        };
      }
      break;
    case 'delete_node':
      workflowData.nodes = workflowData.nodes.filter(
        (n) => n.id !== operation.nodeId
      );
      workflowData.edges = workflowData.edges.filter(
        (e) => e.source !== operation.nodeId && e.target !== operation.nodeId
      );
      break;
    case 'add_edge':
      workflowData.edges.push(operation.edge);
      break;
    case 'delete_edge':
      workflowData.edges = workflowData.edges.filter(
        (e) => e.id !== operation.edgeId
      );
      break;
  }
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
