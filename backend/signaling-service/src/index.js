// import { createServer } from 'http';
// import { Server } from 'socket.io';
// import jwt from 'jsonwebtoken';
// import dotenv from 'dotenv';

// dotenv.config();

// const httpServer = createServer();
// const io = new Server(httpServer, {
//   cors: {
//     origin: process.env.CORS_ORIGIN,
//     methods: ['GET', 'POST'],
//   },
// });

// // Store room state and user mappings
// const roomState = new Map();
// const userToSocket = new Map(); // Map user IDs to socket IDs

// // Middleware to verify JWT
// io.use((socket, next) => {
//   const token = socket.handshake.auth.token;

//   if (!token) {
//     return next(new Error('Authentication error'));
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     socket.user = decoded;
//     next();
//   } catch (err) {
//     next(new Error('Authentication error'));
//   }
// });

// io.on('connection', (socket) => {
//   console.log('User connected:', socket.user.email);

//   // Map user ID to socket ID
//   userToSocket.set(socket.user.userId, socket.id);

//   // Join room
//   socket.on('ready', ({ roomId, mediaState }) => {
//     socket.join(roomId);

//     // Initialize room state if it doesn't exist
//     if (!roomState.has(roomId)) {
//       roomState.set(roomId, new Map());
//     }

//     // Get existing participants before adding new user
//     const existingParticipants = Array.from(
//       io.sockets.adapter.rooms.get(roomId) || []
//     ).filter((id) => id !== socket.id);

//     // Add user to room state with their initial media state
//     const room = roomState.get(roomId);
//     room.set(socket.user.userId, {
//       audioEnabled: mediaState.audioEnabled,
//       videoEnabled: mediaState.videoEnabled,
//     });

//     // Notify existing users about the new user
//     socket.to(roomId).emit('user-joined', socket.user.userId);

//     // Notify the new user about existing participants
//     existingParticipants.forEach((socketId) => {
//       const existingSocket = io.sockets.sockets.get(socketId);
//       if (existingSocket && existingSocket.user) {
//         socket.emit('user-joined', existingSocket.user.userId);
//       }
//     });

//     // Send room data and state to all participants
//     const roomParticipants = Array.from(
//       io.sockets.adapter.rooms.get(roomId) || []
//     );
//     const roomStateData = Object.fromEntries(room);

//     io.to(roomId).emit('room-data', {
//       participants: roomParticipants,
//       mediaState: roomStateData,
//     });

//     console.log(
//       `User ${socket.user.userId} joined room ${roomId}. Existing participants:`,
//       existingParticipants.length
//     );
//   });

//   // Handle media state changes
//   socket.on('media-state-change', ({ roomId, audioEnabled, videoEnabled }) => {
//     console.log(`Media state change from ${socket.user.userId}:`, {
//       audioEnabled,
//       videoEnabled,
//     });

//     const room = roomState.get(roomId);
//     if (room) {
//       room.set(socket.user.userId, { audioEnabled, videoEnabled });

//       // Broadcast to all other users in the room
//       socket.to(roomId).emit('media-state-update', {
//         userId: socket.user.userId,
//         audioEnabled,
//         videoEnabled,
//       });

//       console.log(
//         `Broadcasted media state update for ${socket.user.userId} to room ${roomId}`
//       );
//     } else {
//       console.log(`Room ${roomId} not found for media state change`);
//     }
//   });

//   // Handle WebRTC signaling
//   socket.on('call-user', ({ to, offer }) => {
//     console.log(`Call from ${socket.user.userId} to ${to}`);
//     const targetSocketId = userToSocket.get(to);
//     if (targetSocketId) {
//       io.to(targetSocketId).emit('call-user', {
//         from: socket.user.userId,
//         offer,
//       });
//       console.log(`Sent call to socket ${targetSocketId}`);
//     } else {
//       console.log(`Target user ${to} not found`);
//     }
//   });

