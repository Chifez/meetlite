import { auditLog } from './audit.service.js';

/**
 * Notification SSE Service
 * Handles real-time notification delivery via Server-Sent Events (SSE)
 */

// Map of userId -> Express response object for active SSE connections
const activeConnections = new Map();

// Map of userId -> heartbeat interval ID
const heartbeatIntervals = new Map();

/**
 * Initialize SSE service
 * This is called when the server starts
 */
export const initializeNotificationSSE = () => {
  console.log('✅ Notification SSE service initialized');
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
 * Register a new SSE connection for a user
 * @param {string} userId - User ID
 * @param {Object} res - Express response object
 */
export const registerConnection = (userId, res) => {
  // Clean up any existing connection for this user
  cleanupConnection(userId);

  // Store the connection
  activeConnections.set(userId, res);

  // Set up heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    const connection = activeConnections.get(userId);
    if (connection && !connection.destroyed && !connection.closed) {
      try {
        // Send heartbeat comment (SSE format)
        connection.write(': heartbeat\n\n');
      } catch (error) {
        // Connection is dead, clean it up
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

  // Clear all intervals
  for (const heartbeat of heartbeatIntervals.values()) {
    clearInterval(heartbeat);
  }

  // Clear maps
  activeConnections.clear();
  heartbeatIntervals.clear();

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
  shutdownNotificationSSE,
};


