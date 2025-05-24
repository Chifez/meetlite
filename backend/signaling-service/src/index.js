import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

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
  socket.on('ready', (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-joined', socket.user.userId);
    
    // Send room data to all participants
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room) {
      io.to(roomId).emit('room-data', {
        participants: Array.from(room)
      });
    }
  });

  // Handle WebRTC signaling
  socket.on('call-user', ({ to, offer }) => {
    socket.to(to).emit('call-user', {
      from: socket.user.userId,
      offer
    });
  });

  socket.on('answer', ({ to, answer }) => {
    socket.to(to).emit('answer-made', {
      from: socket.user.userId,
      answer
    });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    socket.to(to).emit('ice-candidate', {
      from: socket.user.userId,
      candidate
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const rooms = Array.from(socket.rooms);
    rooms.forEach(roomId => {
      socket.to(roomId).emit('user-left', socket.user.userId);
      
      // Update room data
      const room = io.sockets.adapter.rooms.get(roomId);
      if (room) {
        io.to(roomId).emit('room-data', {
          participants: Array.from(room)
        });
      }
    });
  });
});

const PORT = process.env.PORT || 5002;

httpServer.listen(PORT, () => {
  console.log(`Signaling service running on port ${PORT}`);
});