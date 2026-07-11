import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import redisClient from './config/redis.js';
import { verifyToken } from './middleware/auth.js';

// Versioned routes
import roomRoutesV1 from './routes/v1/rooms.routes.js';
import meetingRoutesV1 from './routes/v1/meetings.routes.js';
import recordingRoutesV1 from './routes/v1/recordings.routes.js';
import analyticsRoutesV1 from './routes/v1/analytics.routes.js';
import aiRoutesV1 from './routes/v1/ai.routes.js';
import calendarRoutesV1 from './routes/v1/calendar.routes.js';
import notificationRoutesV1 from './routes/v1/notifications.routes.js';
import { createSessionStore } from './config/session.js';
import {
  prisma,
  NotificationWorker,
  meetingReminderEmailTemplate,
  meetingReminderEmailText,
} from '@minimeet/shared';
import { VideoProcessingWorker } from './jobs/video-processing.worker.js';
import logger from './utils/logger.js';

// Notification services
import {
  initializeNotificationSSE,
  sendNotificationToUser,
  shutdownNotificationSSE,
} from './services/notification-sse.service.js';
import { sendEmail } from './services/email.service.js';
import { sendPushNotificationToUser } from './services/push-notification.service.js';
import {
  auditNotificationSent,
  auditNotificationFailed,
} from './services/audit.service.js';

// Import cron jobs
import './jobs/recurrence.job.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Create HTTP server
const httpServer = createServer(app);

// MongoDB connection pool variable removed
export let roomConnection: any = null;
let notificationWorker: any = null;

// Health check endpoint - BEFORE CORS to allow unrestricted access
app.get('/health', (req: Request, res: Response) => {
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
app.use(express.json({ limit: '10mb' }));

// Public calendar routes that do not require token verification (e.g., OAuth callbacks)
app.use('/api/v1/calendar', calendarRoutesV1 as any);

app.use(verifyToken as any);

// Versioned API routes (authenticated)
app.use('/api/v1/rooms', roomRoutesV1 as any);
app.use('/api/v1/meetings', meetingRoutesV1 as any);
app.use('/api/v1/recordings', recordingRoutesV1 as any);
app.use('/api/v1/analytics', analyticsRoutesV1 as any);
app.use('/api/v1/ai', aiRoutesV1 as any);
app.use('/api/v1/notifications', notificationRoutesV1 as any);

// Global error handler middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', err);

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

// Connect to PostgreSQL database using Prisma
const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL database via Prisma (Room-Service)');
  } catch (error: any) {
    console.error('❌ Failed to connect to PostgreSQL:', error.message);
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
    app.use(sessionMiddleware as any);

    // Initialize notification SSE service
    initializeNotificationSSE();
    console.log('✅ Notification SSE initialized');

    // Create notification emitter for worker
    const notificationEmitter = {
      emit: (event: string, data: any) => {
        if (event === 'notification' && data.userId) {
          sendNotificationToUser(data.userId, data.notification);
        }
      },
    };

    // Start workers
    new NotificationWorker(
      {
        notificationEmitter,
        sendEmail,
        sendPushNotificationToUser,
        auditNotificationSent,
        auditNotificationFailed,
        emailTemplates: {
          meetingReminderHtml: meetingReminderEmailTemplate,
          meetingReminderText: meetingReminderEmailText,
        },
      },
      {
        concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5'),
        limiter: {
          max: parseInt(process.env.QUEUE_RATE_LIMIT || '100'),
          duration: 60000,
        },
      }
    );
    logger.info('Notification worker started');

    // Boot video processing worker
    new VideoProcessingWorker({
      concurrency: parseInt(process.env.VIDEO_WORKER_CONCURRENCY || '2'),
    });
    logger.info('Video processing worker started');

    // Start HTTP server
    httpServer.listen(PORT, () => {
      logger.info(`Room service started on port ${PORT}`);
      logger.info(`- HTTP API: http://localhost:${PORT}`);
      logger.info(`- SSE: http://localhost:${PORT}/api/v1/notifications/stream`);
      logger.info(`- Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
      logger.info(`- PostgreSQL: Connected`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      try {
        // Stop accepting new connections
        httpServer.close(() => {
          logger.info('HTTP server closed');
        });

        // Shutdown notification SSE
        await shutdownNotificationSSE();

        // Close notification worker
        if (notificationWorker) {
          await notificationWorker.close();
          logger.info('Notification worker closed');
        }

        // Disconnect Redis
        await redisClient.disconnect();
        logger.info('Redis disconnected');

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
// Trigger nodemon reload for shared updates 2
