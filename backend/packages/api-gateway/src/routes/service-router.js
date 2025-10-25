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
    },
  },

  // Room Service Routes (uses /api/ prefix)
  room: {
    paths: [
      '/api/rooms',
      '/api/meetings',
      '/api/recordings',
      '/api/ai',
      '/api/analytics',
      '/api/calendar',
    ],
    target: config.services.room,
    pathRewrite: {
      '^/api/rooms': '/api/rooms',
      '^/api/meetings': '/api/meetings',
      '^/api/recordings': '/api/recordings',
      '^/api/ai': '/api/ai',
      '^/api/analytics': '/api/analytics',
      '^/api/calendar': '/api/calendar',
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
  return createProxyMiddleware({
    target: serviceConfig.target,
    changeOrigin: config.proxy.changeOrigin,
    secure: config.proxy.secure,
    timeout: config.proxy.timeout,
    proxyTimeout: config.proxy.proxyTimeout,
    pathRewrite: serviceConfig.pathRewrite,
    // Industry standard: Don't parse request body in proxy
    parseReqBody: false,
    reqAsBuffer: true,

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

    // Request logging (disabled for performance)
    // onProxyReq: (proxyReq, req, res) => {},

    // Response logging (disabled for performance)
    // onProxyRes: (proxyRes, req, res) => {},
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
