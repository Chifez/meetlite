import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import organizationRoutes from './routes/organizations.js';
import organizationMemberRoutes from './routes/organizationMembers.js';
import invitationRoutes from './routes/invitations.js';
import redisClient from './config/redis.js';
import { createSessionStore } from './config/session.js';
import { connectionPool, createModelFactory } from '@minimeet/shared-models';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// app.use(cors());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true, // Enable cookies for sessions
  })
);
app.use(express.json({ limit: '10mb' })); // Add size limit

// Session middleware will be added after Redis connection

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/organizations/members', organizationMemberRoutes);
app.use('/api/invitations', invitationRoutes);

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

// Connect to MongoDB using shared connection pool
let authConnection = null;
export let models = null;

const connectDB = async () => {
  try {
    console.log('Connecting to MongoDB via shared connection pool...');
    const startTime = Date.now();

    authConnection = await connectionPool.getConnection(
      'auth',
      process.env.MONGODB_URI
    );

    // Create all shared models with this specific connection
    models = createModelFactory(authConnection);

    const connectionTime = Date.now() - startTime;
    console.log(
      `✅ Connected to MongoDB via shared pool in ${connectionTime}ms`
    );

    // Handle connection events
    authConnection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    authConnection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    authConnection.on('reconnected', () => {
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

// Start server only after DB and Redis connections
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Connect to Redis
    console.log('Connecting to Redis...');
    await redisClient.connect();

    // Setup session middleware after Redis connection
    const sessionMiddleware = await createSessionStore();
    app.use(sessionMiddleware);

    const server = app.listen(PORT, () => {
      console.log(`🚀 Auth service running on port ${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('🛑 SIGTERM received, shutting down gracefully...');
      server.close(async () => {
        console.log('✅ Server closed');
        await redisClient.disconnect();
        console.log('✅ Redis connection closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('🛑 SIGINT received, shutting down gracefully...');
      server.close(async () => {
        console.log('✅ Server closed');
        await redisClient.disconnect();
        console.log('✅ Redis connection closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
