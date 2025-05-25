import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Store room state and user mappings
const roomState = new Map();
const userToSocket = new Map(); // Map user IDs to socket IDs

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

  // Map user ID to socket ID
  userToSocket.set(socket.user.userId, socket.id);

  // Join room
  socket.on('ready', ({ roomId, mediaState }) => {
    socket.join(roomId);

    // Initialize room state if it doesn't exist
    if (!roomState.has(roomId)) {
      roomState.set(roomId, new Map());
    }

    // Get existing participants before adding new user
    const existingParticipants = Array.from(
      io.sockets.adapter.rooms.get(roomId) || []
    ).filter((id) => id !== socket.id);

    // Add user to room state with their initial media state
    const room = roomState.get(roomId);
    room.set(socket.user.userId, {
      audioEnabled: mediaState.audioEnabled,
      videoEnabled: mediaState.videoEnabled,
    });

    // Notify existing users about the new user
    socket.to(roomId).emit('user-joined', socket.user.userId);

    // Notify the new user about existing participants
    existingParticipants.forEach((socketId) => {
      const existingSocket = io.sockets.sockets.get(socketId);
      if (existingSocket && existingSocket.user) {
        socket.emit('user-joined', existingSocket.user.userId);
      }
    });

    // Send room data and state to all participants
    const roomParticipants = Array.from(
      io.sockets.adapter.rooms.get(roomId) || []
    );
    const roomStateData = Object.fromEntries(room);

    io.to(roomId).emit('room-data', {
      participants: roomParticipants,
      mediaState: roomStateData,
    });

    console.log(
      `User ${socket.user.userId} joined room ${roomId}. Existing participants:`,
      existingParticipants.length
    );
  });

  // Handle media state changes
  socket.on('media-state-change', ({ roomId, audioEnabled, videoEnabled }) => {
    console.log(`Media state change from ${socket.user.userId}:`, {
      audioEnabled,
      videoEnabled,
    });

    const room = roomState.get(roomId);
    if (room) {
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
      console.log(`Room ${roomId} not found for media state change`);
    }
  });

  // Handle WebRTC signaling
  socket.on('call-user', ({ to, offer }) => {
    console.log(`Call from ${socket.user.userId} to ${to}`);
    const targetSocketId = userToSocket.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call-user', {
        from: socket.user.userId,
        offer,
      });
      console.log(`Sent call to socket ${targetSocketId}`);
    } else {
      console.log(`Target user ${to} not found`);
    }
  });

  socket.on('answer', ({ to, answer }) => {
    console.log(`Answer from ${socket.user.userId} to ${to}`);
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
    console.log(`ICE candidate from ${socket.user.userId} to ${to}`);
    const targetSocketId = userToSocket.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice-candidate', {
        from: socket.user.userId,
        candidate,
      });
      console.log(`Sent ICE candidate to socket ${targetSocketId}`);
    } else {
      console.log(`Target user ${to} not found`);
    }
  });

  // Handle user leaving
  socket.on('user-left', ({ roomId }) => {
    console.log('User left room:', socket.user.userId, roomId);

    // Remove user from room state
    const room = roomState.get(roomId);
    if (room) {
      room.delete(socket.user.userId);
      if (room.size === 0) {
        roomState.delete(roomId);
      }
    }

    socket.to(roomId).emit('user-left', socket.user.userId);

    // Update room data
    const roomParticipants = Array.from(
      io.sockets.adapter.rooms.get(roomId) || []
    );
    const roomStateData = Object.fromEntries(room || new Map());

    io.to(roomId).emit('room-data', {
      participants: roomParticipants,
      mediaState: roomStateData,
    });

    socket.leave(roomId);

    // Remove user mapping
    userToSocket.delete(socket.user.userId);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.user.userId);

    // Remove user mapping
    userToSocket.delete(socket.user.userId);

    const rooms = Array.from(socket.rooms);
    rooms.forEach((roomId) => {
      // Remove user from room state
      const room = roomState.get(roomId);
      if (room) {
        room.delete(socket.user.userId);
        if (room.size === 0) {
          roomState.delete(roomId);
        }
      }

      socket.to(roomId).emit('user-left', socket.user.userId);

      // Update room data
      const roomParticipants = Array.from(
        io.sockets.adapter.rooms.get(roomId) || []
      );
      const roomStateData = Object.fromEntries(room || new Map());

      io.to(roomId).emit('room-data', {
        participants: roomParticipants,
        mediaState: roomStateData,
      });
    });
  });
});

const PORT = process.env.PORT || 5002;

httpServer.listen(PORT, () => {
  console.log(`Signaling service running on port ${PORT}`);
});
