import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Redis Client Configuration for MediaSoup Service
 *
 * This creates a connection to Redis server for:
 * - Socket.io Redis Adapter (syncing events across nodes)
 * - Distributed locking (preventing race conditions)
 */

class RedisClient {
  public client: Redis | null = null;
  public pubClient: Redis | null = null;
  public subClient: Redis | null = null;
  public isConnected = false;

  async connect(): Promise<Redis> {
    try {
      const options = {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 1,
        family: 4, // Force IPv4
        retryStrategy(times: number) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        ...(process.env.NODE_ENV === 'production' &&
          process.env.REDIS_TLS === 'true' && {
            tls: {
              rejectUnauthorized: true,
            },
          } as any),
      };

      // Create ioredis clients for different purposes
      this.client = new Redis(options);
      this.pubClient = new Redis(options);
      this.subClient = new Redis(options);

      // Handle connection events for the main client
      this.client.on('error', (err) => {
        console.error('Redis error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Redis connecting...');
      });

      this.client.on('ready', () => {
        console.log('✅ Redis connected and ready');
        this.isConnected = true;
      });

      this.client.on('close', () => {
        console.log('Redis connection closed');
        this.isConnected = false;
      });

      // ioredis connects automatically, wait for ready event
      await new Promise<void>((resolve, reject) => {
        if (this.client!.status === 'ready') {
          resolve();
        } else {
          this.client!.once('ready', resolve);
          this.client!.once('error', reject);
        }
      });

      return this.client;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  getClient(): Redis {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client not connected. Call connect() first.');
    }
    return this.client;
  }

  getPubSubClients(): { pubClient: Redis, subClient: Redis } {
    if (!this.pubClient || !this.subClient || !this.isConnected) {
      throw new Error('Redis clients not connected. Call connect() first.');
    }
    return { pubClient: this.pubClient, subClient: this.subClient };
  }

  async disconnect(): Promise<void> {
    if (this.client) await this.client.quit();
    if (this.pubClient) await this.pubClient.quit();
    if (this.subClient) await this.subClient.quit();
    this.isConnected = false;
  }

  isReady(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
const redisClient = new RedisClient();
export default redisClient;
