import dotenv from 'dotenv';
import redisClient from './config/redis.js';
import {
  prisma,
  validateRequiredEnv,
  NotificationWorker,
  meetingReminderEmailTemplate,
  meetingReminderEmailText,
} from '@minimeet/shared';
import { VideoProcessingWorker } from './jobs/video-processing.worker.js';
import logger from './utils/logger.js';
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

dotenv.config();

let notificationWorker: any = null;
let videoWorker: any = null;

// Connect to PostgreSQL database using Prisma
const connectDB = async () => {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL database via Prisma (Room Worker)');
  } catch (error: any) {
    logger.error('Failed to connect to PostgreSQL:', error.message);
    process.exit(1);
  }
};

// Process error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in worker process:', error);
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection in worker process:', reason);
  setTimeout(() => process.exit(1), 1000);
});

export const startWorker = async () => {
  try {
    // Fail fast before connecting or accepting any queue job.
    validateRequiredEnv('room-worker', process.env);

    await connectDB();
    await redisClient.connect();

    // Initialize notification SSE service (configures Redis pub/sub publisher for notification delivery)
    initializeNotificationSSE();
    logger.info('Notification SSE Pub/Sub publisher initialized for worker');

    // Create notification emitter for worker
    const notificationEmitter = {
      emit: (event: string, data: any) => {
        if (event === 'notification' && data.userId) {
          sendNotificationToUser(data.userId, data.notification);
        }
      },
    };

    // Start Notification Worker
    notificationWorker = new NotificationWorker(
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

    // Boot Video Processing Worker
    videoWorker = new VideoProcessingWorker({
      concurrency: parseInt(process.env.VIDEO_WORKER_CONCURRENCY || '2'),
    });
    logger.info('Video processing worker started');

    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down workers gracefully...`);

      try {
        if (notificationWorker) {
          await notificationWorker.close();
          logger.info('Notification worker closed');
        }

        if (videoWorker) {
          await videoWorker.close();
          logger.info('Video processing worker closed');
        }

        await shutdownNotificationSSE();
        await redisClient.disconnect();
        await prisma.$disconnect();

        logger.info('Graceful worker shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during worker shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start worker process:', error);
    process.exit(1);
  }
};

// Start worker if executed directly as entrypoint
if (process.argv[1]?.endsWith('worker.js') || process.argv[1]?.endsWith('worker.ts')) {
  startWorker();
}
