import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const httpServer = createServer();
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

  socket.on('ready', ({ roomId, mediaState }) => {
    console.log(`User ${socket.user.userId} joining room ${roomId}`);

    socket.join(roomId);

    if (!roomState.has(roomId)) {
      roomState.set(roomId, new Map());
    }

    if (!screenSharingState.has(roomId)) {
      screenSharingState.set(roomId, null);
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

    io.to(roomId).emit('room-data', {
      participants: allParticipants,
      mediaState: roomStateData,
    });

    if (existingParticipants.length > 0) {
      socket.to(roomId).emit('user-joined', {
        userId: socket.user.userId,
        userName: socket.user.name || socket.user.email || 'Unknown User',
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

    // Clean up user mappings
    userToSocket.delete(socket.user.userId);
    socketToUser.delete(socket.id);
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

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
