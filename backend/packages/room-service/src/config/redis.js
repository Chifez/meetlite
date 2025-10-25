import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Redis Client Configuration for Room Service
 *
 * This creates a connection to Redis server for:
 * - Session storage (instead of memory)
 * - Caching frequently accessed data (meetings, rooms, user data)
 * - Pub/Sub for real-time features
 * - AI service caching (meeting summaries, smart scheduling)
 * - Calendar service caching (OAuth tokens, calendar data)
 */

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      // Create Redis client (Redis v4+ style)
      this.client = createClient({
        url: `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${
          process.env.REDIS_PORT || 6379
        }`,
        password: process.env.REDIS_PASSWORD || undefined,
        database: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0,
        socket: {
          family: 4, // force IPv4
        },
      });

      // Handle connection events
      this.client.on('error', (err) => {
        console.error('Redis error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        // Connecting
      });

      this.client.on('ready', () => {
        this.isConnected = true;
      });

      this.client.on('end', () => {
        this.isConnected = false;
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  getClient() {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client not connected. Call connect() first.');
    }
    return this.client;
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  isReady() {
    return this.isConnected;
  }
}

// Export singleton instance
const redisClient = new RedisClient();
export default redisClient;
