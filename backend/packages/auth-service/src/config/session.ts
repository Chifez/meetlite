import session from 'express-session';
import { RedisStore } from 'connect-redis';
import redisClient from './redis.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Session Store Configuration
 */

/**
 * Create session middleware with Redis store
 */
export async function createSessionStore() {
  try {
    const client = redisClient.getClient();

    const store = new RedisStore({
      client: client,
      prefix: 'meetlite:sess:',
      ttl: parseInt(process.env.SESSION_MAX_AGE || '') || 86400000 / 1000,
    });

    const sessionConfig: any = {
      store: store,
      secret: process.env.SESSION_SECRET || 'secret',
      name: process.env.SESSION_NAME || 'sid',
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: parseInt(process.env.SESSION_MAX_AGE || '') || 86400000,
        sameSite: 'lax',
      },
    };

    return session(sessionConfig);
  } catch (error) {
    console.error('Failed to create session store:', error);

    return session({
      secret: process.env.SESSION_SECRET || 'secret',
      name: process.env.SESSION_NAME || 'sid',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: parseInt(process.env.SESSION_MAX_AGE || '') || 86400000,
      },
    });
  }
}

/**
 * Session utility functions
 */
export const sessionUtils = {
  getUserId(req: any) {
    return req.session?.userId || null;
  },

  setUser(req: any, user: any) {
    if (req.session) {
      req.session.userId = user._id || user.id;
      req.session.userEmail = user.email;
      req.session.userName = user.name;
    }
  },

  clearUser(req: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (req.session) {
        req.session.destroy((err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  },

  isAuthenticated(req: any) {
    return !!req.session?.userId;
  },
};
