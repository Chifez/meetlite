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

// Store room state
const roomState = new Map();

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

  // Join room
  socket.on('ready', ({ roomId, mediaState }) => {
    socket.join(roomId);

    // Initialize room state if it doesn't exist
    if (!roomState.has(roomId)) {
      roomState.set(roomId, new Map());
    }

    // Add user to room state with their initial media state
    const room = roomState.get(roomId);
    room.set(socket.user.userId, {
      audioEnabled: mediaState.audioEnabled,
      videoEnabled: mediaState.videoEnabled,
    });

    // Notify others and send current room state
    socket.to(roomId).emit('user-joined', socket.user.userId);

    // Send room data and state to all participants
    const roomParticipants = Array.from(
      io.sockets.adapter.rooms.get(roomId) || []
    );
    const roomStateData = Object.fromEntries(room);

    io.to(roomId).emit('room-data', {
      participants: roomParticipants,
      mediaState: roomStateData,
    });
  });

  // Handle media state changes
  socket.on('media-state-change', ({ roomId, audioEnabled, videoEnabled }) => {
    const room = roomState.get(roomId);
    if (room) {
      room.set(socket.user.userId, { audioEnabled, videoEnabled });
      socket.to(roomId).emit('media-state-update', {
        userId: socket.user.userId,
        audioEnabled,
        videoEnabled,
      });
    }
  });

  // Handle WebRTC signaling
  socket.on('call-user', ({ to, offer }) => {
    socket.to(to).emit('call-user', {
      from: socket.user.userId,
      offer,
    });
  });

  socket.on('answer', ({ to, answer }) => {
    socket.to(to).emit('answer-made', {
      from: socket.user.userId,
      answer,
    });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    socket.to(to).emit('ice-candidate', {
      from: socket.user.userId,
      candidate,
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
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
