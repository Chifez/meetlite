// State management for rooms and users
export class StateManager {
  constructor() {
    this.roomState = new Map();
    this.userToSocket = new Map();
    this.socketToUser = new Map();
    this.activeConnections = new Map();
    this.screenSharingState = new Map();
    this.userInfo = new Map();
    this.collaborationState = new Map();
    this.tldrawRooms = new Map();
  }

  // Room Management
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
    }
    return this.roomState.get(roomId);
  }

  getRoomState(roomId) {
    return this.roomState.get(roomId);
  }

  getRoomParticipants(roomId) {
    const room = this.roomState.get(roomId);
    return room ? Array.from(room.keys()) : [];
  }

  // User Management
  setUserSocket(userId, socketId) {
    this.userToSocket.set(userId, socketId);
    this.socketToUser.set(socketId, userId);
  }

  getUserSocket(userId) {
    return this.userToSocket.get(userId);
  }

  getUserBySocket(socketId) {
    return this.socketToUser.get(socketId);
  }

  setUserInfo(userId, info) {
    this.userInfo.set(userId, info);
  }

  getUserInfo(userId) {
    return this.userInfo.get(userId);
  }

  setUserMediaState(roomId, userId, mediaState) {
    const room = this.roomState.get(roomId);
    if (room) {
      room.set(userId, mediaState);
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

  cleanupOldConnections(timeoutMs = 60000) {
    const cutoff = Date.now() - timeoutMs;
    for (const [key, connection] of this.activeConnections.entries()) {
      if (connection.timestamp < cutoff) {
        this.activeConnections.delete(key);
      }
    }
  }

  // Screen Sharing
  setScreenSharing(roomId, userId) {
    this.screenSharingState.set(roomId, userId);
  }

  getScreenSharing(roomId) {
    return this.screenSharingState.get(roomId);
  }

  stopScreenSharing(roomId) {
    this.screenSharingState.set(roomId, null);
  }

  // Collaboration State
  getCollaborationState(roomId) {
    return this.collaborationState.get(roomId);
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
    }
    return state;
  }

  updateCollaborationSettings(roomId, settings, userId) {
    const state = this.collaborationState.get(roomId);
    if (state && state.presenter && state.presenter.userId === userId) {
      state.presenter.collaborationSettings = settings;
      return true;
    }
    return false;
  }

  // Workflow Data
  updateWorkflowData(roomId, data, userId) {
    const state = this.collaborationState.get(roomId);
    if (state) {
      state.workflowData = {
        ...data,
        lastModified: Date.now(),
        lastModifiedBy: userId,
      };
    }
    return state?.workflowData;
  }

  // Whiteboard Data
  updateWhiteboardData(roomId, data, userId) {
    const state = this.collaborationState.get(roomId);
    if (state) {
      state.whiteboardData = {
        ...data,
        lastModified: new Date(),
        lastModifiedBy: userId,
      };
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

  // Cleanup
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
        }
      }
    }
  }

  cleanupRoom(roomId) {
    this.roomState.delete(roomId);
    this.screenSharingState.delete(roomId);
    this.collaborationState.delete(roomId);
    this.tldrawRooms.delete(roomId);
  }

  // Validation
  isValidRoom(roomId) {
    return this.roomState.has(roomId);
  }

  isUserInRoom(roomId, userId) {
    const room = this.roomState.get(roomId);
    return room ? room.has(userId) : false;
  }
}
