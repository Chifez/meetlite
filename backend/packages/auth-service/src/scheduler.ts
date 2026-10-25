import dotenv from 'dotenv';
import { prisma, validateRequiredEnv } from '@minimeet/shared';
import logger from './utils/logger.js';
import { startUsageResetScheduler } from './jobs/usage-reset.job.js';
import { startPlanExpirationScheduler } from './jobs/plan-expiration.job.js';
import { startPlanExpiryWarningScheduler } from './jobs/plan-expiry-warning.job.js';

dotenv.config();

let usageResetTask: { stop: () => void } | null = null;
let planExpirationTask: { stop: () => void } | null = null;
let planExpiryWarningTask: { stop: () => void } | null = null;

const connectDB = async () => {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL database via Prisma (Auth Scheduler)');
  } catch (error: any) {
    logger.error('Failed to connect to PostgreSQL in auth scheduler:', error.message);
    process.exit(1);
  }
};

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in auth scheduler process:', error);
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection in auth scheduler process:', reason);
  setTimeout(() => process.exit(1), 1000);
});

export const startScheduler = async () => {
  try {
    validateRequiredEnv('auth-scheduler', process.env);

    await connectDB();

    usageResetTask = startUsageResetScheduler();
    logger.info('Usage reset scheduler started');

    planExpirationTask = startPlanExpirationScheduler();
    logger.info('Plan expiration scheduler started');

    planExpiryWarningTask = startPlanExpiryWarningScheduler();
    logger.info('Plan expiry warning scheduler started');

    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down auth scheduler gracefully...`);

      try {
        if (usageResetTask) usageResetTask.stop();
        if (planExpirationTask) planExpirationTask.stop();
        if (planExpiryWarningTask) planExpiryWarningTask.stop();

        await prisma.$disconnect();
        logger.info('Graceful auth scheduler shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during auth scheduler shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start auth scheduler process:', error);
    process.exit(1);
  }
};

// Start scheduler if executed directly as entrypoint
if (process.argv[1]?.endsWith('scheduler.js') || process.argv[1]?.endsWith('scheduler.ts')) {
  startScheduler();
}
