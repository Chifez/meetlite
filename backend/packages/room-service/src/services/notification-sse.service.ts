import { Response } from 'express';
import { Redis } from 'ioredis';

/**
 * Notification SSE Service
 * Handles real-time notification delivery via Server-Sent Events (SSE) backed by Redis Pub/Sub
 */

// Map of userId -> Express response object for active SSE connections
const activeConnections = new Map<string, Response>();

// Map of userId -> heartbeat interval ID
const heartbeatIntervals = new Map<string, NodeJS.Timeout>();

// Map of userId -> last successful write timestamp (for timeout detection)
const lastWriteTime = new Map<string, number>();

// Timeout check interval ID
let timeoutCheckIntervalId: NodeJS.Timeout | null = null;

// Redis clients for Pub/Sub
let redisPublisher: Redis | null = null;
let redisSubscriber: Redis | null = null;

// Maximum total concurrent SSE connections across all users
const MAX_TOTAL_CONNECTIONS = parseInt(
  process.env.MAX_SSE_CONNECTIONS || '10000',
  10
);

// Connection timeout in milliseconds
const CONNECTION_TIMEOUT_MS = 60000;

const redisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 1,
  family: 4,
};

/**
 * Initialize SSE service
 */
export const initializeNotificationSSE = () => {
  console.log('✅ Notification SSE service initializing...');
  
  // Initialize Redis clients for Pub/Sub
  redisPublisher = new Redis(redisOptions);
  redisSubscriber = new Redis(redisOptions);

  // Handle incoming messages from Redis subscription
  redisSubscriber.on('message', (channel: string, message: string) => {
    const userId = channel.replace('notifications:', '');
    const connection = activeConnections.get(userId);
    
    if (connection && !connection.destroyed && !connection.closed) {
      try {
        connection.write(`data: ${message}\n\n`);
        // Update last write time
        lastWriteTime.set(userId, Date.now());
      } catch (err) {
        console.error(`❌ Failed to write SSE message to user ${userId}:`, err);
        cleanupConnection(userId);
      }
    }
  });

  redisSubscriber.on('error', (err: any) => {
    console.error('Redis SSE Subscriber error:', err);
  });

  redisPublisher.on('error', (err: any) => {
    console.error('Redis SSE Publisher error:', err);
  });

  console.log('✅ Redis Pub/Sub for SSE initialized');
  console.log(`   - Max total connections: ${MAX_TOTAL_CONNECTIONS}`);
  console.log(`   - Connection timeout: ${CONNECTION_TIMEOUT_MS / 1000}s`);
  
  // Set up periodic timeout check
  timeoutCheckIntervalId = setInterval(() => {
    const now = Date.now();
    const timedOutUsers: string[] = [];
    
    for (const [userId, lastWrite] of lastWriteTime.entries()) {
      if (now - lastWrite > CONNECTION_TIMEOUT_MS) {
        timedOutUsers.push(userId);
      }
    }
    
    for (const userId of timedOutUsers) {
      console.log(`⏱️  Cleaning up timed out connection for user ${userId}`);
      cleanupConnection(userId);
    }
  }, 30000);
  
  return {
    activeConnections,
    getConnectionCount: () => activeConnections.size,
  };
};

/**
 * Send notification to a specific user via SSE Pub/Sub
 */
export const sendNotificationToUser = async (userId: string, notification: any): Promise<boolean> => {
  if (!redisPublisher) {
    console.error('Redis publisher not initialized in SSE service');
    return false;
  }

  try {
    const data = JSON.stringify({
      id: notification.id || notification._id?.toString(),
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      status: notification.status,
      read: notification.read || false,
      readAt: notification.readAt,
      createdAt: notification.createdAt || new Date().toISOString(),
    });

    // Publish to the user's specific channel
    await redisPublisher.publish(`notifications:${userId}`, data);
    console.log(`📨 Published SSE notification to Redis channel notifications:${userId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to publish SSE notification to user ${userId}:`, error);
    return false;
  }
};

/**
 * Send notification to multiple users
 */
export const sendNotificationToUsers = async (userIds: string[], notification: any): Promise<number> => {
  let successCount = 0;

  for (const userId of userIds) {
    const result = await sendNotificationToUser(userId, notification);
    if (result) {
      successCount++;
    }
  }

  return successCount;
};

/**
 * Get the maximum total connections limit
 */
export const getMaxTotalConnections = (): number => {
  return MAX_TOTAL_CONNECTIONS;
};

/**
 * Check if we can accept a new connection (global limit check)
 */
export const canAcceptNewConnection = (): boolean => {
  for (const [userId, connection] of activeConnections.entries()) {
    if (connection.destroyed || connection.closed) {
      cleanupConnection(userId);
    }
  }
  
  return activeConnections.size < MAX_TOTAL_CONNECTIONS;
};

/**
 * Register a new SSE connection for a user
 */
