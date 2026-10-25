import dotenv from 'dotenv';
import { prisma, validateRequiredEnv } from '@minimeet/shared';
import logger from './utils/logger.js';
import { startRecurrenceScheduler } from './jobs/recurrence.job.js';

dotenv.config();

let recurrenceTask: { stop: () => void } | null = null;

const connectDB = async () => {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL database via Prisma (Room Scheduler)');
  } catch (error: any) {
    logger.error('Failed to connect to PostgreSQL in scheduler:', error.message);
    process.exit(1);
  }
};

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in scheduler process:', error);
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection in scheduler process:', reason);
  setTimeout(() => process.exit(1), 1000);
});

export const startScheduler = async () => {
  try {
    validateRequiredEnv('room-scheduler', process.env);

    await connectDB();

    recurrenceTask = startRecurrenceScheduler(process.env.RECURRENCE_CRON_SCHEDULE || '0 2 * * *');
    logger.info('Recurrence scheduler started successfully');

    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down scheduler gracefully...`);

      try {
        if (recurrenceTask) {
          recurrenceTask.stop();
          logger.info('Recurrence scheduler stopped');
        }

        await prisma.$disconnect();
        logger.info('Graceful scheduler shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during scheduler shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start scheduler process:', error);
    process.exit(1);
  }
};

// Start scheduler if executed directly as entrypoint
if (process.argv[1]?.endsWith('scheduler.js') || process.argv[1]?.endsWith('scheduler.ts')) {
  startScheduler();
}
