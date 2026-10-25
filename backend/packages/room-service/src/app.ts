import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { verifyToken } from './middleware/auth.js';
import logger from './utils/logger.js';

// Versioned routes
import roomRoutesV1 from './routes/v1/rooms.routes.js';
import meetingRoutesV1 from './routes/v1/meetings.routes.js';
import recordingRoutesV1 from './routes/v1/recordings.routes.js';
import analyticsRoutesV1 from './routes/v1/analytics.routes.js';
import aiRoutesV1 from './routes/v1/ai.routes.js';
import calendarRoutesV1 from './routes/v1/calendar.routes.js';
import notificationRoutesV1 from './routes/v1/notifications.routes.js';

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

export const roomHealthManager = new HealthManager();
roomHealthManager.registerProbe(
  'postgres',
  createPrismaProbe(prisma, { timeoutMs: 2000 }),
  { critical: true }
);
roomHealthManager.registerProbe(
  'redis',
  createRedisProbe(() => redisClient.client, { timeoutMs: 2000 }),
  { critical: true }
);

export function createRoomApp(customHealthManager?: HealthManager): express.Application {
  const app = express();
  const health = customHealthManager || roomHealthManager;

  // Mount correlation middleware first so all requests receive/preserve correlation IDs
  app.use(createCorrelationMiddleware('room-service') as any);

  // Mount standardized health probe router before CORS and auth middleware
  app.use('/health', createHealthRouter(health) as any);

  // Request telemetry logging (skips health check probes)
  app.use(createRequestLoggingMiddleware({ serviceName: 'room-service', logger }) as any);

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Public calendar routes that do not require token verification (e.g., OAuth callbacks)
  app.use('/api/v1/calendar', calendarRoutesV1 as any);

  app.use(verifyToken as any);

  // Versioned API routes (authenticated)
  app.use('/api/v1/rooms', roomRoutesV1 as any);
  app.use('/api/v1/meetings', meetingRoutesV1 as any);
  app.use('/api/v1/recordings', recordingRoutesV1 as any);
  app.use('/api/v1/analytics', analyticsRoutesV1 as any);
  app.use('/api/v1/ai', aiRoutesV1 as any);
  app.use('/api/v1/notifications', notificationRoutesV1 as any);

  // Global error handler middleware
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error:', err);

    if (err.isOperational && err.code) {
      const response = err.toResponse
        ? err.toResponse()
        : {
            success: false,
            message: err.message,
            code: err.code,
            timestamp: err.timestamp,
          };
      return res.status(err.statusCode || 500).json(response);
    }

    res.status(500).json({
      success: false,
      code: 'SYSTEM_9006',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

export const app = createRoomApp();
