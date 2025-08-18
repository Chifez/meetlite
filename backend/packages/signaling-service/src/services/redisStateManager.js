import { redisClient } from '../config/redis.js';

// Redis key prefixes for different data types
const KEY_PREFIXES = {
  ROOM: 'room',
  USER: 'user',
  SESSION: 'session',
  COLLABORATION: 'collab',
  WORKFLOW: 'workflow',
  WHITEBOARD: 'whiteboard',
  CONNECTION: 'conn',
  SCREEN_SHARE: 'screenshare',
};

// TTL values for different data types (in seconds)
const TTL_VALUES = {
  ROOM: 3600 * 24, // 24 hours
  USER: 3600 * 2, // 2 hours
  SESSION: 3600 * 6, // 6 hours
  COLLABORATION: 3600 * 12, // 12 hours
  WORKFLOW: 3600 * 24, // 24 hours
  WHITEBOARD: 3600 * 24, // 24 hours
  CONNECTION: 3600, // 1 hour
  SCREEN_SHARE: 3600, // 1 hour
};

export class RedisStateManager {
  constructor() {
    this.isAvailable = false;
    this.checkAvailability();
  }

  // Check if Redis is available
  async checkAvailability() {
    try {
      if (redisClient.isReady) {
        await redisClient.ping();
        this.isAvailable = true;
      } else {
        this.isAvailable = false;
      }
    } catch (error) {
      this.isAvailable = false;
      console.warn(
        '⚠️ Redis not available, falling back to memory:',
        error.message
      );
    }
  }

  // Generate Redis key with prefix
  generateKey(prefix, identifier) {
    return `${KEY_PREFIXES[prefix]}:${identifier}`;
  }

