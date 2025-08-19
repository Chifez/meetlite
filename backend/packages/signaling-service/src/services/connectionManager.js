import {
  shouldInitiateConnection,
  createConnectionKey,
} from '../utils/connectionKeys.js';

export class ConnectionManager {
  constructor(io, stateManager) {
    this.io = io;
    this.stateManager = stateManager;
    this.connectionHealthInterval = null;
    this.startConnectionHealthMonitoring();
  }

  setupConnection(socket, targetUserId) {
    const connectionKey = createConnectionKey(socket.user.userId, targetUserId);

    if (this.stateManager.getConnection(connectionKey)) {
      return;
    }

    this.stateManager.setConnection(connectionKey, {
      users: [socket.user.userId, targetUserId],
      status: 'initiating',
    });

    const shouldInitiate = shouldInitiateConnection(
      socket.user.userId,
      targetUserId
    );
    const targetSocketId = this.stateManager.getUserSocket(targetUserId);

    if (shouldInitiate) {
      socket.emit('initiate-connection', {
        targetUserId,
        isInitiator: true,
      });

      if (targetSocketId) {
        this.io.to(targetSocketId).emit('initiate-connection', {
          targetUserId: socket.user.userId,
          isInitiator: false,
        });
      }
    } else {
      if (targetSocketId) {
        this.io.to(targetSocketId).emit('initiate-connection', {
          targetUserId: socket.user.userId,
          isInitiator: true,
        });
      }

      socket.emit('initiate-connection', {
        targetUserId,
        isInitiator: false,
      });
    }
  }

  handleCallUser(socket, { to, offer }) {
    const targetSocketId = this.stateManager.getUserSocket(to);
    if (targetSocketId) {
      this.io.to(targetSocketId).emit('call-user', {
        from: socket.user.userId,
        offer,
      });
    }
  }

  handleMakeAnswer(socket, { to, answer }) {
    const targetSocketId = this.stateManager.getUserSocket(to);
    if (targetSocketId) {
      this.io.to(targetSocketId).emit('answer-made', {
        from: socket.user.userId,
        answer,
      });
    }
  }

  handleIceCandidate(socket, { to, candidate }) {
    const targetSocketId = this.stateManager.getUserSocket(to);
    if (targetSocketId) {
      this.io.to(targetSocketId).emit('ice-candidate', {
        from: socket.user.userId,
        candidate,
      });
    }
  }

  setupSocketHandlers(socket) {
    socket.on('call-user', (data) => this.handleCallUser(socket, data));
    socket.on('make-answer', (data) => this.handleMakeAnswer(socket, data));
    socket.on('ice-candidate', (data) => this.handleIceCandidate(socket, data));
  }

  cleanupConnections(userId) {
    const connections = this.stateManager.getUserConnections(userId);
    for (const connection of connections) {
      this.stateManager.deleteConnection(connection.key);
    }
  }

  cleanupOldConnections() {
    this.stateManager.cleanupOldConnections();
  }

  // Start connection health monitoring
  startConnectionHealthMonitoring() {
    this.connectionHealthInterval = setInterval(() => {
      this.monitorConnectionHealth();
    }, 30000); // Check every 30 seconds
  }

  // Stop connection health monitoring
  stopConnectionHealthMonitoring() {
    if (this.connectionHealthInterval) {
      clearInterval(this.connectionHealthInterval);
      this.connectionHealthInterval = null;
    }
  }

  // Monitor connection health (optimized)
  async monitorConnectionHealth() {
    try {
      const startTime = Date.now();
      const connections = this.stateManager.activeConnections;
      const healthOperations = [];
      const staleConnections = [];

      // Prepare batch operations
      for (const [key, connection] of connections.entries()) {
        const healthData = {
          key,
          users: connection.users,
          status: connection.status,
          timestamp: connection.timestamp,
          lastSeen: Date.now(),
          socketCount: this.getActiveSocketCount(connection.users),
        };

        // Prepare health data operation
        if (
          this.stateManager.redisState &&
          this.stateManager.redisState.isAvailable
        ) {
          healthOperations.push({
            type: 'set',
            key: `conn_health:${key}`,
            value: healthData,
            ttl: 300, // 5 minutes
          });
        }

        // Check for stale connections
        if (this.isConnectionStale(connection)) {
          staleConnections.push({ key, connection });
        }
      }

      // Execute batch operations for better performance
      if (
        healthOperations.length > 0 &&
        this.stateManager.redisState.isAvailable
      ) {
        await this.stateManager.redisState.batchOperation(healthOperations);
      }

      // Handle stale connections
      for (const { key, connection } of staleConnections) {
        console.log(`⚠️ Stale connection detected: ${key}`);
        this.handleStaleConnection(key, connection);
      }

      const endTime = Date.now();
      const monitoringTime = endTime - startTime;

      // Track performance metrics
      this.trackHealthCheckPerformance(
        monitoringTime,
        connections.size,
        staleConnections.length,
        0
      );

      // Log performance metrics
      if (monitoringTime > 100) {
        // Log if monitoring takes more than 100ms
        console.log(
          `📊 Connection health monitoring completed in ${monitoringTime}ms (${connections.size} connections)`
        );
      }
    } catch (error) {
      console.error('❌ Error monitoring connection health:', error);
    }
  }

