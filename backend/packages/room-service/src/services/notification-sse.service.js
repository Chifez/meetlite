import { auditLog } from './audit.service.js';

/**
 * Notification SSE Service
 * Handles real-time notification delivery via Server-Sent Events (SSE)
 */

// Map of userId -> Express response object for active SSE connections
const activeConnections = new Map();

// Map of userId -> heartbeat interval ID
const heartbeatIntervals = new Map();

// Map of userId -> last successful write timestamp (for timeout detection)
const lastWriteTime = new Map();

// Timeout check interval ID (for cleanup on shutdown)
let timeoutCheckIntervalId = null;

// Maximum total concurrent SSE connections across all users (prevent resource exhaustion)
// Default: 10,000 connections (adjust based on server capacity)
const MAX_TOTAL_CONNECTIONS = parseInt(
  process.env.MAX_SSE_CONNECTIONS || '10000',
  10
);

// Connection timeout in milliseconds (60 seconds)
const CONNECTION_TIMEOUT_MS = 60000;

/**
 * Initialize SSE service
 * This is called when the server starts
 */
export const initializeNotificationSSE = () => {
  console.log('✅ Notification SSE service initialized');
  console.log(`   - Max total connections: ${MAX_TOTAL_CONNECTIONS}`);
  console.log(`   - Connection timeout: ${CONNECTION_TIMEOUT_MS / 1000}s`);
  
  // Set up periodic timeout check (runs every 30 seconds to check for stale connections)
  timeoutCheckIntervalId = setInterval(() => {
    const now = Date.now();
    const timedOutUsers = [];
    
    for (const [userId, lastWrite] of lastWriteTime.entries()) {
      if (now - lastWrite > CONNECTION_TIMEOUT_MS) {
        timedOutUsers.push(userId);
      }
    }
    
    // Clean up timed out connections
    for (const userId of timedOutUsers) {
      console.log(`⏱️  Cleaning up timed out connection for user ${userId}`);
      cleanupConnection(userId);
    }
  }, 30000); // Check every 30 seconds
  
  return {
    activeConnections,
    getConnectionCount: () => activeConnections.size,
  };
};

/**
 * Send notification to a specific user via SSE
 * @param {string} userId - User ID to send notification to
 * @param {Object} notification - Notification data
 * @returns {boolean} - True if notification was sent successfully
 */
export const sendNotificationToUser = (userId, notification) => {
  const connection = activeConnections.get(userId);

  if (!connection) {
    // User not connected via SSE, that's okay - they'll get it via email/push
    return false;
  }

  try {
    // Check if connection is still alive
    if (connection.destroyed || connection.closed) {
      // Clean up dead connection
      cleanupConnection(userId);
      return false;
    }

    // Send notification via SSE
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

    connection.write(`data: ${data}\n\n`);

    // Update last successful write time
    lastWriteTime.set(userId, Date.now());

    console.log(`📨 Sent SSE notification to user ${userId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send SSE notification to user ${userId}:`, error);
    // Clean up broken connection
    cleanupConnection(userId);
    return false;
  }
};

/**
 * Send notification to multiple users
 * @param {Array<string>} userIds - Array of user IDs
 * @param {Object} notification - Notification data
 * @returns {number} - Number of successful sends
 */
export const sendNotificationToUsers = (userIds, notification) => {
  let successCount = 0;

  for (const userId of userIds) {
    if (sendNotificationToUser(userId, notification)) {
      successCount++;
    }
  }

  return successCount;
};

/**
 * Get the maximum total connections limit
 * @returns {number} - Maximum total connections allowed
 */
export const getMaxTotalConnections = () => {
  return MAX_TOTAL_CONNECTIONS;
};

/**
 * Check if we can accept a new connection (global limit check)
 * @returns {boolean} - True if we can accept a new connection
 */
export const canAcceptNewConnection = () => {
  // Clean up dead connections first to get accurate count
  for (const [userId, connection] of activeConnections.entries()) {
    if (connection.destroyed || connection.closed) {
      cleanupConnection(userId);
    }
  }
  
  return activeConnections.size < MAX_TOTAL_CONNECTIONS;
};

/**
 * Register a new SSE connection for a user
 * @param {string} userId - User ID
 * @param {Object} res - Express response object
 * @throws {Error} If global connection limit is reached
 */
