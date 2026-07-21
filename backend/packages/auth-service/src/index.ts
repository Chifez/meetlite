import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Import routes
import authRoutes from './routes/v1/auth.route.js';
import organizationRoutes from './routes/v1/organization.routes.js';
import organizationMemberRoutes from './routes/v1/organization-member.route.js';
import invitationRoutes from './routes/v1/invitations.route.js';
import workspaceRoutes from './routes/v1/workspace.route.js';
import planRoutes from './routes/v1/plan.route.js';
import planManagementRoutes from './routes/v1/plan-management.route.js';
import multiOrganizationRoutes from './routes/v1/multi-organization.route.js';
import bulkOperationsRoutes from './routes/v1/bulk-operations.route.js';
import paymentRoutes from './routes/v1/payment.route.js';
import pushNotificationsRoutes from './routes/v1/push-notifications.route.js';
import teamRoutes from './routes/v1/team.route.js';
import teamInvitationRoutes from './routes/v1/team-invitation.route.js';
import adminRoutes from './routes/v1/admin.route.js';
import contactRoutes from './routes/v1/contact.routes.js';
import activityRoutes from './routes/v1/activity.route.js';
import { blockSystemAdmin } from './middleware/block-system-admin.js';

// Import simple middleware
import corsMiddleware from './middleware/cors.js';
import rateLimiter from './middleware/rate-limiter.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { authenticateToken } from './middleware/authenticate-token.js';
import logger from './utils/logger.js';

// Import configs
import redisClient from './config/redis.js';
import { createSessionStore } from './config/session.js';
import {
  prisma,
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

// Import cron jobs
import './jobs/usage-reset.job.js';
import './jobs/plan-expiration.job.js';
import './jobs/plan-expiry-warning.job.js';

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

const app = express();
const PORT = process.env.PORT || 5000;

// ================================
// MIDDLEWARE
// ================================

// Health check - must be BEFORE CORS to allow unrestricted access
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// CORS
app.use(corsMiddleware);

// Rate limiting
app.use(rateLimiter as any);

// Body parsing
app.use(express.json({
  limit: '10mb',
  verify: (req: any, res, buf) => {
    if (req.originalUrl && req.originalUrl.includes('/webhook')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ================================
// ROUTES
// ================================

// API routes


app.use('/api/v1/auth', authRoutes as any);

// Only load payment routes if Stripe is configured
if (process.env.STRIPE_SECRET_KEY) {
  app.use('/api/v1/payment', paymentRoutes as any);
}

// Public contact routes (no authentication required)
app.use('/api/v1/contact', contactRoutes as any);
app.use('/api/v1/activities', activityRoutes as any);

// Admin routes (requires admin access) - must come BEFORE catch-all /api/v1 routes
app.use('/api/v1/admin', adminRoutes as any);

// User routes - block system admins (they can only access /admin routes)
// Note: Routes already have authenticateToken, but we apply it here first so blockSystemAdmin can access req.user
app.use('/api/v1', authenticateToken as any, blockSystemAdmin as any, teamRoutes as any); // Mount team routes at /api/v1
app.use(
  '/api/v1/organizations',
  authenticateToken as any,
  blockSystemAdmin as any,
  organizationRoutes as any
);
app.use(
  '/api/v1/organizations/members',
  authenticateToken as any,
  blockSystemAdmin as any,
  organizationMemberRoutes as any
);
app.use(
  '/api/v1/invitations',
  authenticateToken as any,
  blockSystemAdmin as any,
  invitationRoutes as any
);
app.use(
  '/api/v1/workspace',
  authenticateToken as any,
  blockSystemAdmin as any,
  workspaceRoutes as any
);
app.use('/api/v1/plan', authenticateToken as any, blockSystemAdmin as any, planRoutes as any);
app.use(
  '/api/v1/plan-management',
  authenticateToken as any,
  blockSystemAdmin as any,
  planManagementRoutes as any
);
app.use(
  '/api/v1/multi-org',
  authenticateToken as any,
  blockSystemAdmin as any,
  multiOrganizationRoutes as any
);
app.use(
  '/api/v1/bulk',
  authenticateToken as any,
  blockSystemAdmin as any,
  bulkOperationsRoutes as any
);
app.use(
  '/api/v1/push-notifications',
  authenticateToken as any,
  blockSystemAdmin as any,
  pushNotificationsRoutes as any
);
app.use('/api/v1', authenticateToken as any, blockSystemAdmin as any, teamInvitationRoutes as any);



// ================================
// ERROR HANDLING
// ================================

// 404 handler for unknown routes
app.use(notFoundHandler as any);

// Global error handler
app.use(errorHandler as any);

// Mongoose models have been fully replaced with Prisma

let emailWorker: any = null;

const createInitialSystemAdmin = async () => {
  const adminEmail = process.env.INITIAL_SYSTEM_ADMIN_EMAIL;
  const adminPassword = process.env.INITIAL_SYSTEM_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.log(
      'â„¹ï¸  INITIAL_SYSTEM_ADMIN_EMAIL and INITIAL_SYSTEM_ADMIN_PASSWORD not set - skipping initial admin creation'
    );
    return;
  }

  try {
    const existingAdmin = await prisma.user.findFirst({ where: { isSystemAdmin: true } });
    if (existingAdmin) {
      console.log('âœ… System admin already exists');
      return;
    }

    let user = await prisma.user.findUnique({ where: { email: adminEmail.toLowerCase() } });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isSystemAdmin: true }
      });
      console.log(`âœ… Existing user ${adminEmail} promoted to system admin`);
    } else {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);

      user = await prisma.user.create({
        data: {
          email: adminEmail.toLowerCase(),
          passwordHash: hashedPassword,
          name: 'System Admin',
          isSystemAdmin: true,
          onboardingCompleted: true,
        }
      });

      console.log(`âœ… System admin created: ${adminEmail}`);
    }
  } catch (error) {
    console.error('âŒ Error creating initial system admin:', error);
  }
};

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('âœ… Connected to PostgreSQL database via Prisma');
    await createInitialSystemAdmin();
  } catch (error: any) {
    console.error('âŒ Failed to connect to PostgreSQL:', error.message);
    process.exit(1);
  }
};

// ================================
// SERVER STARTUP
// ================================

const startServer = async () => {
  try {
    await connectDB();
    await redisClient.connect();

    const sessionMiddleware = await createSessionStore();
    app.use(sessionMiddleware as any);

    const emailTemplates = {
      welcome: adaptWelcomeTemplate(getWelcomeEmailTemplate),
      password_reset: adaptPasswordResetTemplate(getPasswordResetEmailTemplate),
      organization_invite: adaptOrganizationInviteTemplate(
        getOrganizationInviteEmailTemplate
      ),
      team_invite: adaptTeamInviteTemplate(getTeamInviteEmailTemplate),
      meeting_invite: adaptMeetingInviteTemplate(getMeetingInviteEmailTemplate),
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

    const server = app.listen(PORT, () => {
      logger.info(`Auth service started on port ${PORT}`);
    });

    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      try {
        server.close(() => {
          logger.info('HTTP server closed');
        });

        if (emailWorker) {
          await emailWorker.close();
          logger.info('Email worker closed');
        }

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

