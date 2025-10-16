import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// Redis configuration with performance optimizations
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
    keepAlive: 30000, // Keep connection alive
    noDelay: true, // Disable Nagle's algorithm
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
  // Performance optimizations
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  maxLoadingTimeout: 10000,
  // Connection pooling
  enableOfflineQueue: false,
  // Memory optimization
  string_numbers: false,
  // Pipeline optimization
  enableAutoPipelining: true,
  maxAutoPipelining: 32,
};

// Create main Redis client
const redisClient = createClient(REDIS_CONFIG);

// Create Socket.IO Redis adapter clients
const pubClient = redisClient.duplicate();
const subClient = redisClient.duplicate();

// Connection event handlers for main client
redisClient.on('connect', () => {
  updateCircuitBreaker(); // Reset error count on successful connection
});

redisClient.on('ready', () => {
  updateCircuitBreaker(); // Reset error count on ready state
});

redisClient.on('error', (err) => {
  console.error('❌ Redis client error:', err);
  updateCircuitBreaker(err);
});

redisClient.on('end', () => {
  updateCircuitBreaker(new Error('Connection ended'));
});

redisClient.on('reconnecting', () => {
  // Redis client reconnecting
  console.info('🔗 Redis client reconnecting');
});

// Connection event handlers for pub client
pubClient.on('connect', () => {
  // Redis pub client connecting
  console.info('🔗 Redis pub client connected');
});

pubClient.on('ready', () => {
  // Redis pub client ready
  console.info('🔗 Redis pub client ready');
});

pubClient.on('error', (err) => {
  console.error('❌ Redis pub client error:', err);
});

// Connection event handlers for sub client
subClient.on('connect', () => {
  // Redis sub client connecting
  console.info('🔗 Redis sub client connected');
});

subClient.on('ready', () => {
  // Redis sub client ready
  console.info('🔗 Redis sub client ready');
});

subClient.on('error', (err) => {
  console.error('❌ Redis sub client error:', err);
});

// Performance monitoring
let performanceMetrics = {
  connectionTime: 0,
  lastLatencyCheck: 0,
  averageLatency: 0,
  latencyChecks: 0,
  totalCommands: 0,
  lastCommandTime: 0,
};

// Error handling and recovery
let errorMetrics = {
  totalErrors: 0,
  consecutiveErrors: 0,
  lastErrorTime: null,
  lastErrorType: null,
  recoveryAttempts: 0,
  lastRecoveryTime: null,
  circuitBreakerState: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
  circuitBreakerOpenedAt: null,
  circuitBreakerThreshold: 5, // Number of consecutive errors before opening
  circuitBreakerTimeout: 30000, // 30 seconds timeout
};

// Circuit breaker states
const CIRCUIT_BREAKER_STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

// Monitor Redis performance
const monitorPerformance = async () => {
  try {
    const start = Date.now();
    await redisClient.ping();
    const latency = Date.now() - start;

    // Update performance metrics
    performanceMetrics.lastLatencyCheck = Date.now();
    performanceMetrics.latencyChecks++;
    performanceMetrics.averageLatency =
      (performanceMetrics.averageLatency *
        (performanceMetrics.latencyChecks - 1) +
        latency) /
      performanceMetrics.latencyChecks;

    // Log performance warnings

    return latency;
  } catch (error) {
    console.error('❌ Performance monitoring error:', error);
    return null;
  }
};

// Start performance monitoring
const startPerformanceMonitoring = () => {
  setInterval(monitorPerformance, 30000); // Check every 30 seconds
};

// Circuit breaker logic
const updateCircuitBreaker = (error = null) => {
  if (error) {
    errorMetrics.totalErrors++;
    errorMetrics.consecutiveErrors++;
    errorMetrics.lastErrorTime = Date.now();
    errorMetrics.lastErrorType = error.constructor.name;

    // Check if circuit breaker should open
    if (
      errorMetrics.consecutiveErrors >= errorMetrics.circuitBreakerThreshold &&
      errorMetrics.circuitBreakerState === CIRCUIT_BREAKER_STATES.CLOSED
    ) {
      errorMetrics.circuitBreakerState = CIRCUIT_BREAKER_STATES.OPEN;
      errorMetrics.circuitBreakerOpenedAt = Date.now();
    }
  } else {
    // Reset consecutive errors on success
    errorMetrics.consecutiveErrors = 0;
    errorMetrics.lastRecoveryTime = Date.now();

    // Check if circuit breaker should close
    if (errorMetrics.circuitBreakerState === CIRCUIT_BREAKER_STATES.HALF_OPEN) {
      errorMetrics.circuitBreakerState = CIRCUIT_BREAKER_STATES.CLOSED;
    }
  }
};