  // Get active socket count for users
  getActiveSocketCount(users) {
    let count = 0;
    for (const userId of users) {
      const socketId = this.stateManager.getUserSocket(userId);
      if (socketId && this.io.sockets.sockets.has(socketId)) {
        count++;
      }
    }
    return count;
  }

  // Check if connection is stale
  isConnectionStale(connection) {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    return now - connection.timestamp > staleThreshold;
  }

  // Handle stale connection
  handleStaleConnection(key, connection) {
    try {
      // Attempt to recover connection
      this.attemptConnectionRecovery(key, connection);

      // If recovery fails, cleanup
      setTimeout(() => {
        if (this.isConnectionStale(connection)) {
          console.log(`🗑️ Cleaning up stale connection: ${key}`);
          this.stateManager.deleteConnection(key);
        }
      }, 30000); // Wait 30 seconds before cleanup
    } catch (error) {
      console.error(`❌ Error handling stale connection ${key}:`, error);
    }
  }

  // Attempt connection recovery
  async attemptConnectionRecovery(key, connection) {
    try {
      const recoveryData = {
        key,
        users: connection.users,
        attemptTime: Date.now(),
        strategy: 'ping_recovery',
      };

      // Store recovery attempt in Redis
      if (
        this.stateManager.redisState &&
        this.stateManager.redisState.isAvailable
      ) {
        await this.stateManager.redisState.setConnectionRecovery(
          key,
          recoveryData
        );
      }

      // Try to ping users to check if they're still active
      for (const userId of connection.users) {
        const socketId = this.stateManager.getUserSocket(userId);
        if (socketId && this.io.sockets.sockets.has(socketId)) {
          const socket = this.io.sockets.sockets.get(socketId);
          if (socket) {
            socket.emit('ping', { timestamp: Date.now() });
          }
        }
      }

      console.log(`🔄 Recovery attempt for connection: ${key}`);
    } catch (error) {
      console.error(
        `❌ Error attempting connection recovery for ${key}:`,
        error
      );
    }
  }

  // Get connection statistics
  async getConnectionStats() {
    try {
      const connections = this.stateManager.activeConnections;
      const stats = {
        total: connections.size,
        active: 0,
        stale: 0,
        recovering: 0,
        users: new Set(),
      };

      for (const [key, connection] of connections.entries()) {
        if (this.isConnectionStale(connection)) {
          stats.stale++;
        } else {
          stats.active++;
        }

        // Count unique users
        for (const userId of connection.users) {
          stats.users.add(userId);
        }
      }

      stats.uniqueUsers = stats.users.size;
      stats.users = Array.from(stats.users);

      return stats;
    } catch (error) {
      console.error('❌ Error getting connection stats:', error);
      return { error: error.message };
    }
  }

  // Track health check performance
  trackHealthCheckPerformance(
    duration,
    totalConnections,
    staleConnections,
    recoveredConnections
  ) {
    if (!this.healthCheckMetrics) {
      this.healthCheckMetrics = {
        totalChecks: 0,
        averageDuration: 0,
        totalConnections: 0,
        totalStaleConnections: 0,
        totalRecoveredConnections: 0,
        lastCheckTime: null,
      };
    }

    this.healthCheckMetrics.totalChecks++;
    this.healthCheckMetrics.lastCheckTime = Date.now();
    this.healthCheckMetrics.averageDuration =
      (this.healthCheckMetrics.averageDuration *
        (this.healthCheckMetrics.totalChecks - 1) +
        duration) /
      this.healthCheckMetrics.totalChecks;
    this.healthCheckMetrics.totalConnections += totalConnections;
    this.healthCheckMetrics.totalStaleConnections += staleConnections;
    this.healthCheckMetrics.totalRecoveredConnections += recoveredConnections;

    // Log performance warnings
    if (duration > 5000) {
      console.warn(
        `⚠️ Slow health check detected: ${duration}ms for ${totalConnections} connections`
      );
    }
  }

  // Get performance metrics
  getPerformanceMetrics() {
    return {
      healthCheck: this.healthCheckMetrics || {},
      connections: this.getConnectionStats(),
      timestamp: Date.now(),
    };
  }

  // Cleanup method for shutdown
  cleanup() {
    this.stopConnectionHealthMonitoring();
  }
}
