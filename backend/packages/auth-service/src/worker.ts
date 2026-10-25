import dotenv from 'dotenv';
import logger from './utils/logger.js';
import redisClient from './config/redis.js';
import {
  prisma,
  validateRequiredEnv,
  EmailWorker,
  getMeetingInviteEmailTemplate,
  meetingReminderEmailTemplate,
  meetingReminderEmailText,
  adaptWelcomeTemplate,
  adaptPasswordResetTemplate,
  adaptOrganizationInviteTemplate,
  adaptTeamInviteTemplate,
  adaptMeetingInviteTemplate,
  adaptMeetingReminderTemplate,
  adaptPlanEmailTemplate,
  adaptPlanExpirationWarningTemplate,
} from '@minimeet/shared';

// Import email templates
import { getWelcomeEmailTemplate } from './templates/welcome-email.js';
import { getPasswordResetEmailTemplate } from './templates/password-reset-email.js';
import { getOrganizationInviteEmailTemplate } from './templates/organization-invite-email.js';
import { getTeamInviteEmailTemplate } from './templates/team-invite-email.js';
import { getPlanUpgradeEmailTemplate } from './templates/plan-upgrade-email.js';
import { getPlanCancellationEmailTemplate } from './templates/plan-cancellation-email.js';
import { getPlanExpirationWarningEmailTemplate } from './templates/plan-expiration-warning-email.js';
import { getPlanExpirationEmailTemplate } from './templates/plan-expiration-email.js';
import { getPaymentFailureEmailTemplate } from './templates/payment-failure-email.js';
import { getPlanDowngradeEmailTemplate } from './templates/plan-downgrade-email.js';

dotenv.config();

let emailWorker: any = null;

const connectDB = async () => {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL database via Prisma (Auth Worker)');
  } catch (error: any) {
    logger.error('Failed to connect to PostgreSQL in auth worker:', error.message);
    process.exit(1);
  }
};

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in auth worker process:', error);
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection in auth worker process:', reason);
  setTimeout(() => process.exit(1), 1000);
});

export const startWorker = async () => {
  try {
    validateRequiredEnv('auth-worker', process.env);

    await connectDB();
    await redisClient.connect();

    const emailTemplates = {
      welcome: adaptWelcomeTemplate(getWelcomeEmailTemplate),
      password_reset: adaptPasswordResetTemplate(getPasswordResetEmailTemplate),
      organization_invite: adaptOrganizationInviteTemplate(
        getOrganizationInviteEmailTemplate
      ),
      team_invite: adaptTeamInviteTemplate(getTeamInviteEmailTemplate),
      meeting_invite: adaptMeetingInviteTemplate(
        getMeetingInviteEmailTemplate
      ),
      meeting_reminder: adaptMeetingReminderTemplate(
        meetingReminderEmailTemplate,
        meetingReminderEmailText
      ),
      plan_upgrade: adaptPlanEmailTemplate(getPlanUpgradeEmailTemplate),
      plan_cancellation: adaptPlanEmailTemplate(
        getPlanCancellationEmailTemplate
      ),
      plan_downgrade: adaptPlanEmailTemplate(getPlanDowngradeEmailTemplate),
      plan_expiration_warning: adaptPlanExpirationWarningTemplate(
        getPlanExpirationWarningEmailTemplate
      ),
      plan_expiration: adaptPlanEmailTemplate(getPlanExpirationEmailTemplate),
      payment_failure: adaptPlanEmailTemplate(getPaymentFailureEmailTemplate),
    };

    emailWorker = new EmailWorker(
      {
        User: prisma.user,
        emailTemplates,
        auditEmailSent: null,
        auditEmailFailed: null,
      },
      {
        concurrency: parseInt(process.env.EMAIL_WORKER_CONCURRENCY || '10'),
        limiter: {
          max: parseInt(process.env.EMAIL_RATE_LIMIT || '100'),
          duration: 60000,
        },
      }
    );
    logger.info('Email worker started');

    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down email worker gracefully...`);

      try {
        if (emailWorker) {
          await emailWorker.close();
          logger.info('Email worker closed');
        }

        await redisClient.disconnect();
        logger.info('Redis disconnected');

        await prisma.$disconnect();
        logger.info('PostgreSQL disconnected');

        logger.info('Graceful auth worker shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during auth worker shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start auth worker process:', error);
    process.exit(1);
  }
};

// Start worker if executed directly as entrypoint
if (process.argv[1]?.endsWith('worker.js') || process.argv[1]?.endsWith('worker.ts')) {
  startWorker();
}
