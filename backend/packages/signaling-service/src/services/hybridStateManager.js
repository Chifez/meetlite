import { RedisStateManager } from './redisStateManager.js';

export class HybridStateManager {
  constructor() {
    // In-memory storage for performance
    this.roomState = new Map();
    this.userToSocket = new Map();
    this.socketToUser = new Map();
    this.activeConnections = new Map();
    this.screenSharingState = new Map();
    this.userInfo = new Map();
    this.collaborationState = new Map();
    this.tldrawRooms = new Map();

    // Redis state manager for persistence
    this.redisState = new RedisStateManager();

    // Sync interval for Redis state
    this.syncInterval = null;
    this.startSyncInterval();
  }

  // Start periodic Redis sync
  startSyncInterval() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Sync every 30 seconds
    this.syncInterval = setInterval(async () => {
      await this.syncToRedis();
    }, 30000);
  }

  // Stop sync interval
  stopSyncInterval() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Sync critical state to Redis
  async syncToRedis() {
    if (!this.redisState.isAvailable) {
      return;
    }

    const startTime = Date.now();

    try {
      // Sync room participants
      for (const [roomId, room] of this.roomState.entries()) {
        const participants = Array.from(room.keys());
        await this.redisState.set('ROOM', roomId, {
          participants,
          timestamp: Date.now(),
        });
      }

      // Sync user info
      for (const [userId, info] of this.userInfo.entries()) {
        await this.redisState.set('USER', userId, {
          ...info,
          lastSeen: Date.now(),
        });
      }

      // Sync collaboration state
      for (const [roomId, state] of this.collaborationState.entries()) {
        await this.redisState.set('COLLABORATION', roomId, {
          ...state,
          lastUpdated: Date.now(),
        });
      }

      // Sync screen sharing state
      for (const [roomId, state] of this.screenSharingState.entries()) {
        if (state) {
          await this.redisState.set('SCREEN_SHARE', roomId, {
            ...state,
            timestamp: Date.now(),
          });
        }
      }

      // Track performance
      await this.trackSyncOperation('full_sync', startTime);
    } catch (error) {
      console.error('❌ Redis sync error:', error);
    }
  }

  // Load state from Redis on startup
  async loadFromRedis() {
    if (!this.redisState.isAvailable) {
      return;
    }

    try {
      // Load room participants
      const roomKeys = await this.redisState.redisClient.keys('room:*');
      for (const key of roomKeys) {
        const roomId = key.replace('room:', '');
        const roomData = await this.redisState.get('ROOM', roomId);
        if (roomData && roomData.participants) {
          const room = new Map();
          roomData.participants.forEach((userId) => {
            room.set(userId, { connected: false });
          });
          this.roomState.set(roomId, room);
        }
      }

      // Load user info
      const userKeys = await this.redisState.redisClient.keys('user:*');
      for (const key of userKeys) {
        const userId = key.replace('user:', '');
        const userData = await this.redisState.get('USER', userId);
        if (userData) {
          this.userInfo.set(userId, userData);
        }
      }

      // Load collaboration state
      const collabKeys = await this.redisState.redisClient.keys('collab:*');
      for (const key of collabKeys) {
        const roomId = key.replace('collab:', '');
        const collabData = await this.redisState.get('COLLABORATION', roomId);
        if (collabData) {
          this.collaborationState.set(roomId, collabData);
        }
      }

      // Load screen sharing state
      const screenKeys = await this.redisState.redisClient.keys(
        'screenshare:*'
      );
      for (const key of screenKeys) {
        const roomId = key.replace('screenshare:', '');
        const screenData = await this.redisState.get('SCREEN_SHARE', roomId);
        if (screenData) {
          this.screenSharingState.set(roomId, screenData);
        }
      }
    } catch (error) {
      console.error('❌ Error loading from Redis:', error);
    }
  }

  // Room Management with Redis sync
  initializeRoom(roomId) {
    if (!this.roomState.has(roomId)) {
      this.roomState.set(roomId, new Map());
      this.screenSharingState.set(roomId, null);
      this.collaborationState.set(roomId, {
        mode: 'none',
        activeTool: 'none',
        workflowData: null,
        whiteboardData: null,
        presenter: {
          userId: null,
          mode: null,
          collaborationSettings: {
            mode: 'allow-edit',
            allowedUsers: [],
          },
        },
      });

      // Sync to Redis
      this.syncRoomToRedis(roomId);
    }
    return this.roomState.get(roomId);
  }

  // Sync room state to Redis
  async syncRoomToRedis(roomId) {
    if (!this.redisState.isAvailable) return;

    try {
      const room = this.roomState.get(roomId);
      const participants = Array.from(room.keys());

      await this.redisState.set('ROOM', roomId, {
        participants,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error(`❌ Error syncing room ${roomId} to Redis:`, error);
    }
  }

  getRoomState(roomId) {
    return this.roomState.get(roomId);
  }

  getRoomParticipants(roomId) {
    const room = this.roomState.get(roomId);
    return room ? Array.from(room.keys()) : [];
  }

  // User Management with Redis sync
  setUserSocket(userId, socketId) {
    this.userToSocket.set(userId, socketId);
    this.socketToUser.set(socketId, userId);

    // Sync to Redis
    this.syncUserToRedis(userId);
  }

  // Sync user to Redis
  async syncUserToRedis(userId) {
    if (!this.redisState.isAvailable) return;

    try {
      const userData = this.userInfo.get(userId);
      if (userData) {
        await this.redisState.set('USER', userId, {
          ...userData,
          lastSeen: Date.now(),
        });
      }
    } catch (error) {
      console.error(`❌ Error syncing user ${userId} to Redis:`, error);
    }
  }

  getUserSocket(userId) {
    return this.userToSocket.get(userId);
  }

  getUserBySocket(socketId) {
    return this.socketToUser.get(socketId);
  }

  setUserInfo(userId, info) {
    this.userInfo.set(userId, info);

    // Sync to Redis
    this.syncUserToRedis(userId);
  }

  getUserInfo(userId) {
    return this.userInfo.get(userId);
  }

  // Media State Management
  setUserMediaState(roomId, userId, mediaState) {
    const room = this.roomState.get(roomId);
    if (room) {
      room.set(userId, mediaState);
      // Sync room to Redis
      this.syncRoomToRedis(roomId);
    }
  }

  getUserMediaState(roomId, userId) {
    const room = this.roomState.get(roomId);
    return room ? room.get(userId) : null;
  }

  // Connection Management
  setConnection(key, connection) {
    this.activeConnections.set(key, {
      ...connection,
      timestamp: Date.now(),
    });
  }

  getConnection(key) {
    return this.activeConnections.get(key);
  }

  deleteConnection(key) {
    this.activeConnections.delete(key);
  }

  getUserConnections(userId) {
    const connections = [];
    for (const [key, connection] of this.activeConnections.entries()) {
      if (connection.users.includes(userId)) {
        connections.push({ key, ...connection });
      }
    }
    return connections;
  }

  // Cleanup old connections
  cleanupOldConnections(timeoutMs = 60000) {
    const cutoff = Date.now() - timeoutMs;
    for (const [key, connection] of this.activeConnections.entries()) {
      if (connection.timestamp < cutoff) {
        this.activeConnections.delete(key);
      }
    }
  }

  // Enhanced connection management with Redis (optimized)
  async setConnectionWithRecovery(key, connection) {
    // Set connection in memory
    this.setConnection(key, connection);

    // Store connection metadata in Redis for recovery (optimized)
    if (this.redisState.isAvailable) {
      try {
        // Use batch operation for better performance
        const operations = [
          {
            type: 'set',
            key: `conn_meta:${key}`,
            value: {
              users: connection.users,
              status: connection.status,
              createdAt: connection.timestamp,
              lastActivity: Date.now(),
            },
            ttl: 1800, // 30 minutes
          },
          {
            type: 'custom',
            command: (pipeline) => {
              pipeline.incr(`CONNECTION_COUNT:total:${key}`);
              pipeline.expire(`CONNECTION_COUNT:total:${key}`, 3600);
            },
          },
        ];

        await this.redisState.batchOperation(operations);
      } catch (error) {
        console.error(
          `❌ Error storing connection metadata for ${key}:`,
          error
        );
      }
    }
  }

  // Attempt connection recovery from Redis
  async attemptConnectionRecovery(key) {
    if (!this.redisState.isAvailable) return false;

    try {
      const metadata = await this.redisState.getConnectionMetadata(key);
      if (metadata) {
        // Check if users are still active
        const activeUsers = [];
        for (const userId of metadata.users) {
          if (this.userToSocket.has(userId)) {
            activeUsers.push(userId);
          }
        }

        if (activeUsers.length > 0) {
          // Recreate connection with active users
          const recoveredConnection = {
            users: activeUsers,
            status: 'recovered',
            timestamp: Date.now(),
            recoveredAt: Date.now(),
          };

          this.setConnection(key, recoveredConnection);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error(
        `❌ Error attempting connection recovery for ${key}:`,
        error
      );
      return false;
    }
  }

  // Get connection health status
  async getConnectionHealth(key) {
    if (!this.redisState.isAvailable) return null;

    try {
      return await this.redisState.getConnectionHealth(key);
    } catch (error) {
      console.error(`❌ Error getting connection health for ${key}:`, error);
      return null;
    }
  }

  // Get all connection health data
  async getAllConnectionHealth() {
    if (!this.redisState.isAvailable) return [];

    try {
      const healthData = [];
      for (const [key, connection] of this.activeConnections.entries()) {
        const health = await this.redisState.getConnectionHealth(key);
        if (health) {
          healthData.push(health);
        }
      }
      return healthData;
    } catch (error) {
      console.error('❌ Error getting all connection health data:', error);
      return [];
    }
  }

  // Screen Sharing Management with Redis sync
  setScreenSharing(roomId, userId) {
    this.screenSharingState.set(roomId, userId);

    // Sync to Redis
    this.syncScreenShareToRedis(roomId);
  }

  stopScreenSharing(roomId) {
    this.screenSharingState.set(roomId, null);

    // Sync to Redis
    this.syncScreenShareToRedis(roomId);
  }

  // Sync screen sharing to Redis
  async syncScreenShareToRedis(roomId) {
    if (!this.redisState.isAvailable) return;

    try {
      const state = this.screenSharingState.get(roomId);
      if (state) {
        await this.redisState.set('SCREEN_SHARE', roomId, {
          ...state,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error(
        `❌ Error syncing screen share for room ${roomId} to Redis:`,
        error
      );
    }
  }

  getScreenSharing(roomId) {
    return this.screenSharingState.get(roomId);
  }

  // Collaboration State Management with Redis sync
  setCollaborationState(roomId, state) {
    this.collaborationState.set(roomId, state);

    // Sync to Redis
    this.syncCollaborationToRedis(roomId);
  }

  updateCollaborationMode(roomId, mode, userId) {
    const state = this.collaborationState.get(roomId);
    if (state) {
      state.mode = mode;
      state.activeTool = mode;
      if (mode === 'none') {
        state.presenter = {
          userId: null,
          mode: null,
          collaborationSettings: {
            mode: 'allow-edit',
            allowedUsers: [],
          },
        };
      } else {
        state.presenter = {
          userId,
          mode,
          collaborationSettings: {
            mode: 'allow-edit',
            allowedUsers: [],
          },
        };
      }

      // Sync to Redis
      this.syncCollaborationToRedis(roomId);
    }
    return state;
  }

  // Sync collaboration to Redis
  async syncCollaborationToRedis(roomId) {
    if (!this.redisState.isAvailable) return;

    try {
      const state = this.collaborationState.get(roomId);
      if (state) {
        await this.redisState.set('COLLABORATION', roomId, {
          ...state,
          lastUpdated: Date.now(),
        });
      }
    } catch (error) {
      console.error(
        `❌ Error syncing collaboration for room ${roomId} to Redis:`,
        error
      );
    }
  }

  getCollaborationState(roomId) {
    return this.collaborationState.get(roomId);
  }

  updateCollaborationSettings(roomId, settings, userId) {
    const state = this.collaborationState.get(roomId);
    if (state && state.presenter && state.presenter.userId === userId) {
      state.presenter.collaborationSettings = settings;
      // Sync to Redis
      this.syncCollaborationToRedis(roomId);
      return true;
    }
    return false;
  }

  // Get collaboration state
  getCollaborationState(roomId) {
    return this.collaborationState.get(roomId);
  }

  // Workflow Data Management with Redis sync
  updateWorkflowData(roomId, data, userId) {
    const state = this.collaborationState.get(roomId);
    if (state) {
      state.workflowData = {
        ...data,
        lastModified: Date.now(),
        lastModifiedBy: userId,
      };
      // Sync to Redis
      this.syncCollaborationToRedis(roomId);
    }
    return state?.workflowData;
  }

  // Whiteboard Data Management with Redis sync
  updateWhiteboardData(roomId, data, userId) {
    const state = this.collaborationState.get(roomId);
    if (state) {
      state.whiteboardData = {
        ...data,
        lastModified: new Date(),
        lastModifiedBy: userId,
      };
      // Sync to Redis
      this.syncCollaborationToRedis(roomId);
    }
    return state?.whiteboardData;
  }

  // Permission Checks
  canEdit(roomId, userId) {
    const state = this.collaborationState.get(roomId);
    if (!state || !state.presenter) return true;

    const isPresenter = state.presenter.userId === userId;
    const settings = state.presenter.collaborationSettings;

    return (
      isPresenter ||
      settings.mode === 'allow-edit' ||
      (settings.mode === 'selective-edit' &&
        settings.allowedUsers.includes(userId))
    );
  }

  isPresenter(roomId, userId) {
    const state = this.collaborationState.get(roomId);
    return state?.presenter?.userId === userId;
  }

  // Cleanup with Redis sync
  cleanupUser(userId, socketId) {
    this.userToSocket.delete(userId);
    this.socketToUser.delete(socketId);
    this.userInfo.delete(userId);

    // Clean up user's connections
    for (const [key, connection] of this.activeConnections.entries()) {
      if (connection.users.includes(userId)) {
        this.activeConnections.delete(key);
      }
    }

    // Remove user from all rooms
    for (const [roomId, room] of this.roomState.entries()) {
      if (room.has(userId)) {
        room.delete(userId);
        if (room.size === 0) {
          this.cleanupRoom(roomId);
        } else {
          // Sync room to Redis
          this.syncRoomToRedis(roomId);
        }
      }
    }

    // Remove user from Redis
    this.removeUserFromRedis(userId);
  }

  // Remove user from Redis
  async removeUserFromRedis(userId) {
    if (!this.redisState.isAvailable) return;

    try {
      await this.redisState.delete('USER', userId);
    } catch (error) {
      console.error(`❌ Error removing user ${userId} from Redis:`, error);
    }
  }

  cleanupRoom(roomId) {
    this.roomState.delete(roomId);
    this.screenSharingState.delete(roomId);
    this.collaborationState.delete(roomId);
    this.tldrawRooms.delete(roomId);

    // Remove room from Redis
    this.removeRoomFromRedis(roomId);
  }

  // Remove room from Redis
  async removeRoomFromRedis(roomId) {
    if (!this.redisState.isAvailable) return;

    try {
      await this.redisState.delete('ROOM', roomId);
      await this.redisState.delete('COLLABORATION', roomId);
      await this.redisState.delete('SCREEN_SHARE', roomId);
    } catch (error) {
      console.error(`❌ Error removing room ${roomId} from Redis:`, error);
    }
  }

  // Validation
  isValidRoom(roomId) {
    return this.roomState.has(roomId);
  }

  isUserInRoom(roomId, userId) {
    const room = this.roomState.get(roomId);
    return room ? room.has(userId) : false;
  }

  // Check if user is presenter
  isPresenter(roomId, userId) {
    const state = this.collaborationState.get(roomId);
    return state?.presenter?.userId === userId;
  }

  // Check if user can edit
  canEdit(roomId, userId) {
    const state = this.collaborationState.get(roomId);
    if (!state || !state.presenter) return true;

    const isPresenter = state.presenter.userId === userId;
    const settings = state.presenter.collaborationSettings;

    return (
      isPresenter ||
      settings.mode === 'allow-edit' ||
      (settings.mode === 'selective-edit' &&
        settings.allowedUsers.includes(userId))
    );
  }

  // Tldraw Room Management
  setTldrawRoom(roomId, room) {
    this.tldrawRooms.set(roomId, room);
  }

  getTldrawRoom(roomId) {
    return this.tldrawRooms.get(roomId);
  }

  deleteTldrawRoom(roomId) {
    this.tldrawRooms.delete(roomId);
  }

  // Get Redis statistics
  async getRedisStats() {
    return await this.redisState.getStats();
  }

  // Get room statistics for health endpoint
  getRoomStats() {
    return {
      totalRooms: this.roomState.size,
      totalUsers: this.userInfo.size,
      totalConnections: this.activeConnections.size,
      totalTldrawRooms: this.tldrawRooms.size,
    };
  }

  // Get performance metrics
  async getPerformanceMetrics() {
    try {
      const metrics = {
        memory: {
          roomState: this.roomState.size,
          userInfo: this.userInfo.size,
          activeConnections: this.activeConnections.size,
          screenSharingState: this.screenSharingState.size,
          collaborationState: this.collaborationState.size,
          tldrawRooms: this.tldrawRooms.size,
        },
        operations: {
          syncOperations: this.syncOperations || 0,
          lastSyncTime: this.lastSyncTime || null,
          averageSyncTime: this.averageSyncTime || 0,
        },
        redis: await this.redisState.getPerformanceMetrics(),
        timestamp: Date.now(),
      };

      return metrics;
    } catch (error) {
      console.error('❌ Error getting performance metrics:', error);
      return { error: error.message };
    }
  }

  // Get error recovery metrics
  async getErrorRecoveryMetrics() {
    try {
      const metrics = {
        redisErrors: this.redisState.getErrorMetrics(),
        recoveryAttempts: this.recoveryAttempts || 0,
        lastRecoveryTime: this.lastRecoveryTime || null,
        successfulRecoveries: this.successfulRecoveries || 0,
        failedRecoveries: this.failedRecoveries || 0,
        timestamp: Date.now(),
      };

      return metrics;
    } catch (error) {
      console.error('❌ Error getting error recovery metrics:', error);
      return { error: error.message };
    }
  }

  // Attempt error recovery
  async attemptErrorRecovery() {
    try {
      if (!this.recoveryAttempts) this.recoveryAttempts = 0;
      if (!this.successfulRecoveries) this.successfulRecoveries = 0;
      if (!this.failedRecoveries) this.failedRecoveries = 0;

      this.recoveryAttempts++;
      this.lastRecoveryTime = Date.now();

      // Check Redis availability
      if (this.redisState.isAvailable) {
        // Try to sync state to Redis
        await this.syncToRedis();
        this.successfulRecoveries++;
        return true;
      } else {
        // Try to reconnect Redis
        await this.redisState.checkAvailability();
        if (this.redisState.isAvailable) {
          this.successfulRecoveries++;
          return true;
        } else {
          this.failedRecoveries++;
          return false;
        }
      }
    } catch (error) {
      this.failedRecoveries++;
      console.error('❌ Error during recovery attempt:', error);
      return false;
    }
  }

  // Track sync operation performance
  async trackSyncOperation(operation, startTime) {
    const duration = Date.now() - startTime;

    if (!this.syncOperations) this.syncOperations = 0;
    if (!this.lastSyncTime) this.lastSyncTime = null;
    if (!this.averageSyncTime) this.averageSyncTime = 0;

    this.syncOperations++;
    this.lastSyncTime = Date.now();
    this.averageSyncTime =
      (this.averageSyncTime * (this.syncOperations - 1) + duration) /
      this.syncOperations;

    return duration;
  }

  // Cleanup Redis
  async cleanupRedis() {
    await this.redisState.cleanup();
  }

  // Graceful shutdown
  async shutdown() {
    this.stopSyncInterval();
    await this.syncToRedis();
    await this.cleanupRedis();
  }
}
