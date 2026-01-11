import session from 'express-session';
import { RedisStore } from 'connect-redis';
import redisClient from './redis.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Session Store Configuration
 *
 * This configures Express sessions to use Redis instead of memory:
 * - Sessions persist across server restarts
 * - Sessions can be shared between multiple server instances
 * - Better performance for high-traffic applications
 */

/**
 * Create session middleware with Redis store
 * @returns {Function} Express session middleware
 */
export async function createSessionStore() {
  try {
    // Ensure Redis is connected
    const client = redisClient.getClient();

    // Create Redis store instance
    const store = new RedisStore({
      client: client,
      prefix: 'meetlite:sess:', // Namespace for session keys
      ttl: parseInt(process.env.SESSION_MAX_AGE) || 86400000 / 1000, // TTL in seconds
    });

    // Session configuration
    const sessionConfig = {
      store: store,
      secret: process.env.SESSION_SECRET,
      name: process.env.SESSION_NAME,
      resave: false, // Don't save session if unmodified
      saveUninitialized: false, // Don't create session until something stored
      rolling: true, // Reset expiry on each request
      cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true, // Prevent XSS attacks
        maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000, // 24 hours
        sameSite: 'lax', // CSRF protection
      },
    };

    return session(sessionConfig);
  } catch (error) {
    console.error('Failed to create session store:', error);

    // Fallback to memory store (for development only)
    return session({
      secret: process.env.SESSION_SECRET,
      name: process.env.SESSION_NAME,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000,
      },
    });
  }
}

/**
 * Session utility functions
 */
export const sessionUtils = {
  /**
   * Get user ID from session
   * @param {Object} req - Express request object
   * @returns {string|null} User ID or null
   */
  getUserId(req) {
    return req.session?.userId || null;
  },

  /**
   * Set user in session
   * @param {Object} req - Express request object
   * @param {Object} user - User object
   */
  setUser(req, user) {
    req.session.userId = user._id || user.id;
    req.session.userEmail = user.email;
    req.session.userName = user.name;
  },

  /**
   * Clear user session
   * @param {Object} req - Express request object
   * @returns {Promise}
   */
  clearUser(req) {
    return new Promise((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  },

  /**
   * Check if user is authenticated
   * @param {Object} req - Express request object
   * @returns {boolean}
   */
  isAuthenticated(req) {
    return !!req.session?.userId;
  },
};
