/**
 * Service Router
 * Handles routing logic for different backend services
 */

import { createProxyMiddleware } from 'http-proxy-middleware';
import config from '../config/index.js';

/**
 * Service routing configuration
 * Maps frontend API paths to backend services
 */
const SERVICE_ROUTES = {
  // Auth Service Routes (uses /api/v1/ prefix)
  auth: {
    paths: [
      '/api/auth',
      '/api/organizations',
      '/api/invitations',
      '/api/workspace',
      '/api/plan',
      '/api/plans',
      '/api/multi-org',
      '/api/bulk',
      '/api/push-notifications',
      '/api/payment',
      '/api/teams', // Team invitation routes (user-scoped)
    ],
    target: config.services.auth,
    pathRewrite: {
      '^/api/auth': '/api/v1/auth',
      '^/api/organizations': '/api/v1/organizations',
      '^/api/invitations': '/api/v1/invitations',
      '^/api/workspace': '/api/v1/workspace',
      '^/api/plan': '/api/v1/plan',
      '^/api/plans': '/api/v1/plan',
      '^/api/multi-org': '/api/v1/multi-org',
      '^/api/bulk': '/api/v1/bulk',
      '^/api/push-notifications': '/api/v1/push-notifications',
      '^/api/payment': '/api/v1/payment',
      '^/api/teams': '/api/v1/teams',
    },
  },

  // Room Service Routes (all routes use /api/* and rewrite to /api/v1/*)
  room: {
    paths: [
      '/api/rooms',
      '/api/meetings',
      '/api/recordings',
      '/api/ai',
      '/api/analytics',
      '/api/calendar',
      '/api/notifications',
    ],
    target: config.services.room,
    pathRewrite: {
      // Non-versioned routes - rewrite to versioned
      '^/api/rooms': '/api/v1/rooms',
      '^/api/meetings': '/api/v1/meetings',
      '^/api/recordings': '/api/v1/recordings',
      '^/api/ai': '/api/v1/ai',
      '^/api/analytics': '/api/v1/analytics',
      '^/api/calendar': '/api/v1/calendar',
      '^/api/notifications': '/api/v1/notifications',
    },
  },

  // MediaSoup Service Routes (WebSocket and Tldraw)
  // NOTE: /uploads is NOT proxied - files served directly from MediaSoup:3003
  mediasoup: {
    paths: ['/socket.io', '/connect'],
    target: config.services.mediasoup,
    pathRewrite: {},
  },
};

/**
 * Create proxy middleware for a service
 * @param {Object} serviceConfig - Service configuration
 * @returns {Function} Express middleware
 */
export function createServiceProxy(serviceConfig) {
  // Check if this is an SSE stream endpoint
  const isSSEStream = (url) => url && url.includes('/stream');

  return createProxyMiddleware({
    target: serviceConfig.target,
    changeOrigin: config.proxy.changeOrigin,
    secure: config.proxy.secure,
    // Conditional timeout: disable only for SSE streams, use default for others
    // This prevents DoS attacks while allowing SSE connections to stay open
    timeout: (req) => {
      return isSSEStream(req.url) ? 0 : config.proxy.timeout;
    },
    proxyTimeout: (req) => {
      return isSSEStream(req.url) ? 0 : config.proxy.proxyTimeout;
    },
    pathRewrite: serviceConfig.pathRewrite,
    // Industry standard: Don't parse request body in proxy
    parseReqBody: false,
    reqAsBuffer: true,
    // Conditional buffering: disable only for SSE streams
    buffer: (req) => !isSSEStream(req.url),

    // Handle SSE streams properly
    onProxyReq: (proxyReq, req, res) => {
      // For SSE, ensure connection stays open
      if (isSSEStream(req.url)) {
        proxyReq.setHeader('Connection', 'keep-alive');
        proxyReq.setHeader('Cache-Control', 'no-cache');
      }
    },

    onProxyRes: (proxyRes, req, res) => {
      // For SSE, ensure headers are passed through correctly
      if (isSSEStream(req.url)) {
        // Don't modify SSE response headers - let them pass through
        // Ensure X-Accel-Buffering is set to prevent nginx buffering
        res.setHeader('X-Accel-Buffering', 'no');
      }
    },

    // Error handling
    onError: (err, req, res) => {
      console.error(`[PROXY ERROR] ${serviceConfig.target}:`, err.message);

      // Don't send response if headers already sent
      if (res.headersSent) {
        return;
      }

      res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable',
        error:
          config.server.nodeEnv === 'development' ? err.message : undefined,
        timestamp: new Date().toISOString(),
      });
    },
  });
}

/**
 * Get service configuration for a given path
 * @param {string} path - Request path
 * @returns {Object|null} Service configuration or null if not found
 */
export function getServiceForPath(path) {
  for (const [serviceName, serviceConfig] of Object.entries(SERVICE_ROUTES)) {
    for (const servicePath of serviceConfig.paths) {
      if (path.startsWith(servicePath)) {
        return { name: serviceName, ...serviceConfig };
      }
    }
  }
  return null;
}

/**
 * Get all service routes for debugging
 * @returns {Object} All service routes
 */
export function getAllServiceRoutes() {
  return SERVICE_ROUTES;
}

export default SERVICE_ROUTES;