//   socket.on('answer', ({ to, answer }) => {
//     console.log(`Answer from ${socket.user.userId} to ${to}`);
//     const targetSocketId = userToSocket.get(to);
//     if (targetSocketId) {
//       io.to(targetSocketId).emit('answer-made', {
//         from: socket.user.userId,
//         answer,
//       });
//       console.log(`Sent answer to socket ${targetSocketId}`);
//     } else {
//       console.log(`Target user ${to} not found`);
//     }
//   });

//   socket.on('ice-candidate', ({ to, candidate }) => {
//     console.log(`ICE candidate from ${socket.user.userId} to ${to}`);
//     const targetSocketId = userToSocket.get(to);
//     if (targetSocketId) {
//       io.to(targetSocketId).emit('ice-candidate', {
//         from: socket.user.userId,
//         candidate,
//       });
//       console.log(`Sent ICE candidate to socket ${targetSocketId}`);
//     } else {
//       console.log(`Target user ${to} not found`);
//     }
//   });

//   // Handle user leaving
//   socket.on('user-left', ({ roomId }) => {
//     console.log('User left room:', socket.user.userId, roomId);

//     // Remove user from room state
//     const room = roomState.get(roomId);
//     if (room) {
//       room.delete(socket.user.userId);
//       if (room.size === 0) {
//         roomState.delete(roomId);
//       }
//     }

//     socket.to(roomId).emit('user-left', socket.user.userId);

//     // Update room data
//     const roomParticipants = Array.from(
//       io.sockets.adapter.rooms.get(roomId) || []
//     );
//     const roomStateData = Object.fromEntries(room || new Map());

//     io.to(roomId).emit('room-data', {
//       participants: roomParticipants,
//       mediaState: roomStateData,
//     });

//     socket.leave(roomId);

//     // Remove user mapping
//     userToSocket.delete(socket.user.userId);
//   });

//   // Handle disconnection
//   socket.on('disconnect', () => {
//     console.log('User disconnected:', socket.user.userId);

//     // Remove user mapping
//     userToSocket.delete(socket.user.userId);

//     const rooms = Array.from(socket.rooms);
//     rooms.forEach((roomId) => {
//       // Remove user from room state
//       const room = roomState.get(roomId);
//       if (room) {
//         room.delete(socket.user.userId);
//         if (room.size === 0) {
//           roomState.delete(roomId);
//         }
//       }

//       socket.to(roomId).emit('user-left', socket.user.userId);

//       // Update room data
//       const roomParticipants = Array.from(
//         io.sockets.adapter.rooms.get(roomId) || []
//       );
//       const roomStateData = Object.fromEntries(room || new Map());

//       io.to(roomId).emit('room-data', {
//         participants: roomParticipants,
//         mediaState: roomStateData,
//       });
//     });
//   });
// });

// const PORT = process.env.PORT || 5002;

// httpServer.listen(PORT, () => {
//   console.log(`Signaling service running on port ${PORT}`);
// });

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

// Helper function to determine who should initiate the connection
const shouldInitiateConnection = (userA, userB) => {
  // Use lexicographic ordering to ensure consistent initiator selection
  return userA < userB;
};

