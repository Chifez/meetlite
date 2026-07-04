/**
 * Redis Client for Auth Service
 */

import { createClient, RedisClientType } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

class RedisClient {
  private client: RedisClientType | null;
  private isConnected: boolean;

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
      }) as RedisClientType;

      // Handle connection events
      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {});

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

const redisClient = new RedisClient();
export default redisClient;