// Check if circuit breaker is open
const isCircuitBreakerOpen = () => {
  if (errorMetrics.circuitBreakerState === CIRCUIT_BREAKER_STATES.OPEN) {
    const timeSinceOpened = Date.now() - errorMetrics.circuitBreakerOpenedAt;

    // Check if timeout has passed to move to HALF_OPEN
    if (timeSinceOpened >= errorMetrics.circuitBreakerTimeout) {
      errorMetrics.circuitBreakerState = CIRCUIT_BREAKER_STATES.HALF_OPEN;
      return false;
    }

    return true;
  }

  return false;
};

// Attempt recovery
const attemptRecovery = async () => {
  if (errorMetrics.circuitBreakerState !== CIRCUIT_BREAKER_STATES.OPEN) {
    return false;
  }

  try {
    errorMetrics.recoveryAttempts++;

    // Test connection
    await redisClient.ping();

    // Success - close circuit breaker
    errorMetrics.circuitBreakerState = CIRCUIT_BREAKER_STATES.CLOSED;
    errorMetrics.consecutiveErrors = 0;
    errorMetrics.lastRecoveryTime = Date.now();

    return true;
  } catch (error) {
    console.error('❌ Redis recovery failed:', error);
    return false;
  }
};

// Start recovery monitoring
const startRecoveryMonitoring = () => {
  setInterval(async () => {
    if (isCircuitBreakerOpen()) {
      await attemptRecovery();
    }
  }, 10000); // Check every 10 seconds
};

// Connection management functions
const connectRedis = async () => {
  try {
    await redisClient.connect();
    await pubClient.connect();
    await subClient.connect();

    // Start performance monitoring after connection
    startPerformanceMonitoring();

    // Start recovery monitoring
    startRecoveryMonitoring();

    return true;
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    return false;
  }
};

const disconnectRedis = async () => {
  try {
    await redisClient.disconnect();
    await pubClient.disconnect();
    await subClient.disconnect();
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
      await connectRedis();
    }

    if (redisClient.isReady) {
      await redisClient.ping();
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error('❌ Redis connection test error:', error);
    return false;
  }
};

// Get performance metrics
const getPerformanceMetrics = () => {
  return {
    ...performanceMetrics,
    currentTime: Date.now(),
    uptime:
      performanceMetrics.lastLatencyCheck - performanceMetrics.connectionTime,
  };
};

// Get error metrics
const getErrorMetrics = () => {
  return {
    ...errorMetrics,
    currentTime: Date.now(),
    isCircuitBreakerOpen: isCircuitBreakerOpen(),
    timeSinceLastError: errorMetrics.lastErrorTime
      ? Date.now() - errorMetrics.lastErrorTime
      : null,
    timeSinceLastRecovery: errorMetrics.lastRecoveryTime
      ? Date.now() - errorMetrics.lastRecoveryTime
      : null,
  };
};

// Get comprehensive health status
const getComprehensiveHealth = () => {
  return {
    performance: getPerformanceMetrics(),
    errors: getErrorMetrics(),
    circuitBreaker: {
      state: errorMetrics.circuitBreakerState,
      isOpen: isCircuitBreakerOpen(),
      threshold: errorMetrics.circuitBreakerThreshold,
      timeout: errorMetrics.circuitBreakerTimeout,
    },
    recommendations: getHealthRecommendations(),
  };
};

// Get health recommendations based on current state
const getHealthRecommendations = () => {
  const recommendations = [];

  if (errorMetrics.consecutiveErrors > 0) {
    recommendations.push(
      `High error rate: ${errorMetrics.consecutiveErrors} consecutive errors`
    );
  }

  if (errorMetrics.circuitBreakerState === CIRCUIT_BREAKER_STATES.OPEN) {
    recommendations.push('Circuit breaker is OPEN - Redis is in failure state');
  }

  if (errorMetrics.circuitBreakerState === CIRCUIT_BREAKER_STATES.HALF_OPEN) {
    recommendations.push(
      'Circuit breaker is HALF_OPEN - testing Redis recovery'
    );
  }

  if (performanceMetrics.averageLatency > 100) {
    recommendations.push(
      `High latency detected: ${performanceMetrics.averageLatency}ms average`
    );
  }

  return recommendations;
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
  getPerformanceMetrics,
  getErrorMetrics,
  getComprehensiveHealth,
  isCircuitBreakerOpen,
  attemptRecovery,
};
