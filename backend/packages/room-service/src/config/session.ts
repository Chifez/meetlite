// @ts-ignore
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import redisClient from './redis.js';
import dotenv from 'dotenv';
import { Request } from 'express';

dotenv.config();

/**
 * Session Store Configuration for Room Service
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
      prefix: 'meetlite:room:sess:', // Namespace for room service sessions
      ttl: parseInt(process.env.SESSION_MAX_AGE || '86400000', 10) / 1000, // TTL in seconds
    });

    // Session configuration
    const sessionConfig: session.SessionOptions = {
      store: store,
      secret: process.env.SESSION_SECRET || 'secret',
      name: process.env.SESSION_NAME || 'sid',
      resave: false, // Don't save session if unmodified
      saveUninitialized: false, // Don't create session until something stored
      rolling: true, // Reset expiry on each request
      cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true, // Prevent XSS attacks
        maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000', 10), // 24 hours
        sameSite: 'lax', // CSRF protection
      },
    };

    return session(sessionConfig);
  } catch (error) {
    console.error('Failed to create session store:', error);

    // Fallback to memory store (for development only)
    return session({
      secret: process.env.SESSION_SECRET || 'secret',
      name: process.env.SESSION_NAME || 'sid',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000', 10),
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
   * @param {Request} req - Express request object
   * @returns {string|null} User ID or null
   */
  getUserId(req: Request) {
    return (req as any).session?.userId || null;
  },

  /**
   * Set user in session
   * @param {Request} req - Express request object
   * @param {Object} user - User object
   */
  setUser(req: Request, user: any) {
    const session = (req as any).session;
    if (session) {
      session.userId = user._id || user.id;
      session.userEmail = user.email;
      session.userName = user.name;
    }
  },

  /**
   * Clear user session
   * @param {Request} req - Express request object
   * @returns {Promise}
   */
  clearUser(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      const session = (req as any).session;
      if (!session) {
        resolve();
        return;
      }
      session.destroy((err: any) => {
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
   * @param {Request} req - Express request object
   * @returns {boolean}
   */
  isAuthenticated(req: Request) {
    return !!(req as any).session?.userId;
  },
};
