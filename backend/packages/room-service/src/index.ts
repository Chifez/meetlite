import { createServer } from 'http';
import dotenv from 'dotenv';
import redisClient from './config/redis.js';
import { createSessionStore } from './config/session.js';
import { prisma, validateRequiredEnv } from '@minimeet/shared';
import logger from './utils/logger.js';
import { app, roomHealthManager } from './app.js';
import {
  initializeNotificationSSE,
  shutdownNotificationSSE,
} from './services/notification-sse.service.js';

dotenv.config();

const PORT = process.env.PORT || 5001;

// Create HTTP server
const httpServer = createServer(app);

// Connect to PostgreSQL database using Prisma
const connectDB = async () => {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL database via Prisma (Room-Service HTTP)');
  } catch (error: any) {
    logger.error('Failed to connect to PostgreSQL:', error.message);
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

// Start HTTP server only after DB connection
const startServer = async () => {
  try {
    // Fail fast before connecting to dependencies or binding a port.
    validateRequiredEnv('room-http', process.env);

    await connectDB();

    // Connect to Redis
    await redisClient.connect();

    // Setup session middleware after Redis connection
    const sessionMiddleware = await createSessionStore();
    app.use(sessionMiddleware as any);

    // Initialize notification SSE service for HTTP clients
    initializeNotificationSSE();
    logger.info('Notification SSE initialized');

    // Start HTTP server
    httpServer.listen(PORT, () => {
      roomHealthManager.markStarted();
      logger.info(`Room service HTTP server started on port ${PORT}`);
      logger.info(`- HTTP API: http://localhost:${PORT}`);
      logger.info(`- SSE: http://localhost:${PORT}/api/v1/notifications/stream`);
      logger.info(`- Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
      logger.info(`- PostgreSQL: Connected`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      roomHealthManager.markStopped();
      logger.info(`${signal} received, shutting down gracefully...`);

      try {
        // Stop accepting new connections
        httpServer.close(() => {
          logger.info('HTTP server closed');
        });

        // Shutdown notification SSE
        await shutdownNotificationSSE();

        // Disconnect Redis
        await redisClient.disconnect();
        logger.info('Redis disconnected');

        // Disconnect DB
        await prisma.$disconnect();
        logger.info('PostgreSQL disconnected');

        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
