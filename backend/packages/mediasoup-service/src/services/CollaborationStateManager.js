import { logger } from '../utils/logger.js';

/**
 * Simple in-memory collaboration state manager for MediaSoup service
 * In a production environment, this would integrate with Redis or database
 */
export class CollaborationStateManager {
  constructor() {
    this.collaborationState = new Map();
    logger.info('CollaborationStateManager initialized');
  }

  /**
   * Initialize collaboration state for a room
   */
  initializeRoom(roomId) {
    if (!this.collaborationState.has(roomId)) {
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
        lastUpdated: Date.now(),
      });

      logger.debug('Collaboration state initialized for room', { roomId });
    }
  }

  /**
   * Get collaboration state for a room
   */
  getCollaborationState(roomId) {
    this.initializeRoom(roomId);
    return this.collaborationState.get(roomId);
  }

  /**
   * Update collaboration mode
   */
  updateCollaborationMode(roomId, mode, userId) {
    this.initializeRoom(roomId);
    const state = this.collaborationState.get(roomId);

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

    state.lastUpdated = Date.now();

    logger.info('Collaboration mode updated', {
      roomId,
      userId,
      mode,
    });

    return state;
  }

  /**
   * Update collaboration settings
   */
  updateCollaborationSettings(roomId, settings, userId) {
    this.initializeRoom(roomId);
    const state = this.collaborationState.get(roomId);

    if (state.presenter && state.presenter.userId === userId) {
      state.presenter.collaborationSettings = settings;
      state.lastUpdated = Date.now();

      logger.info('Collaboration settings updated', {
        roomId,
        userId,
        settings,
      });

      return true;
    }

    return false;
  }

  /**
   * Update workflow data
   */
  updateWorkflowData(roomId, data, userId) {
    this.initializeRoom(roomId);
    const state = this.collaborationState.get(roomId);

    state.workflowData = {
      ...data,
      lastModified: new Date(),
      lastModifiedBy: userId,
    };
    state.lastUpdated = Date.now();

    logger.debug('Workflow data updated', {
      roomId,
      userId,
      version: data.version,
    });

    return state.workflowData;
  }

  /**
   * Update whiteboard data
   */
  updateWhiteboardData(roomId, data, userId) {
    this.initializeRoom(roomId);
    const state = this.collaborationState.get(roomId);

    state.whiteboardData = {
      ...data,
      lastModified: new Date(),
      lastModifiedBy: userId,
    };
    state.lastUpdated = Date.now();

    logger.debug('Whiteboard data updated', {
      roomId,
      userId,
      version: data.version,
    });

    return state.whiteboardData;
  }

  /**
   * Check if user can edit
   */
  canEdit(roomId, userId) {
    const state = this.collaborationState.get(roomId);
    if (!state) return true; // Default to allowing edit if no state

    // If no presenter, everyone can edit
    if (!state.presenter.userId) return true;

    // If user is the presenter, they can always edit
    if (userId === state.presenter.userId) return true;

    const { mode, allowedUsers } = state.presenter.collaborationSettings;

    switch (mode) {
      case 'view-only':
        return false;
      case 'allow-edit':
        return true;
      case 'selective-edit':
        return allowedUsers.includes(userId);
      default:
        return true;
    }
  }

  /**
   * Remove room state (cleanup)
   */
  removeRoom(roomId) {
    this.collaborationState.delete(roomId);
    logger.debug('Collaboration state removed for room', { roomId });
  }

  /**
   * Get all rooms with collaboration state
   */
  getAllRooms() {
    return Array.from(this.collaborationState.keys());
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      totalRooms: this.collaborationState.size,
      rooms: this.getAllRooms(),
    };
  }
}