// Helper function to create connection key
const createConnectionKey = (userA, userB) => {
  return [userA, userB].sort().join('_');
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
  console.log('User connected:', socket.user.email);

  // Map user ID to socket ID and vice versa
  userToSocket.set(socket.user.userId, socket.id);
  socketToUser.set(socket.id, socket.user.userId);

  // Enhanced room joining with proper peer coordination
  socket.on('ready', ({ roomId, mediaState }) => {
    socket.join(roomId);

    // Initialize room state if it doesn't exist
    if (!roomState.has(roomId)) {
      roomState.set(roomId, new Map());
    }

    // Get existing participants before adding new user
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

    // Add user to room state with their initial media state
    const room = roomState.get(roomId);
    room.set(socket.user.userId, {
      audioEnabled: mediaState.audioEnabled,
      videoEnabled: mediaState.videoEnabled,
    });

    console.log(
      `User ${socket.user.userId} joined room ${roomId}. Existing participants:`,
      existingParticipants
    );

    // Coordinate connections - only one peer should initiate per pair
    existingParticipants.forEach((existingUserId) => {
      const connectionKey = createConnectionKey(
        socket.user.userId,
        existingUserId
      );

      // Prevent duplicate connection attempts
      if (activeConnections.has(connectionKey)) {
        console.log(
          `Connection ${connectionKey} already in progress, skipping`
        );
        return;
      }

      // Mark connection as active
      activeConnections.set(connectionKey, {
        users: [socket.user.userId, existingUserId],
        timestamp: Date.now(),
        status: 'initiating',
      });

      // Determine who should initiate based on consistent ordering
      const shouldInitiate = shouldInitiateConnection(
        socket.user.userId,
        existingUserId
      );

      if (shouldInitiate) {
        // New user initiates connection to existing user
        socket.emit('initiate-connection', {
          targetUserId: existingUserId,
          isInitiator: true,
        });

        // Notify existing user to expect connection
        const targetSocketId = userToSocket.get(existingUserId);
        if (targetSocketId) {
          io.to(targetSocketId).emit('initiate-connection', {
            targetUserId: socket.user.userId,
            isInitiator: false,
          });
        }
      } else {
        // Existing user should initiate to new user
        const targetSocketId = userToSocket.get(existingUserId);
        if (targetSocketId) {
          io.to(targetSocketId).emit('initiate-connection', {
            targetUserId: socket.user.userId,
            isInitiator: true,
          });
        }

        // Notify new user to expect connection
        socket.emit('initiate-connection', {
          targetUserId: existingUserId,
          isInitiator: false,
        });
      }
    });

    // Send room data to all participants
    const allParticipants = [socket.user.userId, ...existingParticipants];
    const roomStateData = Object.fromEntries(room);

    io.to(roomId).emit('room-data', {
      participants: allParticipants,
      mediaState: roomStateData,
    });

    // Clean up old connection tracking (remove entries older than 1 minute)
    const oneMinuteAgo = Date.now() - 60000;
    for (const [key, connection] of activeConnections.entries()) {
      if (connection.timestamp < oneMinuteAgo) {
        console.log(`Cleaning up stale connection tracking: ${key}`);
        activeConnections.delete(key);
      }
    }
  });

  // Enhanced WebRTC signaling with connection state tracking
  socket.on('call-user', ({ to, offer }) => {
    console.log(`Call from ${socket.user.userId} to ${to}`);

    const connectionKey = createConnectionKey(socket.user.userId, to);
    const connection = activeConnections.get(connectionKey);

    if (!connection) {
      console.warn(
        `No active connection found for ${connectionKey}, creating one`
      );
      activeConnections.set(connectionKey, {
        users: [socket.user.userId, to],
        timestamp: Date.now(),
        status: 'offer-sent',
      });
    } else {
      connection.status = 'offer-sent';
    }

    const targetSocketId = userToSocket.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call-user', {
        from: socket.user.userId,
        offer,
      });
      console.log(`Sent call to socket ${targetSocketId}`);
    } else {
      console.log(`Target user ${to} not found`);
      // Clean up connection tracking if target not found
      activeConnections.delete(connectionKey);
    }
  });

  socket.on('answer', ({ to, answer }) => {
    console.log(`Answer from ${socket.user.userId} to ${to}`);

    const connectionKey = createConnectionKey(socket.user.userId, to);
    const connection = activeConnections.get(connectionKey);

    if (connection) {
      connection.status = 'answer-sent';
    }

    const targetSocketId = userToSocket.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('answer-made', {
        from: socket.user.userId,
        answer,
      });
      console.log(`Sent answer to socket ${targetSocketId}`);
    } else {
      console.log(`Target user ${to} not found`);
    }
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    const targetSocketId = userToSocket.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice-candidate', {
        from: socket.user.userId,
        candidate,
      });
    } else {
      console.log(`Target user ${to} not found for ICE candidate`);
    }
  });

  // Enhanced connection success tracking
  socket.on('connection-established', ({ to }) => {
    console.log(
      `Connection established between ${socket.user.userId} and ${to}`
    );
    const connectionKey = createConnectionKey(socket.user.userId, to);
    const connection = activeConnections.get(connectionKey);

    if (connection) {
      connection.status = 'established';
    }
  });

  // Enhanced connection failure handling
  socket.on('connection-failed', ({ to, reason }) => {
    console.log(
      `Connection failed between ${socket.user.userId} and ${to}: ${reason}`
    );
    const connectionKey = createConnectionKey(socket.user.userId, to);
    activeConnections.delete(connectionKey);

    // Notify the other peer about the failure
    const targetSocketId = userToSocket.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('connection-failed', {
        from: socket.user.userId,
        reason,
      });
    }
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

  // Enhanced disconnection handling
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.user.userId);

    const userId = socket.user.userId;

    // Clean up user mappings
    userToSocket.delete(userId);
    socketToUser.delete(socket.id);

    // Clean up active connections
    const connectionsToRemove = [];
    for (const [key, connection] of activeConnections.entries()) {
      if (connection.users.includes(userId)) {
        connectionsToRemove.push(key);
      }
    }

    connectionsToRemove.forEach((key) => {
      activeConnections.delete(key);
    });

    // Handle room cleanup
    const rooms = Array.from(socket.rooms);
    rooms.forEach((roomId) => {
      if (roomId !== socket.id) {
        // Skip the default room (socket's own room)
        handleUserLeaving(socket, roomId, false); // false = don't emit user-left again
      }
    });
  });

  // Helper function to handle user leaving
  function handleUserLeaving(socket, roomId, emitUserLeft = true) {
    console.log('User left room:', socket.user.userId, roomId);

    // Remove user from room state
    const room = roomState.get(roomId);
    if (room) {
      room.delete(socket.user.userId);
      if (room.size === 0) {
        roomState.delete(roomId);
        console.log(`Room ${roomId} deleted (empty)`);
      }
    }

    // Clean up connections involving this user
    const userId = socket.user.userId;
    const connectionsToRemove = [];

    for (const [key, connection] of activeConnections.entries()) {
      if (connection.users.includes(userId)) {
        connectionsToRemove.push(key);

        // Notify the other user about disconnection
        const otherUser = connection.users.find((u) => u !== userId);
        if (otherUser && emitUserLeft) {
          const otherSocketId = userToSocket.get(otherUser);
          if (otherSocketId) {
            io.to(otherSocketId).emit('user-left', userId);
          }
        }
      }
    }

    connectionsToRemove.forEach((key) => {
      activeConnections.delete(key);
    });

    if (emitUserLeft) {
      socket.to(roomId).emit('user-left', socket.user.userId);
    }

    // Update room data for remaining participants
    if (room && room.size > 0) {
      const roomParticipants = Array.from(room.keys());
      const roomStateData = Object.fromEntries(room);

      io.to(roomId).emit('room-data', {
        participants: roomParticipants,
        mediaState: roomStateData,
      });
    }

    socket.leave(roomId);
  }
});

// Periodic cleanup of stale connections
setInterval(() => {
  const fiveMinutesAgo = Date.now() - 300000; // 5 minutes
  let cleanedUp = 0;

  for (const [key, connection] of activeConnections.entries()) {
    if (connection.timestamp < fiveMinutesAgo) {
      activeConnections.delete(key);
      cleanedUp++;
    }
  }

  if (cleanedUp > 0) {
    console.log(`Cleaned up ${cleanedUp} stale connection(s)`);
  }
}, 60000); // Run every minute

const PORT = process.env.PORT || 5002;

httpServer.listen(PORT, () => {
  console.log(`Signaling service running on port ${PORT}`);
});
