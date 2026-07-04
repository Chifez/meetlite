/**
 * Service Router
 * Handles routing logic for different backend services
 */

import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import config from '../config/index.js';

export interface ServiceConfig {
  name?: string;
  paths: string[];
  target: string;
  pathRewrite: Record<string, string>;
}

/**
 * Service routing configuration
 * Maps frontend API paths to backend services
 */
const SERVICE_ROUTES: Record<string, ServiceConfig> = {
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
      '/api/teams',
      '/api/admin',
      '/api/contact',
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
      '^/api/admin': '/api/v1/admin',
      '^/api/contact': '/api/v1/contact',
    },
  },

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
      '^/api/rooms': '/api/v1/rooms',
      '^/api/meetings': '/api/v1/meetings',
      '^/api/recordings': '/api/v1/recordings',
      '^/api/ai': '/api/v1/ai',
      '^/api/analytics': '/api/v1/analytics',
      '^/api/calendar': '/api/v1/calendar',
      '^/api/notifications': '/api/v1/notifications',
    },
  },

  mediasoup: {
    paths: ['/socket.io', '/connect'],
    target: config.services.mediasoup,
    pathRewrite: {},
  },
};

/**
 * Create proxy middleware for a service
 */
export function createServiceProxy(serviceConfig: ServiceConfig) {
  const isSSEStream = (url?: string) => url && url.includes('/stream');

  return createProxyMiddleware({
    target: serviceConfig.target,
    changeOrigin: config.proxy.changeOrigin,
    secure: config.proxy.secure,
    timeout: 7200000,
    proxyTimeout: 7200000,
    pathRewrite: serviceConfig.pathRewrite,
    parseReqBody: false,

    onProxyReq: (proxyReq: any, req: Request) => {
      if (isSSEStream(req.url)) {
        proxyReq.setHeader('Connection', 'keep-alive');
        proxyReq.setHeader('Cache-Control', 'no-cache');
      }
    },

    onProxyRes: (proxyRes: any, req: Request, res: Response) => {
      if (isSSEStream(req.url)) {
        res.setHeader('X-Accel-Buffering', 'no');
      }
    },

    onError: (err: any, req: Request, res: Response) => {
      console.error(`[PROXY ERROR] ${serviceConfig.target}:`, err.message);

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
  } as any);
}

/**
 * Get service configuration for a given path
 */
export function getServiceForPath(path: string): ServiceConfig | null {
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
 */
export function getAllServiceRoutes() {
  return SERVICE_ROUTES;
}

export default SERVICE_ROUTES;
