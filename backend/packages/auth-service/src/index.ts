import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import logger from './utils/logger.js';
import redisClient from './config/redis.js';
import { createSessionStore } from './config/session.js';
import { prisma, validateRequiredEnv } from '@minimeet/shared';
import { app, authHealthManager } from './app.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

const createInitialSystemAdmin = async () => {
  const adminEmail = process.env.INITIAL_SYSTEM_ADMIN_EMAIL;
  const adminPassword = process.env.INITIAL_SYSTEM_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    logger.info('INITIAL_SYSTEM_ADMIN_EMAIL and INITIAL_SYSTEM_ADMIN_PASSWORD not set - skipping initial admin creation');
    return;
  }

  try {
    const existingAdmin = await prisma.user.findFirst({ where: { isSystemAdmin: true } });
    if (existingAdmin) {
      logger.info('System admin already exists');
      return;
    }

    let user = await prisma.user.findUnique({ where: { email: adminEmail.toLowerCase() } });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isSystemAdmin: true },
      });
      logger.info(`Existing user ${adminEmail} promoted to system admin`);
    } else {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);

      await prisma.user.create({
        data: {
          email: adminEmail.toLowerCase(),
          passwordHash: hashedPassword,
          name: 'System Admin',
          isSystemAdmin: true,
          onboardingCompleted: true,
        },
      });

      logger.info(`System admin created: ${adminEmail}`);
    }
  } catch (error) {
    logger.error('Error creating initial system admin:', error);
  }
};

const connectDB = async () => {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL database via Prisma (Auth Service HTTP)');
    await createInitialSystemAdmin();
  } catch (error: any) {
    logger.error('Failed to connect to PostgreSQL:', error.message);
    process.exit(1);
  }
};

const startServer = async () => {
  try {
    // Fail fast before connecting to dependencies or binding a port.
    validateRequiredEnv('auth-http', process.env);

    await connectDB();
    await redisClient.connect();

    const sessionMiddleware = await createSessionStore();
    app.use(sessionMiddleware as any);

    const server = app.listen(PORT, () => {
      authHealthManager.markStarted();
      logger.info(`Auth service HTTP server started on port ${PORT}`);
      logger.info(`- HTTP API: http://localhost:${PORT}`);
      logger.info(`- Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
      logger.info(`- PostgreSQL: Connected`);
    });

    const shutdown = async (signal: string) => {
      authHealthManager.markStopped();
      logger.info(`${signal} received, shutting down gracefully...`);

      try {
        server.close(() => {
          logger.info('HTTP server closed');
        });

        await redisClient.disconnect();
        logger.info('Redis disconnected');

        await prisma.$disconnect();
        logger.info('PostgreSQL disconnected');

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
