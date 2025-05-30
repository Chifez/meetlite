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
  console.log(
    '🔌 [Server] User connected:',
    socket.user.email,
    'Socket ID:',
    socket.id
  );

  // Map user ID to socket ID and vice versa
  userToSocket.set(socket.user.userId, socket.id);
  socketToUser.set(socket.id, socket.user.userId);

  console.log('🗺️ [Server] User mapping created:', {
    userId: socket.user.userId,
    socketId: socket.id,
  });

  // Enhanced room joining with proper peer coordination
  socket.on('ready', ({ roomId, mediaState }) => {
    console.log(
      `🏠 [Server] User ${socket.user.userId} joining room ${roomId}`
    );
    console.log(`🏠 [Server] Media state:`, mediaState);

    socket.join(roomId);

    // Initialize room state if it doesn't exist
    if (!roomState.has(roomId)) {
      console.log(`🏠 [Server] Creating new room state for ${roomId}`);
      roomState.set(roomId, new Map());
    }

    // Initialize screen sharing state if it doesn't exist
    if (!screenSharingState.has(roomId)) {
      console.log(
        `🏠 [Server] Initializing screen sharing state for ${roomId}`
      );
      screenSharingState.set(roomId, null);
    }

    // Get existing participants before adding new user
    const existingParticipants = [];
    const roomSockets = io.sockets.adapter.rooms.get(roomId);

    console.log(`🏠 [Server] Room ${roomId} sockets:`, roomSockets);

    if (roomSockets) {
      roomSockets.forEach((socketId) => {
        if (socketId !== socket.id) {
          const userId = socketToUser.get(socketId);
          if (userId) {
            existingParticipants.push(userId);
            console.log(`🏠 [Server] Found existing participant: ${userId}`);
          }
        }
      });
    }

    // Add user to room state with their initial media state
    const room = roomState.get(roomId);
    room.set(socket.user.userId, {
      audioEnabled: mediaState.audioEnabled,
      videoEnabled: mediaState.videoEnabled,
    });

    console.log(
      `🏠 [Server] User ${socket.user.userId} joined room ${roomId}. Existing participants:`,
      existingParticipants
    );

    // Coordinate connections - only one peer should initiate per pair
    existingParticipants.forEach((existingUserId) => {
      const connectionKey = createConnectionKey(
        socket.user.userId,
        existingUserId
      );

      console.log(`🔗 [Server] Processing connection ${connectionKey}`);

      // Prevent duplicate connection attempts
      if (activeConnections.has(connectionKey)) {
        console.log(
          `🔗 [Server] Connection ${connectionKey} already in progress, skipping`
        );
        return;
      }

      // Mark connection as active
      activeConnections.set(connectionKey, {
        users: [socket.user.userId, existingUserId],
        timestamp: Date.now(),
        status: 'initiating',
      });

      console.log(`🔗 [Server] Marked connection ${connectionKey} as active`);

      // Determine who should initiate based on consistent ordering
      const shouldInitiate = shouldInitiateConnection(
        socket.user.userId,
        existingUserId
      );

      console.log(
        `🔗 [Server] Should ${socket.user.userId} initiate to ${existingUserId}? ${shouldInitiate}`
      );

      if (shouldInitiate) {
        // New user initiates connection to existing user
        console.log(
          `🚀 [Server] Telling ${socket.user.userId} to initiate connection to ${existingUserId}`
        );
        socket.emit('initiate-connection', {
          targetUserId: existingUserId,
          isInitiator: true,
        });

        // Notify existing user to expect connection
        const targetSocketId = userToSocket.get(existingUserId);
        if (targetSocketId) {
          console.log(
            `🚀 [Server] Telling ${existingUserId} to expect connection from ${socket.user.userId}`
          );
          io.to(targetSocketId).emit('initiate-connection', {
            targetUserId: socket.user.userId,
            isInitiator: false,
          });
        } else {
          console.warn(
            `⚠️ [Server] Could not find socket for user ${existingUserId}`
          );
        }
      } else {
        // Existing user should initiate to new user
        const targetSocketId = userToSocket.get(existingUserId);
        if (targetSocketId) {
          console.log(
            `🚀 [Server] Telling ${existingUserId} to initiate connection to ${socket.user.userId}`
          );
          io.to(targetSocketId).emit('initiate-connection', {
            targetUserId: socket.user.userId,
            isInitiator: true,
          });
        } else {
          console.warn(
            `⚠️ [Server] Could not find socket for user ${existingUserId}`
          );
        }

        // Notify new user to expect connection
        console.log(
          `🚀 [Server] Telling ${socket.user.userId} to expect connection from ${existingUserId}`
        );
        socket.emit('initiate-connection', {
          targetUserId: existingUserId,
          isInitiator: false,
        });
      }
    });

    // Send room data to all participants
    const allParticipants = [socket.user.userId, ...existingParticipants];
    const roomStateData = Object.fromEntries(room);

    console.log(
      `🏠 [Server] Sending room data to all participants in ${roomId}:`,
      {
        participants: allParticipants,
        mediaState: roomStateData,
      }
    );

    io.to(roomId).emit('room-data', {
      participants: allParticipants,
      mediaState: roomStateData,
    });

    // Send current screen sharing state to new user
    const currentScreenSharer = screenSharingState.get(roomId);
    if (currentScreenSharer) {
      console.log(
        `📺 [Server] Room ${roomId} has active screen sharer: ${currentScreenSharer}`
      );
      socket.emit('screen-share-started', { userId: currentScreenSharer });

      // If someone is sharing their screen, set up the connection
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

        // Notify the screen sharer to initiate connection with the new user
        const sharerSocketId = userToSocket.get(currentScreenSharer);
        if (sharerSocketId) {
          console.log(
            `📺 [Server] Telling screen sharer ${currentScreenSharer} to connect to ${socket.user.userId}`
          );
          io.to(sharerSocketId).emit('initiate-screen-connection', {
            targetUserId: socket.user.userId,
            isInitiator: true,
          });
        }
      }
    }

    // Clean up old connection tracking (remove entries older than 1 minute)
    const oneMinuteAgo = Date.now() - 60000;
    for (const [key, connection] of activeConnections.entries()) {
      if (connection.timestamp < oneMinuteAgo) {
        console.log(
          `🧹 [Server] Cleaning up stale connection tracking: ${key}`
        );
        activeConnections.delete(key);
      }
    }

    console.log(
      `✅ [Server] Room join complete for ${socket.user.userId} in ${roomId}`
    );
  });

  // WebRTC signaling
  socket.on('call-user', ({ to, offer }) => {
    console.log(`📞 [Server] Call from ${socket.user.userId} to ${to}`);
    const targetSocketId = userToSocket.get(to);
    if (targetSocketId) {
      console.log(`📞 [Server] Forwarding call to socket ${targetSocketId}`);
      io.to(targetSocketId).emit('call-user', {
        from: socket.user.userId,
        offer,
      });
    } else {
      console.warn(`⚠️ [Server] No socket found for user ${to}`);
    }
  });

  socket.on('make-answer', ({ to, answer }) => {
    console.log(`📞 [Server] Answer from ${socket.user.userId} to ${to}`);
    const targetSocketId = userToSocket.get(to);
    if (targetSocketId) {
      console.log(`📞 [Server] Forwarding answer to socket ${targetSocketId}`);
      io.to(targetSocketId).emit('answer-made', {
        from: socket.user.userId,
        answer,
      });
    } else {
      console.warn(`⚠️ [Server] No socket found for user ${to}`);
    }
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    console.log(
      `🧊 [Server] ICE candidate from ${socket.user.userId} to ${to}`
    );
    const targetSocketId = userToSocket.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice-candidate', {
        from: socket.user.userId,
        candidate,
      });
    } else {
      console.warn(`⚠️ [Server] No socket found for user ${to}`);
    }
  });

  // Screen sharing signaling
  socket.on('screen-share-call', ({ to, offer }) => {
    console.log(`Screen share call from ${socket.user.userId} to ${to}`);
    const targetSocketId = userToSocket.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('screen-share-call', {
        from: socket.user.userId,
        offer,
      });
      console.log(`Sent screen share call to socket ${targetSocketId}`);
    }
  });

  socket.on('screen-share-answer', ({ to, answer }) => {
    console.log(`Screen share answer from ${socket.user.userId} to ${to}`);
    const targetSocketId = userToSocket.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('screen-share-answer', {
        from: socket.user.userId,
        answer,
      });
      console.log(`Sent screen share answer to socket ${targetSocketId}`);
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

  // Screen sharing state management
  socket.on('screen-share-started', ({ roomId }) => {
    console.log(
      `Screen sharing started by ${socket.user.userId} in room ${roomId}`
    );
    screenSharingState.set(roomId, socket.user.userId);

    // Get all users in the room except the sharer
    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    if (roomSockets) {
      roomSockets.forEach((socketId) => {
        if (socketId !== socket.id) {
          const userId = socketToUser.get(socketId);
          if (userId) {
            // Notify the screen sharer to initiate connection with the target user
            io.to(socket.id).emit('initiate-screen-connection', {
              targetUserId: userId,
              isInitiator: true,
            });
          }
        }
      });
    }

    // Notify others about screen sharing
    socket
      .to(roomId)
      .emit('screen-share-started', { userId: socket.user.userId });
  });

  socket.on('screen-share-stopped', ({ roomId }) => {
    console.log(
      `Screen sharing stopped by ${socket.user.userId} in room ${roomId}`
    );
    screenSharingState.set(roomId, null);
    socket.to(roomId).emit('screen-share-stopped');
  });

  // Handle media state changes
  socket.on('media-state-change', ({ roomId, audioEnabled, videoEnabled }) => {
    console.log(`Media state change from ${socket.user.userId}:`, {
      audioEnabled,
      videoEnabled,
    });

    const room = roomState.get(roomId);
    if (room && room.has(socket.user.userId)) {
      room.set(socket.user.userId, { audioEnabled, videoEnabled });

      // Broadcast to all other users in the room
      socket.to(roomId).emit('media-state-update', {
        userId: socket.user.userId,
        audioEnabled,
        videoEnabled,
      });

      console.log(
        `Broadcasted media state update for ${socket.user.userId} to room ${roomId}`
      );
    } else {
      console.log(
        `Room ${roomId} not found or user not in room for media state change`
      );
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
