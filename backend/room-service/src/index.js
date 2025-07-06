import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import roomRoutes from './routes/rooms.js';
import { verifyToken } from './middleware/auth.js';
import meetingsRoutes from './routes/meetings.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Add size limit
app.use(verifyToken);

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// Routes
app.use('/api/rooms', roomRoutes);
app.use('/api/meetings', meetingsRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
  res.json(health);
});

// MongoDB connection options for better performance
const mongoOptions = {
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  // bufferMaxEntries: 0, // Disable mongoose buffering
  // useNewUrlParser: true,
  useUnifiedTopology: true,
};

// Connect to MongoDB with timeout and retry logic
const connectDB = async () => {
  try {
    console.log('Connecting to MongoDB...');
    const startTime = Date.now();

    await mongoose.connect(process.env.MONGODB_URI, mongoOptions);

    const connectionTime = Date.now() - startTime;
    console.log(`✅ Connected to MongoDB in ${connectionTime}ms`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
};

// Process error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Don't exit immediately, give time for cleanup
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit immediately, give time for cleanup
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Start server only after DB connection
const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`🚀 Room service running on port ${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        mongoose.connection.close(() => {
          console.log('✅ Database connection closed');
          process.exit(0);
        });
      });
    });

    process.on('SIGINT', () => {
      console.log('🛑 SIGINT received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        mongoose.connection.close(() => {
          console.log('✅ Database connection closed');
          process.exit(0);
        });
      });
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
