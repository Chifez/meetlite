import { redisClient } from '../config/redis.js';

// Session configuration
const SESSION_CONFIG = {
  TTL: 3600 * 6, // 6 hours
  CLEANUP_INTERVAL: 300000, // 5 minutes
  MAX_SESSIONS_PER_USER: 5, // Maximum concurrent sessions per user
};

export class SessionManager {
  constructor() {
    this.isAvailable = false;
    this.cleanupInterval = null;
    this.checkAvailability();
    this.startCleanupInterval();
  }

  // Check if Redis is available
  async checkAvailability() {
    try {
      if (redisClient.isReady) {
        await redisClient.ping();
        this.isAvailable = true;
        console.log('✅ Session manager Redis connection established');
      } else {
        this.isAvailable = false;
        console.warn('⚠️ Session manager Redis not available');
      }
    } catch (error) {
      this.isAvailable = false;
      console.warn(
        '⚠️ Session manager Redis connection failed:',
        error.message
      );
    }
  }

  // Start cleanup interval
  startCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, SESSION_CONFIG.CLEANUP_INTERVAL);
  }

  // Stop cleanup interval
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Generate session key
  generateSessionKey(sessionId) {
    return `session:${sessionId}`;
  }

  // Generate user sessions key
  generateUserSessionsKey(userId) {
    return `user_sessions:${userId}`;
  }

  // Create new session
  async createSession(sessionId, userId, sessionData) {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const sessionKey = this.generateSessionKey(sessionId);
      const userSessionsKey = this.generateUserSessionsKey(userId);

      // Check if user has too many sessions
      const userSessions = await this.getUserSessions(userId);
      if (userSessions.length >= SESSION_CONFIG.MAX_SESSIONS_PER_USER) {
        // Remove oldest session
        const oldestSession = userSessions[0];
        await this.removeSession(oldestSession.sessionId);
      }

      // Create session data
      const session = {
        sessionId,
        userId,
        ...sessionData,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        expiresAt: Date.now() + SESSION_CONFIG.TTL * 1000,
      };

      // Store session
      await redisClient.setEx(
        sessionKey,
        SESSION_CONFIG.TTL,
        JSON.stringify(session)
      );

      // Add to user's session list
      await redisClient.sAdd(userSessionsKey, sessionId);
      await redisClient.expire(userSessionsKey, SESSION_CONFIG.TTL);

      console.log(`✅ Session created for user ${userId}: ${sessionId}`);
      return true;
    } catch (error) {
      console.error('❌ Error creating session:', error);
      return false;
    }
  }

  // Get session data
  async getSession(sessionId) {
    if (!this.isAvailable) {
      return null;
    }

    try {
      const sessionKey = this.generateSessionKey(sessionId);
      const sessionData = await redisClient.get(sessionKey);

      if (sessionData) {
        const session = JSON.parse(sessionData);

        // Update last activity
        session.lastActivity = Date.now();
        await redisClient.setEx(
          sessionKey,
          SESSION_CONFIG.TTL,
          JSON.stringify(session)
        );

        return session;
      }

      return null;
    } catch (error) {
      console.error('❌ Error getting session:', error);
      return null;
    }
  }

  // Update session data
  async updateSession(sessionId, updates) {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const sessionKey = this.generateSessionKey(sessionId);
      const sessionData = await redisClient.get(sessionKey);

      if (sessionData) {
        const session = JSON.parse(sessionData);
        const updatedSession = {
          ...session,
          ...updates,
          lastActivity: Date.now(),
        };

        await redisClient.setEx(
          sessionKey,
          SESSION_CONFIG.TTL,
          JSON.stringify(updatedSession)
        );
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Error updating session:', error);
      return false;
    }
  }

  // Remove session
  async removeSession(sessionId) {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const sessionKey = this.generateSessionKey(sessionId);
      const sessionData = await redisClient.get(sessionKey);

      if (sessionData) {
        const session = JSON.parse(sessionData);
        const userSessionsKey = this.generateUserSessionsKey(session.userId);

        // Remove session
        await redisClient.del(sessionKey);

        // Remove from user's session list
        await redisClient.sRem(userSessionsKey, sessionId);

        console.log(`✅ Session removed: ${sessionId}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Error removing session:', error);
      return false;
    }
  }

  // Get all sessions for a user
  async getUserSessions(userId) {
    if (!this.isAvailable) {
      return [];
    }

    try {
      const userSessionsKey = this.generateUserSessionsKey(userId);
      const sessionIds = await redisClient.sMembers(userSessionsKey);

      const sessions = [];
      for (const sessionId of sessionIds) {
        const session = await this.getSession(sessionId);
        if (session) {
          sessions.push(session);
        }
      }

      // Sort by creation time (oldest first)
      return sessions.sort((a, b) => a.createdAt - b.createdAt);
    } catch (error) {
      console.error('❌ Error getting user sessions:', error);
      return [];
    }
  }

  // Check if session exists and is valid
  async isValidSession(sessionId) {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      // Check if session is expired
      if (session.expiresAt < Date.now()) {
        await this.removeSession(sessionId);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Error validating session:', error);
      return false;
    }
  }

  // Extend session TTL
  async extendSession(sessionId) {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const sessionKey = this.generateSessionKey(sessionId);
      const sessionData = await redisClient.get(sessionKey);

      if (sessionData) {
        const session = JSON.parse(sessionData);
        session.expiresAt = Date.now() + SESSION_CONFIG.TTL * 1000;
        session.lastActivity = Date.now();

        await redisClient.setEx(
          sessionKey,
          SESSION_CONFIG.TTL,
          JSON.stringify(session)
        );
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Error extending session:', error);
      return false;
    }
  }

  // Cleanup expired sessions
  async cleanupExpiredSessions() {
    if (!this.isAvailable) {
      return;
    }

    try {
      const sessionKeys = await redisClient.keys('session:*');
      let cleanedCount = 0;

      for (const key of sessionKeys) {
        const sessionData = await redisClient.get(key);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (session.expiresAt < Date.now()) {
            await this.removeSession(session.sessionId);
            cleanedCount++;
          }
        }
      }

      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
      }
    } catch (error) {
      console.error('❌ Error during session cleanup:', error);
    }
  }

  // Get session statistics
  async getSessionStats() {
    if (!this.isAvailable) {
      return { available: false };
    }

    try {
      const sessionKeys = await redisClient.keys('session:*');
      const userSessionKeys = await redisClient.keys('user_sessions:*');

      const totalSessions = sessionKeys.length;
      const totalUsers = userSessionKeys.length;

      // Get active sessions (not expired)
      let activeSessions = 0;
      for (const key of sessionKeys) {
        const sessionData = await redisClient.get(key);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (session.expiresAt > Date.now()) {
            activeSessions++;
          }
        }
      }

      return {
        available: true,
        totalSessions,
        activeSessions,
        totalUsers,
        maxSessionsPerUser: SESSION_CONFIG.MAX_SESSIONS_PER_USER,
        sessionTTL: SESSION_CONFIG.TTL,
      };
    } catch (error) {
      console.error('❌ Error getting session stats:', error);
      return { available: true, error: error.message };
    }
  }

  // Invalidate all sessions for a user (logout from all devices)
  async invalidateUserSessions(userId) {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const userSessions = await this.getUserSessions(userId);

      for (const session of userSessions) {
        await this.removeSession(session.sessionId);
      }

      console.log(
        `✅ Invalidated ${userSessions.length} sessions for user ${userId}`
      );
      return true;
    } catch (error) {
      console.error('❌ Error invalidating user sessions:', error);
      return false;
    }
  }

  // Graceful shutdown
  async shutdown() {
    this.stopCleanupInterval();
    console.log('✅ Session manager shutdown completed');
  }
}