export const registerConnection = async (userId: string, res: Response) => {
  for (const [uid, connection] of activeConnections.entries()) {
    if (connection.destroyed || connection.closed) {
      cleanupConnection(uid);
    }
  }
  
  if (activeConnections.size >= MAX_TOTAL_CONNECTIONS) {
    const error: any = new Error(
      `Server at capacity: Maximum concurrent connections (${MAX_TOTAL_CONNECTIONS}) reached`
    );
    error.code = 'CONNECTION_LIMIT_EXCEEDED';
    throw error;
  }

  const existingConnection = activeConnections.get(userId);
  if (existingConnection) {
    console.log(`🔄 User ${userId} reconnecting - closing existing SSE connection`);
    cleanupConnection(userId);
  }

  // Store the connection locally
  activeConnections.set(userId, res);
  lastWriteTime.set(userId, Date.now());

  // Subscribe to user's channel on Redis
  if (redisSubscriber) {
    try {
      await redisSubscriber.subscribe(`notifications:${userId}`);
      console.log(`✅ Subscribed to Redis channel notifications:${userId}`);
    } catch (err) {
      console.error(`❌ Failed to subscribe notifications:${userId} on Redis:`, err);
    }
  }

  // Set up heartbeat
  const heartbeat = setInterval(() => {
    const connection = activeConnections.get(userId);
    if (connection && !connection.destroyed && !connection.closed) {
      try {
        const lastWrite = lastWriteTime.get(userId);
        const now = Date.now();
        
        if (lastWrite && now - lastWrite > CONNECTION_TIMEOUT_MS) {
          console.log(`⏱️  Connection timeout detected for user ${userId}`);
          cleanupConnection(userId);
          return;
        }

        connection.write(': heartbeat\n\n');
        lastWriteTime.set(userId, Date.now());
      } catch (error) {
        console.log(`❌ Heartbeat failed for user ${userId}`);
        cleanupConnection(userId);
      }
    } else {
      cleanupConnection(userId);
    }
  }, 30000);

  heartbeatIntervals.set(userId, heartbeat);
  console.log(`✅ Registered SSE connection for user ${userId}`);
};

/**
 * Clean up connection for a user
 */
export const cleanupConnection = (userId: string) => {
  const heartbeat = heartbeatIntervals.get(userId);
  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeatIntervals.delete(userId);
  }

  lastWriteTime.delete(userId);

  const connection = activeConnections.get(userId);
  if (connection && !connection.destroyed && !connection.closed) {
    try {
      connection.end();
    } catch (error) {
      // Ignore
    }
  }

  activeConnections.delete(userId);

  // Unsubscribe from Redis channel
  if (redisSubscriber) {
    redisSubscriber.unsubscribe(`notifications:${userId}`).catch((err: any) => {
      console.error(`❌ Failed to unsubscribe notifications:${userId}:`, err);
    });
  }

  console.log(`🧹 Cleaned up SSE connection for user ${userId}`);
};

/**
 * Check if user is connected
 */
export const isUserConnected = (userId: string): boolean => {
  const connection = activeConnections.get(userId);
  return !!(connection && !connection.destroyed && !connection.closed);
};

/**
 * Get connected user count
 */
export const getConnectedUserCount = (): number => {
  for (const [userId, connection] of activeConnections.entries()) {
    if (connection.destroyed || connection.closed) {
      cleanupConnection(userId);
    }
  }
  return activeConnections.size;
};

/**
 * Get all connected user IDs
 */
export const getConnectedUserIds = (): string[] => {
  for (const [userId, connection] of activeConnections.entries()) {
    if (connection.destroyed || connection.closed) {
      cleanupConnection(userId);
    }
  }
  return Array.from(activeConnections.keys());
};

/**
 * Shutdown SSE service
 */
export const shutdownNotificationSSE = async () => {
  console.log('⏹️  Shutting down notification SSE service...');

  if (timeoutCheckIntervalId) {
    clearInterval(timeoutCheckIntervalId);
    timeoutCheckIntervalId = null;
  }

  for (const [userId, connection] of activeConnections.entries()) {
    try {
      if (!connection.destroyed && !connection.closed) {
        connection.end();
      }
    } catch (error) {
      // Ignore
    }
  }

  for (const heartbeat of heartbeatIntervals.values()) {
    clearInterval(heartbeat);
  }

  activeConnections.clear();
  heartbeatIntervals.clear();
  lastWriteTime.clear();

  if (redisSubscriber) {
    try {
      await redisSubscriber.quit();
    } catch (err) {
      // Ignore
    }
  }

  if (redisPublisher) {
    try {
      await redisPublisher.quit();
    } catch (err) {
      // Ignore
    }
  }

  console.log('✅ Notification SSE service shut down');
};

export default {
  initializeNotificationSSE,
  sendNotificationToUser,
  sendNotificationToUsers,
  registerConnection,
  cleanupConnection,
  isUserConnected,
  getConnectedUserCount,
  getConnectedUserIds,
  canAcceptNewConnection,
  getMaxTotalConnections,
  shutdownNotificationSSE,
};
