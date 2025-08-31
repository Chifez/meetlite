import express from 'express';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/v1/auth.route.js';
import organizationRoutes from './routes/v1/organization.routes.js';
import organizationMemberRoutes from './routes/v1/organization-member.route.js';
import invitationRoutes from './routes/v1/invitations.route.js';
import workspaceRoutes from './routes/v1/workspace.route.js';

// Import simple middleware
import corsMiddleware from './middleware/cors.js';
import rateLimiter from './middleware/rate-limiter.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

// Import configs
import redisClient from './config/redis.js';
import { createSessionStore } from './config/session.js';
import { connectionPool, createModelFactory } from '@minimeet/shared-models';

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
    console.log('Connecting to MongoDB via shared connection pool...');
    const startTime = Date.now();

    authConnection = await connectionPool.getConnection(
      'auth',
      process.env.MONGODB_URI
    );

    // Create all shared models with this specific connection
    models = createModelFactory(authConnection);

    const connectionTime = Date.now() - startTime;
    console.log(
      `✅ Connected to MongoDB via shared pool in ${connectionTime}ms`
    );

    // Handle connection events
    authConnection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    authConnection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    authConnection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
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
    console.log('Connecting to Redis...');
    await redisClient.connect();

    // Setup session middleware after Redis connection
    const sessionMiddleware = await createSessionStore();
    app.use(sessionMiddleware);

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Auth service running on port ${PORT}`);
      console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
