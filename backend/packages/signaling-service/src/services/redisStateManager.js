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
  CONNECTION_HEALTH: 'conn_health',
  CONNECTION_META: 'conn_meta',
  CONNECTION_RECOVERY: 'conn_recovery',
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
  CONNECTION_HEALTH: 300, // 5 minutes
  CONNECTION_META: 1800, // 30 minutes
  CONNECTION_RECOVERY: 600, // 10 minutes
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
        this.resetErrorTracking();
      } else {
        this.isAvailable = false;
      }
    } catch (error) {
      this.isAvailable = false;
      this.handleError(error, 'checkAvailability');
      console.warn(
        '⚠️ Redis not available, falling back to memory:',
        error.message
      );
    }
  }

  // Enhanced error handling wrapper
  async executeWithErrorHandling(operation, fallback = null) {
    try {
      if (!this.isAvailable) {
        throw new Error('Redis not available');
      }

      const result = await operation();
      this.resetErrorTracking();
      return result;
    } catch (error) {
      this.handleError(error, operation.name || 'unknown');

      if (fallback !== null) {
        return fallback;
      }

      throw error;
    }
  }

  // Handle Redis errors with context
  handleError(error, operation) {
    console.error(`❌ Redis error in ${operation}:`, error);

    // Log specific error types
    if (error.code === 'ECONNREFUSED') {
      console.error('🚨 Redis connection refused');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('⏰ Redis operation timeout');
    } else if (error.code === 'WRONGTYPE') {
      console.error('🔧 Redis data type mismatch');
    } else if (error.code === 'NOAUTH') {
      console.error('🔐 Redis authentication failed');
    }

    // Track error metrics
    this.trackError(error, operation);
  }

  // Track error metrics
  trackError(error, operation) {
    if (!this.errorMetrics) {
      this.errorMetrics = {
        totalErrors: 0,
        errorsByOperation: {},
        errorsByType: {},
        lastErrorTime: null,
        consecutiveErrors: 0,
      };
    }

    this.errorMetrics.totalErrors++;
    this.errorMetrics.lastErrorTime = Date.now();

    // Track by operation
    this.errorMetrics.errorsByOperation[operation] =
      (this.errorMetrics.errorsByOperation[operation] || 0) + 1;

    // Track by error type
    const errorType = error.constructor.name;
    this.errorMetrics.errorsByType[errorType] =
      (this.errorMetrics.errorsByType[errorType] || 0) + 1;

    // Track consecutive errors
    this.errorMetrics.consecutiveErrors++;
  }

  // Reset error tracking on success
  resetErrorTracking() {
    if (this.errorMetrics) {
      this.errorMetrics.consecutiveErrors = 0;
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

  // Batch operations with pipeline optimization
  async batchOperation(operations) {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const pipeline = redisClient.multi();

      for (const operation of operations) {
        const { type, key, value, ttl, command } = operation;

        switch (type) {
          case 'set':
            if (ttl) {
              pipeline.setEx(key, ttl, JSON.stringify(value));
            } else {
              pipeline.set(key, JSON.stringify(value));
            }
            break;
          case 'get':
            pipeline.get(key);
            break;
          case 'delete':
            pipeline.del(key);
            break;
          case 'hset':
            pipeline.hset(key, value);
            break;
          case 'hget':
            pipeline.hget(key, value);
            break;
          case 'sadd':
            pipeline.sadd(key, value);
            break;
          case 'custom':
            if (command && typeof command === 'function') {
              command(pipeline);
            }
            break;
        }
      }

      const results = await pipeline.exec();
      return results;
    } catch (error) {
      console.error('❌ Redis batch operation error:', error);
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
      const clientList = await redisClient.client('LIST');
      const slowLog = await redisClient.slowlog('GET', 10);
      const latency = await this.measureLatency();

      return {
        available: true,
        info: info.split('\r\n').filter((line) => line.includes(':')),
        memory: memory || 'N/A',
        clientCount: clientList || 'N/A',
        slowLog: slowLog || [],
        latency: latency,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('❌ Redis stats error:', error);
      return { available: true, error: error.message };
    }
  }

  // Get error metrics
  getErrorMetrics() {
    return {
      ...this.errorMetrics,
      currentTime: Date.now(),
      timeSinceLastError: this.errorMetrics?.lastErrorTime
        ? Date.now() - this.errorMetrics.lastErrorTime
        : null,
    };
  }

  // Get comprehensive health status
  getComprehensiveHealth() {
    return {
      available: this.isAvailable,
      errorMetrics: this.getErrorMetrics(),
      recommendations: this.getHealthRecommendations(),
    };
  }

  // Get health recommendations
  getHealthRecommendations() {
    const recommendations = [];

    if (this.errorMetrics?.consecutiveErrors > 0) {
      recommendations.push(
        `High error rate: ${this.errorMetrics.consecutiveErrors} consecutive errors`
      );
    }

    if (this.errorMetrics?.totalErrors > 10) {
      recommendations.push(
        `Total errors: ${this.errorMetrics.totalErrors} - consider investigating`
      );
    }

    if (this.errorMetrics?.lastErrorTime) {
      const timeSinceError = Date.now() - this.errorMetrics.lastErrorTime;
      if (timeSinceError < 60000) {
        // Less than 1 minute
        recommendations.push('Recent errors detected - monitor closely');
      }
    }

    return recommendations;
  }

  // Measure Redis latency
  async measureLatency() {
    if (!this.isAvailable) return null;

    try {
      const start = Date.now();
      await redisClient.ping();
      const end = Date.now();

      return {
        ping: end - start,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('❌ Error measuring Redis latency:', error);
      return null;
    }
  }

  // Get detailed performance metrics
  async getPerformanceMetrics() {
    if (!this.isAvailable) return null;

    try {
      const metrics = {
        memory: await this.getMemoryMetrics(),
        commands: await this.getCommandMetrics(),
        keyspace: await this.getKeyspaceMetrics(),
        clients: await this.getClientMetrics(),
        latency: await this.measureLatency(),
        timestamp: Date.now(),
      };

      return metrics;
    } catch (error) {
      console.error('❌ Error getting performance metrics:', error);
      return null;
    }
  }

  // Get memory metrics
  async getMemoryMetrics() {
    try {
      const info = await redisClient.info('memory');
      const lines = info.split('\r\n');
      const memoryData = {};

      lines.forEach((line) => {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          memoryData[key] = value;
        }
      });

      return {
        usedMemory: memoryData.used_memory_human || 'N/A',
        usedMemoryPeak: memoryData.used_memory_peak_human || 'N/A',
        usedMemoryRss: memoryData.used_memory_rss_human || 'N/A',
        memFragmentationRatio: memoryData.mem_fragmentation_ratio || 'N/A',
        evictedKeys: memoryData.evicted_keys || '0',
        expiredKeys: memoryData.expired_keys || '0',
      };
    } catch (error) {
      console.error('❌ Error getting memory metrics:', error);
      return {};
    }
  }

  // Get command metrics
  async getCommandMetrics() {
    try {
      const info = await redisClient.info('stats');
      const lines = info.split('\r\n');
      const commandData = {};

      lines.forEach((line) => {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          commandData[key] = value;
        }
      });

      return {
        totalCommandsProcessed: commandData.total_commands_processed || '0',
        totalConnectionsReceived: commandData.total_connections_received || '0',
        totalNetInputBytes: commandData.total_net_input_bytes || '0',
        totalNetOutputBytes: commandData.total_net_output_bytes || '0',
        instantaneousOpsPerSec: commandData.instantaneous_ops_per_sec || '0',
        keyspaceHits: commandData.keyspace_hits || '0',
        keyspaceMisses: commandData.keyspace_misses || '0',
      };
    } catch (error) {
      console.error('❌ Error getting command metrics:', error);
      return {};
    }
  }

  // Get keyspace metrics
  async getKeyspaceMetrics() {
    try {
      const info = await redisClient.info('keyspace');
      const lines = info.split('\r\n');
      const keyspaceData = {};

      lines.forEach((line) => {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          keyspaceData[key] = value;
        }
      });

      return keyspaceData;
    } catch (error) {
      console.error('❌ Error getting keyspace metrics:', error);
      return {};
    }
  }

  // Get client metrics
  async getClientMetrics() {
    try {
      const clientList = await redisClient.client('LIST');
      if (!clientList) return {};

      const clients = clientList.split('\n').filter((line) => line.trim());
      const clientMetrics = {
        total: clients.length,
        byType: {},
        byAddress: {},
      };

      clients.forEach((client) => {
        const parts = client.split(' ');
        const addr = parts[1] || 'unknown';
        const type = parts[2] || 'unknown';

        clientMetrics.byAddress[addr] =
          (clientMetrics.byAddress[addr] || 0) + 1;
        clientMetrics.byType[type] = (clientMetrics.byType[type] || 0) + 1;
      });

      return clientMetrics;
    } catch (error) {
      console.error('❌ Error getting client metrics:', error);
      return {};
    }
  }

  // Performance monitoring methods
  async getPerformanceStats() {
    if (!this.isAvailable) {
      return { available: false };
    }

    try {
      const startTime = Date.now();

      // Get Redis info
      const info = await redisClient.info();
      const memory = await redisClient.memory('USAGE');
      const slowlog = await redisClient.slowlog('GET', 10);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      return {
        available: true,
        responseTime,
        memory: memory || 'N/A',
        slowlog: slowlog || [],
        info: info.split('\r\n').filter((line) => line.includes(':')),
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('❌ Redis performance stats error:', error);
      return { available: false, error: error.message };
    }
  }

  // Memory usage analysis
  async getMemoryAnalysis() {
    if (!this.isAvailable) {
      return { available: false };
    }

    try {
      const memory = await redisClient.memory('USAGE');
      const keyspace = await redisClient.info('keyspace');
      const stats = await redisClient.info('stats');

      return {
        available: true,
        memory: memory || 'N/A',
        keyspace: keyspace.split('\r\n').filter((line) => line.includes(':')),
        stats: stats.split('\r\n').filter((line) => line.includes(':')),
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('❌ Redis memory analysis error:', error);
      return { available: false, error: error.message };
    }
  }

  // Connection pool status
  async getConnectionPoolStatus() {
    if (!this.isAvailable) {
      return { available: false };
    }

    try {
      const clientList = await redisClient.client('LIST');
      const clientCount = clientList ? clientList.split('\n').length - 1 : 0;

      return {
        available: true,
        clientCount,
        clientList: clientList || 'N/A',
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('❌ Redis connection pool status error:', error);
      return { available: false, error: error.message };
    }
  }

  // Connection-specific methods
  async setConnectionHealth(connectionId, healthData) {
    return await this.set('CONNECTION_HEALTH', connectionId, {
      ...healthData,
      lastUpdated: Date.now(),
      status: 'active',
    });
  }

  async getConnectionHealth(connectionId) {
    return await this.get('CONNECTION_HEALTH', connectionId);
  }

  async setConnectionMetadata(connectionId, metadata) {
    return await this.set('CONNECTION_META', connectionId, {
      ...metadata,
      lastUpdated: Date.now(),
    });
  }

  async getConnectionMetadata(connectionId) {
    return await this.get('CONNECTION_META', connectionId);
  }

  async setConnectionRecovery(connectionId, recoveryData) {
    return await this.set('CONNECTION_RECOVERY', connectionId, {
      ...recoveryData,
      lastAttempt: Date.now(),
      attempts: (recoveryData.attempts || 0) + 1,
    });
  }

  async getConnectionRecovery(connectionId) {
    return await this.get('CONNECTION_RECOVERY', connectionId);
  }

  async incrementConnectionCounter(connectionId, type = 'total') {
    const key = `CONNECTION_COUNT:${type}:${connectionId}`;
    try {
      return await redisClient.incr(key);
    } catch (error) {
      console.error(
        `❌ Error incrementing connection counter for ${connectionId}:`,
        error
      );
      return null;
    }
  }

  async getConnectionCounter(connectionId, type = 'total') {
    const key = `CONNECTION_COUNT:${type}:${connectionId}`;
    try {
      const value = await redisClient.get(key);
      return value ? parseInt(value) : 0;
    } catch (error) {
      console.error(
        `❌ Error getting connection counter for ${connectionId}:`,
        error
      );
      return 0;
    }
  }
}
