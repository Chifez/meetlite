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

// Import simple middleware
import corsMiddleware from './middleware/cors.js';
import rateLimiter from './middleware/rate-limiter.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

// Import configs
import redisClient from './config/redis.js';
import { createSessionStore } from './config/session.js';
import { connectionPool, createModelFactory } from '@minimeet/shared-models';

// Import cron jobs
import './jobs/usage-reset.job.js';
import './jobs/plan-expiration.job.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ================================
// MIDDLEWARE
// ================================

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/organizations', organizationRoutes);
app.use('/api/v1/organizations/members', organizationMemberRoutes);
app.use('/api/v1/invitations', invitationRoutes);
app.use('/api/v1/workspace', workspaceRoutes);
app.use('/api/v1/plan', planRoutes);
app.use('/api/v1/plan-management', planManagementRoutes);
app.use('/api/v1/multi-org', multiOrganizationRoutes);
app.use('/api/v1/bulk', bulkOperationsRoutes);
app.use('/api/v1/push-notifications', pushNotificationsRoutes);

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

    // Start server
    app.listen(PORT, () => {
      console.log(`Auth service started on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
