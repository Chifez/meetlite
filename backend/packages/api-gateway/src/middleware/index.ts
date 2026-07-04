/**
 * Middleware Configuration
 * Centralized middleware setup for the API Gateway
 */

import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import express, { Express, Request, Response, NextFunction } from 'express';
import config from '../config/index.js';

/**
 * Security middleware
 */
export function setupSecurityMiddleware(app: Express) {
  // Helmet for security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable CSP for API gateway
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS configuration
  app.use(
    cors({
      origin: config.cors.origins,
      credentials: config.cors.credentials,
      methods: config.cors.methods,
      allowedHeaders: config.cors.allowedHeaders,
      exposedHeaders: config.cors.exposedHeaders,
      optionsSuccessStatus: 200,
    })
  );
}

/**
 * Performance middleware
 */
export function setupPerformanceMiddleware(app: Express) {
  // Compression - exclude SSE streams to prevent buffering
  // Compression buffers data, which breaks SSE's real-time streaming nature
  app.use(
    compression({
      filter: (req: any, res: any) => {
        // Don't compress SSE streams - they need real-time streaming
        // Compression buffers data, which breaks SSE's continuous stream
        if (req.url?.includes('/stream')) {
          return false;
        }
        // Use default compression filter for all other requests
        return compression.filter(req, res);
      },
    }) as any
  );

  // Request logging
  if (config.server.nodeEnv === 'development') {
    app.use(morgan('dev'));
  } else {
    app.use(morgan('combined'));
  }
}

/**
 * Rate limiting middleware
 */
export function setupRateLimitMiddleware(app: Express) {
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
      success: false,
      message: config.rateLimit.message,
      timestamp: new Date().toISOString(),
    },
    standardHeaders: true,
    legacyHeaders: false,

    skip: (req: any) => {
      const env = config.server.nodeEnv;
      const disableRateLimit = process.env.DISABLE_RATE_LIMIT === 'true';
      const bypassHeader = req.headers['x-bypass-rate-limit'] === 'true';
      const bypassSecret = process.env.RATE_LIMIT_BYPASS_SECRET;
      const hasValidSecret = bypassSecret && req.headers['x-bypass-rate-limit-secret'] === bypassSecret;

      // Skip if:
      // 1. Test environment
      // 2. DISABLE_RATE_LIMIT=true is set
      // 3. Request has X-Bypass-Rate-Limit header (allowed in dev/test, or with valid secret in prod)
      return (
        env === 'test' ||
        disableRateLimit ||
        !!(bypassHeader && (env !== 'production' || hasValidSecret))
      );
    },
  });

  app.use(limiter);
}

/**
 * Body parsing middleware
 */
export function setupBodyParsingMiddleware(app: Express) {
  app.use(
    express.json({
      limit: config.requestLimits.json,
      strict: true,
    })
  );

  app.use(
    express.urlencoded({
      extended: true,
      limit: config.requestLimits.urlEncoded,
    })
  );
}

/**
 * Health check middleware
 */
export function setupHealthCheckMiddleware(app: Express) {
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: config.healthCheck.status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: config.healthCheck.services,
      environment: config.server.nodeEnv,
    });
  });
}

/**
 * Error handling middleware
 */
export function setupErrorHandlingMiddleware(app: Express) {
  // 404 handler
  app.use('*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  });

  // Global error handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[GATEWAY ERROR]:', err);

    // Don't send response if headers already sent
    if (res.headersSent) {
      return next(err);
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: config.server.nodeEnv === 'development' ? err.message : undefined,
      timestamp: new Date().toISOString(),
    });
  });
}

/**
 * Request logging middleware
 */
export function setupRequestLoggingMiddleware(app: Express) {
  // Request logging disabled for performance
  // Enable in development if needed
  app.use((req: Request, res: Response, next: NextFunction) => {
    next();
  });
}

export default {
  setupSecurityMiddleware,
  setupPerformanceMiddleware,
  setupRateLimitMiddleware,
  setupBodyParsingMiddleware,
  setupHealthCheckMiddleware,
  setupErrorHandlingMiddleware,
  setupRequestLoggingMiddleware,
};
