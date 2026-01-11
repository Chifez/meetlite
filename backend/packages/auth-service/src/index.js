import express from 'express';
import dotenv from 'dotenv';

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

// Import simple middleware
import corsMiddleware from './middleware/cors.js';
import rateLimiter from './middleware/rate-limiter.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

// Import configs
import redisClient from './config/redis.js';
import { createSessionStore } from './config/session.js';
import {
  connectionPool,
  createModelFactory,
  EmailWorker,
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
// Import meeting templates from room-service
import { getMeetingInviteEmailTemplate } from '../../room-service/src/templates/meeting-invite-email.js';
import {
  meetingReminderEmailTemplate,
  meetingReminderEmailText,
} from '../../room-service/src/templates/meeting-reminder-email.js';
import {
  adaptWelcomeTemplate,
  adaptPasswordResetTemplate,
  adaptOrganizationInviteTemplate,
  adaptTeamInviteTemplate,
  adaptMeetingInviteTemplate,
  adaptMeetingReminderTemplate,
  adaptPlanEmailTemplate,
  adaptPlanExpirationWarningTemplate,
} from '@minimeet/shared';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ================================
// MIDDLEWARE
// ================================

// Health check - must be BEFORE CORS to allow unrestricted access
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// CORS
app.use(corsMiddleware);

// Rate limiting
app.use(rateLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ================================
// ROUTES
// ================================

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', teamRoutes); // Mount team routes at /api/v1 (routes defined as /organizations/:organizationId/teams)
app.use('/api/v1/organizations', organizationRoutes);
app.use('/api/v1/organizations/members', organizationMemberRoutes);
app.use('/api/v1/invitations', invitationRoutes);
app.use('/api/v1/workspace', workspaceRoutes);
app.use('/api/v1/plan', planRoutes);
app.use('/api/v1/plan-management', planManagementRoutes);
app.use('/api/v1/multi-org', multiOrganizationRoutes);
app.use('/api/v1/bulk', bulkOperationsRoutes);
app.use('/api/v1/push-notifications', pushNotificationsRoutes);
app.use('/api/v1', teamInvitationRoutes); // Mount team invitation routes at /api/v1 (handles both org-scoped and user-scoped routes)

// Only load payment routes if Stripe is configured
if (process.env.STRIPE_SECRET_KEY) {
  app.use('/api/v1/payment', paymentRoutes);
  // Payment routes loaded
} else {
  // Payment routes skipped (Stripe not configured)
}

// ================================
// ERROR HANDLING
// ================================

// 404 handler for unknown routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Connect to MongoDB using shared connection pool
let authConnection = null;
export let models = null;
let emailWorker = null;

const connectDB = async () => {
  try {
    authConnection = await connectionPool.getConnection(
      'auth',
      process.env.MONGODB_URI
    );

    // Create all shared models with this specific connection
    models = createModelFactory(authConnection);

    // Handle connection events
    authConnection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
};

// ================================
// SERVER STARTUP
// ================================

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Connect to Redis
    await redisClient.connect();

    // Setup session middleware after Redis connection
    const sessionMiddleware = await createSessionStore();
    app.use(sessionMiddleware);

    // Create email templates object with adapters
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
      plan_expiration_warning: adaptPlanExpirationWarningTemplate(
        getPlanExpirationWarningEmailTemplate
      ),
    };

    // Start email worker
    emailWorker = new EmailWorker(
      {
        User: models.User,
        emailTemplates,
        // Audit functions can be added later
        auditEmailSent: null,
        auditEmailFailed: null,
      },
      {
        concurrency: parseInt(process.env.EMAIL_WORKER_CONCURRENCY || '10'),
        limiter: {
          max: parseInt(process.env.EMAIL_RATE_LIMIT || '100'),
          duration: 60000, // Per minute
        },
      }
    );
    console.log('✅ Email worker started');

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`Auth service started on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n⏹️  ${signal} received, shutting down gracefully...`);

      try {
        // Stop accepting new connections
        server.close(() => {
          console.log('✅ HTTP server closed');
        });

        // Close email worker
        if (emailWorker) {
          await emailWorker.close();
          console.log('✅ Email worker closed');
        }

        // Disconnect Redis
        await redisClient.disconnect();
        console.log('✅ Redis disconnected');

        console.log('✅ Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
