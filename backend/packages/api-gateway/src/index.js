/**
 * Main API Gateway Application
 * Clean, production-ready API gateway with proper routing and error handling
 */

import express from 'express';
import dotenv from 'dotenv';

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
function createApp() {
  const app = express();

  // Setup middleware in correct order
  setupSecurityMiddleware(app);
  setupPerformanceMiddleware(app);
  setupRateLimitMiddleware(app);
  // Note: Body parsing removed - backend services handle their own parsing
  setupRequestLoggingMiddleware(app);
  setupHealthCheckMiddleware(app);

  return app;
}

/**
 * Setup service routing
 * @param {Express} app - Express application instance
 */
function setupServiceRouting(app) {
  // Handle all API routes
  app.use('/api/*', (req, res, next) => {
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
    proxy(req, res, next);
  });

  // Handle WebSocket and file upload routes
  app.use(
    '/socket.io',
    createServiceProxy({
      target: config.services.mediasoup,
      pathRewrite: {},
    })
  );

  app.use(
    '/uploads',
    createServiceProxy({
      target: config.services.mediasoup,
      pathRewrite: {},
    })
  );

  app.use(
    '/connect',
    createServiceProxy({
      target: config.services.mediasoup,
      pathRewrite: {},
    })
  );
}

/**
 * Setup WebSocket proxy for /connect endpoints
 * @param {http.Server} server - HTTP server instance
 */
function setupWebSocketProxy(server) {
  // Create WebSocket proxy for /connect endpoints
  const wsProxy = createProxyMiddleware({
    target: config.services.mediasoup,
    ws: true, // Enable WebSocket proxying
    changeOrigin: true,
    pathRewrite: {},
    onError: (err, req, res) => {
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
  });

  // Handle WebSocket upgrade requests
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, `http://${request.headers.host}`)
      .pathname;

    if (pathname.startsWith('/connect')) {
      console.log(
        `[WS PROXY] Upgrading WebSocket connection: ${pathname} -> MediaSoup service`
      );
      wsProxy.upgrade(request, socket, head);
    } else {
      socket.destroy();
    }
  });
}

/**
 * Start the API Gateway server
 */
function startServer() {
  const app = createApp();

  // Setup routing
  setupServiceRouting(app);

  // Setup error handling (must be last)
  setupErrorHandlingMiddleware(app);

  // Start server
  const server = app.listen(config.server.port, () => {
    console.log('🚀 API Gateway started successfully');
    console.log(`📡 Port: ${config.server.port}`);
    console.log(`🌍 Environment: ${config.server.nodeEnv}`);
    console.log(`🔗 Frontend URL: ${config.server.frontendUrl}`);
    console.log('');
    console.log('📋 Service Configuration:');
    console.log(`   Auth Service: ${config.services.auth}`);
    console.log(`   Room Service: ${config.services.room}`);
    console.log(`   Signaling Service: ${config.services.signaling}`);
    console.log('');
    console.log('🛣️  Available Routes:');
    console.log('   /health - Health check');
    console.log('   /api/* - API routes (routed to appropriate service)');
    console.log('   /socket.io - WebSocket connections');
    console.log('   /uploads - File uploads');
    console.log('   /connect - WebSocket endpoints (with upgrade support)');
  });

  // Setup WebSocket proxy
  setupWebSocketProxy(server);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('✅ Process terminated');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    server.close(() => {
      console.log('✅ Process terminated');
      process.exit(0);
    });
  });

  return server;
}

// Start the server
startServer();

export default { createApp, setupServiceRouting, startServer };
