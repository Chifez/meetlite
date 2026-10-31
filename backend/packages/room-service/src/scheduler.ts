import dotenv from 'dotenv';
import { prisma, validateRequiredEnv } from '@minimeet/shared';
import logger from './utils/logger.js';
import { startRecurrenceScheduler } from './jobs/recurrence.job.js';
import { PrismaOutboxRepository } from './meeting-domain/repositories/prisma-outbox.repository.js';
import { OutboxPublisher } from './meeting-domain/invitations/outbox-publisher.js';
import { MeetingOutboxDispatcher } from './meeting-domain/invitations/meeting-outbox-dispatcher.js';

dotenv.config();

let recurrenceTask: { stop: () => void } | null = null;
let outboxTimer: NodeJS.Timeout | null = null;

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
    const outboxPublisher = new OutboxPublisher(
      new PrismaOutboxRepository(prisma),
      new MeetingOutboxDispatcher(prisma)
    );
    const publishOutbox = async () => {
      const result = await outboxPublisher.publishBatch(50);
      if (result.processed > 0) logger.info('Meeting outbox batch processed', result);
    };
    await publishOutbox();
    outboxTimer = setInterval(() => void publishOutbox().catch((error) => {
      logger.error('Meeting outbox batch failed', error);
    }), 5_000);
    logger.info('Recurrence scheduler started successfully');

    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down scheduler gracefully...`);

      try {
        if (recurrenceTask) {
          recurrenceTask.stop();
          logger.info('Recurrence scheduler stopped');
        }
        if (outboxTimer) clearInterval(outboxTimer);

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
