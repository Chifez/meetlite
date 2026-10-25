import express, { Request, Response } from 'express';
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
import adminRoutes from './routes/v1/admin.route.js';
import contactRoutes from './routes/v1/contact.routes.js';
import activityRoutes from './routes/v1/activity.route.js';
import { blockSystemAdmin } from './middleware/block-system-admin.js';

// Import middleware
import corsMiddleware from './middleware/cors.js';
import rateLimiter from './middleware/rate-limiter.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { authenticateToken } from './middleware/authenticate-token.js';

dotenv.config();

import {
  HealthManager,
  createHealthRouter,
  createPrismaProbe,
  createRedisProbe,
  createCorrelationMiddleware,
  createRequestLoggingMiddleware,
  prisma,
} from '@minimeet/shared';
import redisClient from './config/redis.js';
import { logger } from './utils/logger.js';

export const authHealthManager = new HealthManager();
authHealthManager.registerProbe(
  'postgres',
  createPrismaProbe(prisma, { timeoutMs: 2000 }),
  { critical: true }
);
authHealthManager.registerProbe(
  'redis',
  createRedisProbe(() => redisClient.getClient(), { timeoutMs: 2000 }),
  { critical: true }
);

export function createAuthApp(customHealthManager?: HealthManager): express.Application {
  const app = express();
  const health = customHealthManager || authHealthManager;

  // Mount correlation middleware first so all requests receive/preserve correlation IDs
  app.use(createCorrelationMiddleware('auth-service') as any);

  // Mount standardized health probe router before CORS and auth middleware
  app.use('/health', createHealthRouter(health) as any);

  // Request telemetry logging (skips health check probes)
  app.use(createRequestLoggingMiddleware({ serviceName: 'auth-service', logger }) as any);

  // CORS
  app.use(corsMiddleware);

  // Rate limiting
  app.use(rateLimiter as any);

  // Body parsing
  app.use(
    express.json({
      limit: '10mb',
      verify: (req: any, res, buf) => {
        if (req.originalUrl && req.originalUrl.includes('/webhook')) {
          req.rawBody = buf;
        }
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Routes
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
  app.use('/api/v1', authenticateToken as any, blockSystemAdmin as any, teamRoutes as any);
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

  // 404 handler for unknown routes
  app.use(notFoundHandler as any);

  // Global error handler
  app.use(errorHandler as any);

  return app;
}

export const app = createAuthApp();
