import dotenv from 'dotenv';

dotenv.config();

/**
 * API Gateway Configuration
 * Centralized configuration for all gateway settings
 */

export const config = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5174',
  },

  // Service URLs
  services: {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:5000',
    room: process.env.ROOM_SERVICE_URL || 'http://localhost:5001',
    mediasoup: process.env.MEDIASOUP_SERVICE_URL || 'http://localhost:3003',
  },

  // CORS Configuration
  cors: {
    origins: [
      process.env.FRONTEND_URL || 'http://localhost:5174',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'X-Total-Count',
      'X-Page-Count',
    ],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  },

  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // requests per window
    message: 'Too many requests from this IP, please try again later.',
  },

  // Request Limits
  requestLimits: {
    json: '50mb',
    urlEncoded: '50mb',
  },

  // Proxy Configuration
  proxy: {
    timeout: 30000, // 30 seconds
    proxyTimeout: 30000, // 30 seconds
    changeOrigin: true,
    secure: false,
  },

  // Health Check
  healthCheck: {
    status: 'healthy',
    services: ['auth', 'room', 'signaling'],
  },
};

export default config;
