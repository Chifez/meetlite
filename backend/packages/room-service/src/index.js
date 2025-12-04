import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import redisClient from './config/redis.js';
import { verifyToken } from './middleware/auth.js';

// Versioned routes
import roomRoutesV1 from './routes/v1/rooms.routes.js';
import meetingRoutesV1 from './routes/v1/meetings.routes.js';
import recordingRoutesV1 from './routes/v1/recordings.routes.js';
import analyticsRoutesV1 from './routes/v1/analytics.routes.js';
import aiRoutesV1 from './routes/v1/ai.routes.js';
import calendarRoutesV1 from './routes/v1/calendar.routes.js';
import { createSessionStore } from './config/session.js';
import { connectionPool, createModelFactory } from '@minimeet/shared-models';
import { createLocalModels } from './utils/modelFactory.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Connect to MongoDB using shared connection pool
export let roomConnection = null;
export let models = null;

// Health check endpoint - must be BEFORE CORS to allow unrestricted access
app.get('/health', (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
  res.json(health);
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Add size limit

// Public calendar routes that do not require token verification (e.g., OAuth callbacks)
// These must come before app.use(verifyToken)
app.use('/api/v1/calendar', calendarRoutesV1);

app.use(verifyToken);

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);

  // Use standardized error response
  if (err.isOperational && err.code) {
    const response = err.toResponse
      ? err.toResponse()
      : {
          success: false,
          message: err.message,
          code: err.code,
          timestamp: err.timestamp,
        };
    return res.status(err.statusCode || 500).json(response);
  }

  res.status(500).json({
    success: false,
    code: 'SYSTEM_9006',
    message: 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});

// Versioned API routes (authenticated)
app.use('/api/v1/rooms', roomRoutesV1);
app.use('/api/v1/meetings', meetingRoutesV1);
app.use('/api/v1/recordings', recordingRoutesV1);
app.use('/api/v1/analytics', analyticsRoutesV1);
app.use('/api/v1/ai', aiRoutesV1);
// Note: calendar routes are mounted above before verifyToken for OAuth callbacks

// Connect to MongoDB using shared connection pool
const connectDB = async () => {
  try {
    roomConnection = await connectionPool.getConnection(
      'room',
      process.env.MONGODB_URI
    );

    // Create all shared models with this specific connection
    models = createModelFactory(roomConnection);

    // Create local models using the same connection
    const localModels = createLocalModels(roomConnection);

    // Merge shared models with local models
    models = { ...models, ...localModels };

    // Handle connection events
    roomConnection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
};

// Process error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Start server only after DB connection
const startServer = async () => {
  try {
    await connectDB();

    // Connect to Redis
    await redisClient.connect();

    // Setup session middleware after Redis connection
    const sessionMiddleware = await createSessionStore();
    app.use(sessionMiddleware);

    const server = app.listen(PORT, () => {
      console.log(`Room service started on port ${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      server.close(async () => {
        await redisClient.disconnect();
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      server.close(async () => {
        await redisClient.disconnect();
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
