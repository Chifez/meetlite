// import { createClient } from 'redis';
// import dotenv from 'dotenv';

// dotenv.config();

// /**
//  * Redis Client Configuration
//  *
//  * This creates a connection to Redis server for:
//  * - Session storage (instead of memory)
//  * - Caching frequently accessed data
//  * - Pub/Sub for real-time features
//  */

// class RedisClient {
//   constructor() {
//     this.client = null;
//     this.isConnected = false;
//   }

//   /**
//    * Initialize Redis connection
//    * @returns {Promise<Object>} Redis client instance
//    */
//   async connect() {
//     try {
//       // Create Redis client with connection options
//       this.client = createClient({
//         host: process.env.REDIS_HOST || 'localhost',
//         port: process.env.REDIS_PORT || 6379,
//         password: process.env.REDIS_PASSWORD || undefined,
//         database: process.env.REDIS_DB || 0,
//         retry_strategy: (options) => {
//           // Exponential backoff retry strategy
//           if (options.error && options.error.code === 'ECONNREFUSED') {
//             console.error('Redis connection refused');
//             return new Error('Redis server connection refused');
//           }
//           if (options.total_retry_time > 1000 * 60 * 60) {
//             console.error('Redis retry time exhausted');
//             return new Error('Retry time exhausted');
//           }
//           if (options.attempt > 10) {
//             console.error('Redis max attempts reached');
//             return undefined;
//           }
//           // Retry after
//           return Math.min(options.attempt * 100, 3000);
//         },
//       });

//       // Handle connection events
//       this.client.on('error', (err) => {
//         console.error('Redis Client Error:', err);
//         this.isConnected = false;
//       });

//       this.client.on('connect', () => {
//         console.log('✅ Redis connected successfully');
//         this.isConnected = true;
//       });

//       this.client.on('disconnect', () => {
//         console.log('❌ Redis disconnected');
//         this.isConnected = false;
//       });

//       // Connect to Redis
//       await this.client.connect();

//       return this.client;
//     } catch (error) {
//       console.error('Failed to connect to Redis:', error);
//       throw error;
//     }
//   }

//   /**
//    * Get Redis client instance
//    * @returns {Object} Redis client
//    */
//   getClient() {
//     if (!this.client || !this.isConnected) {
//       throw new Error('Redis client not connected. Call connect() first.');
//     }
//     return this.client;
//   }

//   /**
//    * Close Redis connection
//    */
//   async disconnect() {
//     if (this.client) {
//       await this.client.quit();
//       this.isConnected = false;
//       console.log('Redis connection closed');
//     }
//   }

//   /**
//    * Check if Redis is connected
//    * @returns {boolean}
//    */
//   isReady() {
//     return this.isConnected;
//   }
// }

// // Export singleton instance
// const redisClient = new RedisClient();
// export default redisClient;

import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

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
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('🔌 Redis client connecting...');
      });

      this.client.on('ready', () => {
        console.log('✅ Redis connected successfully');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        console.log('❌ Redis disconnected');
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
      console.log('Redis connection closed');
    }
  }

  isReady() {
    return this.isConnected;
  }
}

const redisClient = new RedisClient();
export default redisClient;
