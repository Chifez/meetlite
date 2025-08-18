import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// Redis configuration
const REDIS_CONFIG = {
  url: `redis://${process.env.REDIS_HOST || 'localhost'}:${
    process.env.REDIS_PORT || 6379
  }`,
  password: process.env.REDIS_PASSWORD || undefined,
  database: parseInt(process.env.REDIS_DB || '0'),
  socket: {
    family: 4, // Force IPv4
    connectTimeout: 10000, // 10 seconds
    lazyConnect: true, // Don't connect immediately
  },
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      // End reconnecting on a specific error and flush all commands with a individual error
      console.error('❌ Redis server refused connection');
      return new Error('Redis server refused connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      // End reconnecting after a specific timeout and flush all commands with a individual error
      console.error('❌ Redis reconnection timeout');
      return new Error('Redis reconnection timeout');
    }
    if (options.attempt > 10) {
      // End reconnecting with built in error
      console.error('❌ Redis max reconnection attempts reached');
      return undefined;
    }
    // Reconnect after
    return Math.min(options.attempt * 100, 3000);
  },
};

// Create main Redis client
const redisClient = createClient(REDIS_CONFIG);

// Create Socket.IO Redis adapter clients
const pubClient = redisClient.duplicate();
const subClient = redisClient.duplicate();

// Connection event handlers for main client
redisClient.on('connect', () => {
  console.log('🔄 Redis client connecting...');
});

redisClient.on('ready', () => {
  console.log('✅ Redis client ready');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis client error:', err);
});

redisClient.on('end', () => {
  console.log('⚠️ Redis client disconnected');
});

redisClient.on('reconnecting', () => {
  console.log('🔄 Redis client reconnecting...');
});

// Connection event handlers for pub client
pubClient.on('connect', () => {
  console.log('🔄 Redis pub client connecting...');
});

pubClient.on('ready', () => {
  console.log('✅ Redis pub client ready');
});

pubClient.on('error', (err) => {
  console.error('❌ Redis pub client error:', err);
});

// Connection event handlers for sub client
subClient.on('connect', () => {
  console.log('🔄 Redis sub client connecting...');
});

subClient.on('ready', () => {
  console.log('✅ Redis sub client ready');
});

subClient.on('error', (err) => {
  console.error('❌ Redis sub client error:', err);
});

// Connection management functions
const connectRedis = async () => {
  try {
    console.log('🔄 Connecting to Redis...');
    await redisClient.connect();
    await pubClient.connect();
    await subClient.connect();
    console.log('✅ All Redis clients connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    return false;
  }
};

const disconnectRedis = async () => {
  try {
    console.log('🔄 Disconnecting Redis clients...');
    await redisClient.disconnect();
    await pubClient.disconnect();
    await subClient.disconnect();
    console.log('✅ All Redis clients disconnected successfully');
  } catch (error) {
    console.error('❌ Error disconnecting Redis clients:', error);
  }
};

const isRedisReady = () => {
  return redisClient.isReady && pubClient.isReady && subClient.isReady;
};

const getRedisHealth = () => {
  return {
    main: {
      status: redisClient.isReady ? 'connected' : 'disconnected',
      isOpen: redisClient.isOpen,
    },
    pub: {
      status: pubClient.isReady ? 'connected' : 'disconnected',
      isOpen: pubClient.isOpen,
    },
    sub: {
      status: subClient.isReady ? 'connected' : 'disconnected',
      isOpen: subClient.isOpen,
    },
  };
};

// Test Redis connection
const testRedisConnection = async () => {
  try {
    if (!redisClient.isReady) {
      console.log('⚠️ Redis client not ready, attempting connection...');
      await connectRedis();
    }

    if (redisClient.isReady) {
      await redisClient.ping();
      console.log('✅ Redis connection test successful');
      return true;
    } else {
      console.log('❌ Redis connection test failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Redis connection test error:', error);
    return false;
  }
};

export {
  redisClient,
  pubClient,
  subClient,
  connectRedis,
  disconnectRedis,
  isRedisReady,
  getRedisHealth,
  testRedisConnection,
};