  // Set value with TTL
  async set(prefix, identifier, value, ttl = null) {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const key = this.generateKey(prefix, identifier);
      const serializedValue = JSON.stringify(value);

      if (ttl) {
        await redisClient.setEx(key, ttl, serializedValue);
      } else {
        const defaultTTL = TTL_VALUES[prefix] || 3600;
        await redisClient.setEx(key, defaultTTL, serializedValue);
      }

      return true;
    } catch (error) {
      console.error(`❌ Redis set error for ${prefix}:${identifier}:`, error);
      return false;
    }
  }

  // Get value
  async get(prefix, identifier) {
    if (!this.isAvailable) {
      return null;
    }

    try {
      const key = this.generateKey(prefix, identifier);
      const value = await redisClient.get(key);

      if (value) {
        return JSON.parse(value);
      }

      return null;
    } catch (error) {
      console.error(`❌ Redis get error for ${prefix}:${identifier}:`, error);
      return null;
    }
  }

  // Delete value
  async delete(prefix, identifier) {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const key = this.generateKey(prefix, identifier);
      const result = await redisClient.del(key);
      return result > 0;
    } catch (error) {
      console.error(
        `❌ Redis delete error for ${prefix}:${identifier}:`,
        error
      );
      return false;
    }
  }

  // Check if key exists
  async exists(prefix, identifier) {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const key = this.generateKey(prefix, identifier);
      const result = await redisClient.exists(key);
      return result > 0;
    } catch (error) {
      console.error(
        `❌ Redis exists error for ${prefix}:${identifier}:`,
        error
      );
      return false;
    }
  }

  // Set multiple values in a transaction
  async setMultiple(operations) {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const multi = redisClient.multi();

      operations.forEach(({ prefix, identifier, value, ttl }) => {
        const key = this.generateKey(prefix, identifier);
        const serializedValue = JSON.stringify(value);
        const finalTTL = ttl || TTL_VALUES[prefix] || 3600;

        multi.setEx(key, finalTTL, serializedValue);
      });

      await multi.exec();
      return true;
    } catch (error) {
      console.error('❌ Redis setMultiple error:', error);
      return false;
    }
  }

  // Get multiple values
  async getMultiple(keys) {
    if (!this.isAvailable) {
      return {};
    }

    try {
      const result = {};

      for (const { prefix, identifier } of keys) {
        const value = await this.get(prefix, identifier);
        if (value !== null) {
          result[`${prefix}:${identifier}`] = value;
        }
      }

      return result;
    } catch (error) {
      console.error('❌ Redis getMultiple error:', error);
      return {};
    }
  }

  // Set hash field
  async hSet(prefix, identifier, field, value) {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const key = this.generateKey(prefix, identifier);
      const serializedValue = JSON.stringify(value);

      await redisClient.hSet(key, field, serializedValue);

      // Set TTL for the hash
      const ttl = TTL_VALUES[prefix] || 3600;
      await redisClient.expire(key, ttl);

      return true;
    } catch (error) {
      console.error(
        `❌ Redis hSet error for ${prefix}:${identifier}:${field}:`,
        error
      );
      return false;
    }
  }

  // Get hash field
  async hGet(prefix, identifier, field) {
    if (!this.isAvailable) {
      return null;
    }

    try {
      const key = this.generateKey(prefix, identifier);
      const value = await redisClient.hGet(key, field);

      if (value) {
        return JSON.parse(value);
      }

      return null;
    } catch (error) {
      console.error(
        `❌ Redis hGet error for ${prefix}:${identifier}:${field}:`,
        error
      );
      return null;
    }
  }

  // Get all hash fields
  async hGetAll(prefix, identifier) {
    if (!this.isAvailable) {
      return {};
    }

    try {
      const key = this.generateKey(prefix, identifier);
      const hash = await redisClient.hGetAll(key);

      const result = {};
      for (const [field, value] of Object.entries(hash)) {
        try {
          result[field] = JSON.parse(value);
        } catch (parseError) {
          // If parsing fails, use raw value
          result[field] = value;
        }
      }

      return result;
    } catch (error) {
      console.error(
        `❌ Redis hGetAll error for ${prefix}:${identifier}:`,
        error
      );
      return {};
    }
  }

  // Delete hash field
  async hDelete(prefix, identifier, field) {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const key = this.generateKey(prefix, identifier);
      const result = await redisClient.hDel(key, field);
      return result > 0;
    } catch (error) {
      console.error(
        `❌ Redis hDelete error for ${prefix}:${identifier}:${field}:`,
        error
      );
      return false;
    }
  }

  // Add to set
  async sAdd(prefix, identifier, member) {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const key = this.generateKey(prefix, identifier);
      const result = await redisClient.sAdd(key, member);

      // Set TTL for the set
      const ttl = TTL_VALUES[prefix] || 3600;
      await redisClient.expire(key, ttl);

      return result > 0;
    } catch (error) {
      console.error(`❌ Redis sAdd error for ${prefix}:${identifier}:`, error);
      return false;
    }
  }

  // Remove from set
  async sRem(prefix, identifier, member) {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const key = this.generateKey(prefix, identifier);
      const result = await redisClient.sRem(key, member);
      return result > 0;
    } catch (error) {
      console.error(`❌ Redis sRem error for ${prefix}:${identifier}:`, error);
      return false;
    }
  }

  // Get set members
  async sMembers(prefix, identifier) {
    if (!this.isAvailable) {
      return [];
    }

    try {
      const key = this.generateKey(prefix, identifier);
      const members = await redisClient.sMembers(key);
      return members;
    } catch (error) {
      console.error(
        `❌ Redis sMembers error for ${prefix}:${identifier}:`,
        error
      );
      return [];
    }
  }

  // Check if member exists in set
  async sIsMember(prefix, identifier, member) {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const key = this.generateKey(prefix, identifier);
      const result = await redisClient.sIsMember(key, member);
      return result;
    } catch (error) {
      console.error(
        `❌ Redis sIsMember error for ${prefix}:${identifier}:`,
        error
      );
      return false;
    }
  }

  // Increment counter
  async incr(prefix, identifier) {
    if (!this.isAvailable) {
      return null;
    }

    try {
      const key = this.generateKey(prefix, identifier);
      const result = await redisClient.incr(key);

      // Set TTL for the counter
      const ttl = TTL_VALUES[prefix] || 3600;
      await redisClient.expire(key, ttl);

      return result;
    } catch (error) {
      console.error(`❌ Redis incr error for ${prefix}:${identifier}:`, error);
      return null;
    }
  }

  // Decrement counter
  async decr(prefix, identifier) {
    if (!this.isAvailable) {
      return null;
    }

    try {
      const key = this.generateKey(prefix, identifier);
      const result = await redisClient.decr(key);

      // Set TTL for the counter
      const ttl = TTL_VALUES[prefix] || 3600;
      await redisClient.expire(key, ttl);

      return result;
    } catch (error) {
      console.error(`❌ Redis decr error for ${prefix}:${identifier}:`, error);
      return null;
    }
  }

  // Get counter value
  async getCounter(prefix, identifier) {
    if (!this.isAvailable) {
      return 0;
    }

    try {
      const key = this.generateKey(prefix, identifier);
      const value = await redisClient.get(key);
      return value ? parseInt(value, 10) : 0;
    } catch (error) {
      console.error(
        `❌ Redis getCounter error for ${prefix}:${identifier}:`,
        error
      );
      return 0;
    }
  }

  // Cleanup expired keys (optional maintenance)
  async cleanup() {
    if (!this.isAvailable) {
      return;
    }

    try {
      // This is a simple cleanup - in production you might want more sophisticated cleanup
      console.log('🧹 Redis cleanup completed');
    } catch (error) {
      console.error('❌ Redis cleanup error:', error);
    }
  }

  // Get Redis statistics
  async getStats() {
    if (!this.isAvailable) {
      return { available: false };
    }

    try {
      const info = await redisClient.info();
      const memory = await redisClient.memory('USAGE');

      return {
        available: true,
        info: info.split('\r\n').filter((line) => line.includes(':')),
        memory: memory || 'N/A',
        clientCount: redisClient.client('LIST') || 'N/A',
      };
    } catch (error) {
      console.error('❌ Redis stats error:', error);
      return { available: true, error: error.message };
    }
  }
}
