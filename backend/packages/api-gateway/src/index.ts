/**
 * Main API Gateway Application
 * Clean, production-ready API gateway with proper routing and error handling
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import http from 'http';

// Import configuration and utilities
import config from './config/index.js';
import {
  createServiceProxy,
  getServiceForPath,
} from './routes/service-router.js';
import {
  setupSecurityMiddleware,
  setupPerformanceMiddleware,
  setupRateLimitMiddleware,
  setupHealthCheckMiddleware,
  setupErrorHandlingMiddleware,
  setupRequestLoggingMiddleware,
} from './middleware/index.js';
import { createProxyMiddleware } from 'http-proxy-middleware';

// Load environment variables
dotenv.config();

/**
 * Create and configure the Express application
 */
function createApp(): Express {
  const app = express();

  // Setup middleware in correct order
  // Health check must be BEFORE security middleware (CORS) to allow unrestricted access
  setupHealthCheckMiddleware(app);
  setupSecurityMiddleware(app);
  setupPerformanceMiddleware(app);
  setupRateLimitMiddleware(app);
  // Note: Body parsing removed - backend services handle their own parsing
  setupRequestLoggingMiddleware(app);

  return app;
}

/**
 * Setup service routing
 * @param {Express} app - Express application instance
 */
function setupServiceRouting(app: Express) {
  // Handle all API routes
  app.use('/api/*', (req: Request, res: Response, next: NextFunction) => {
    // Restore the full path for service matching
    const fullPath = req.originalUrl;
    const service = getServiceForPath(fullPath);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found for this endpoint',
        path: fullPath,
        timestamp: new Date().toISOString(),
      });
    }

    // Create and use the appropriate proxy
    const proxy = createServiceProxy(service);
    proxy(req as any, res as any, next);
  });

  // Handle WebSocket and file upload routes
  // Socket.IO connections - proxy to MediaSoup service
  app.use(
    '/socket.io',
    createServiceProxy({
      paths: [],
      target: config.services.mediasoup,
      pathRewrite: {},
    }) as any
  );

  // Tldraw WebSocket connections - proxy to MediaSoup service
  app.use(
    '/connect',
    createServiceProxy({
      paths: [],
      target: config.services.mediasoup,
      pathRewrite: {},
    }) as any
  );
}

/**
 * Setup WebSocket proxy for /connect endpoints
 * @param {http.Server} server - HTTP server instance
 */
function setupWebSocketProxy(server: http.Server) {
  // Create WebSocket proxy for /connect endpoints
  const wsProxy = createProxyMiddleware({
    target: config.services.mediasoup,
    ws: true, // Enable WebSocket proxying
    changeOrigin: true,
    pathRewrite: {},
    onError: (err: any, req: any, res: any) => {
      console.error('[WS PROXY ERROR] /connect:', err.message);
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          message: 'WebSocket proxy error',
          error:
            config.server.nodeEnv === 'development' ? err.message : undefined,
        });
      }
    },
  } as any);

  // Handle WebSocket upgrade requests
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url!, `http://${request.headers.host}`)
      .pathname;

    if (pathname.startsWith('/connect')) {
      (wsProxy as any).upgrade(request, socket, head);
    } else {
      socket.destroy();
    }
  });
}

/**
 * Start the API Gateway server
 */
function startServer(): http.Server {
  const app = createApp();

  // Setup routing
  setupServiceRouting(app);

  // Setup error handling (must be last)
  setupErrorHandlingMiddleware(app);

  // Start server
  const server = app.listen(config.server.port, () => {
    console.log(
      `API Gateway started on port ${config.server.port} (${config.server.nodeEnv})`
    );
  });

  // Setup WebSocket proxy
  setupWebSocketProxy(server);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    server.close(() => {
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    server.close(() => {
      process.exit(0);
    });
  });

  return server;
}

// Start the server
startServer();

export { createApp, setupServiceRouting, startServer };
export default { createApp, setupServiceRouting, startServer };
