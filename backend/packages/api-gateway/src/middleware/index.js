/**
 * Middleware Configuration
 * Centralized middleware setup for the API Gateway
 */

import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import express from 'express';
import config from '../config/index.js';

/**
 * Security middleware
 */
export function setupSecurityMiddleware(app) {
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
export function setupPerformanceMiddleware(app) {
  // Compression
  app.use(compression());

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
export function setupRateLimitMiddleware(app) {
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
  });

  app.use(limiter);
}

/**
 * Body parsing middleware
 */
export function setupBodyParsingMiddleware(app) {
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
export function setupHealthCheckMiddleware(app) {
  app.get('/health', (req, res) => {
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
export function setupErrorHandlingMiddleware(app) {
  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  });

  // Global error handler
  app.use((err, req, res, next) => {
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
export function setupRequestLoggingMiddleware(app) {
  app.use((req, res, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      console.log(
        `[REQUEST] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
      );
    });

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