export const registerConnection = (userId, res) => {
  // Check global connection limit BEFORE registering
  // Clean up dead connections first to get accurate count
  for (const [uid, connection] of activeConnections.entries()) {
    if (connection.destroyed || connection.closed) {
      cleanupConnection(uid);
    }
  }
  
  if (activeConnections.size >= MAX_TOTAL_CONNECTIONS) {
    const error = new Error(
      `Server at capacity: Maximum concurrent connections (${MAX_TOTAL_CONNECTIONS}) reached`
    );
    error.code = 'CONNECTION_LIMIT_EXCEEDED';
    throw error;
  }

  // Security: Enforce connection limit per user to prevent DoS
  // Since we store one connection per userId in the Map, we ensure only one active connection per user
  // If user tries to connect again, we close the existing connection first
  const existingConnection = activeConnections.get(userId);
  
  if (existingConnection) {
    console.log(`🔄 User ${userId} reconnecting - closing existing SSE connection`);
    // Clean up existing connection before registering new one
    cleanupConnection(userId);
  }

  // Store the new connection
  activeConnections.set(userId, res);

  // Initialize last write time
  lastWriteTime.set(userId, Date.now());

  // Set up heartbeat to keep connection alive and detect timeouts
  const heartbeat = setInterval(() => {
    const connection = activeConnections.get(userId);
    if (connection && !connection.destroyed && !connection.closed) {
      try {
        // Check if connection has timed out (no successful write in CONNECTION_TIMEOUT_MS)
        const lastWrite = lastWriteTime.get(userId);
        const now = Date.now();
        
        if (lastWrite && now - lastWrite > CONNECTION_TIMEOUT_MS) {
          console.log(`⏱️  Connection timeout detected for user ${userId} (last write: ${now - lastWrite}ms ago)`);
          cleanupConnection(userId);
          return;
        }

        // Send heartbeat comment (SSE format)
        connection.write(': heartbeat\n\n');
        
        // Update last successful write time
        lastWriteTime.set(userId, Date.now());
      } catch (error) {
        // Connection is dead, clean it up
        console.log(`❌ Heartbeat failed for user ${userId}:`, error.message);
        cleanupConnection(userId);
      }
    } else {
      // Connection is dead, clean it up
      cleanupConnection(userId);
    }
  }, 30000); // Every 30 seconds

  heartbeatIntervals.set(userId, heartbeat);

  console.log(`✅ Registered SSE connection for user ${userId}`);
};

/**
 * Clean up connection for a user
 * @param {string} userId - User ID
 */
export const cleanupConnection = (userId) => {
  // Clear heartbeat interval
  const heartbeat = heartbeatIntervals.get(userId);
  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeatIntervals.delete(userId);
  }

  // Remove last write time tracking
  lastWriteTime.delete(userId);

  // Close and remove connection
  const connection = activeConnections.get(userId);
  if (connection && !connection.destroyed && !connection.closed) {
    try {
      connection.end();
    } catch (error) {
      // Connection already closed, ignore
    }
  }

  activeConnections.delete(userId);
  console.log(`🧹 Cleaned up SSE connection for user ${userId}`);
};

/**
 * Check if user is connected
 * @param {string} userId - User ID to check
 * @returns {boolean}
 */
export const isUserConnected = (userId) => {
  const connection = activeConnections.get(userId);
  return connection && !connection.destroyed && !connection.closed;
};

/**
 * Get connected user count
 * @returns {number}
 */
export const getConnectedUserCount = () => {
  // Clean up dead connections first
  for (const [userId, connection] of activeConnections.entries()) {
    if (connection.destroyed || connection.closed) {
      cleanupConnection(userId);
    }
  }
  return activeConnections.size;
};

/**
 * Get all connected user IDs
 * @returns {Array<string>}
 */
export const getConnectedUserIds = () => {
  // Clean up dead connections first
  for (const [userId, connection] of activeConnections.entries()) {
    if (connection.destroyed || connection.closed) {
      cleanupConnection(userId);
    }
  }
  return Array.from(activeConnections.keys());
};

/**
 * Shutdown SSE service
 * Closes all active connections
 */
export const shutdownNotificationSSE = async () => {
  console.log('⏹️  Shutting down notification SSE service...');

  // Clear timeout check interval
  if (timeoutCheckIntervalId) {
    clearInterval(timeoutCheckIntervalId);
    timeoutCheckIntervalId = null;
  }

  // Close all connections
  for (const [userId, connection] of activeConnections.entries()) {
    try {
      if (!connection.destroyed && !connection.closed) {
        connection.end();
      }
    } catch (error) {
      // Ignore errors during shutdown
    }
  }

  // Clear all heartbeat intervals
  for (const heartbeat of heartbeatIntervals.values()) {
    clearInterval(heartbeat);
  }

  // Clear maps
  activeConnections.clear();
  heartbeatIntervals.clear();
  lastWriteTime.clear();

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


