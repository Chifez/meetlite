import { logger } from '../utils/logger.js';
import { applyWorkflowOperation } from './workflow-controller.js';

/**
 * CollaborationController - Handles all chat and collaboration-related Socket.IO events
 * Extracted from index.js for better separation of concerns
 */
export class CollaborationController {
  constructor(mediaSoupService, collaborationStateManager, io) {
    this.mediaSoupService = mediaSoupService;
    this.collaborationStateManager = collaborationStateManager;
    this.io = io;
  }

  /**
   * Handle chat message
   */
  async handleChatMessage(socket, data) {
    try {
      const { roomId, message, timestamp, type = 'text' } = data;
      const userId = socket.user.userId;

      if (!roomId || !message || message.trim().length === 0) {
        return;
      }

      // Verify user is in room
      if (!socket.rooms.has(roomId)) {
        return;
      }

      // Update participant activity
      await this.mediaSoupService.updateParticipantActivity(roomId, userId);

      // Broadcast message to all users in room (including sender for confirmation)
      this.io.to(roomId).emit('chat:message', {
        userId,
        userEmail: socket.user.email,
        message: message.trim(),
        timestamp,
        type,
      });

      logger.info('Chat message sent', {
        roomId,
        userId,
        messageLength: message.trim().length,
      });
    } catch (error) {
      logger.error('Failed to handle chat message', error);
    }
  }

  /**
   * Handle typing start
   */
  async handleTypingStart(socket, data) {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Update participant activity
      await this.mediaSoupService.updateParticipantActivity(roomId, userId);

      // Broadcast typing indicator to others (not to sender)
      socket.to(roomId).emit('chat:typing-start', {
        userId,
        userEmail: socket.user.email,
      });

      logger.debug('Typing started', { roomId, userId });
    } catch (error) {
      logger.error('Failed to handle typing start', error);
    }
  }

  /**
   * Handle typing stop
   */
  async handleTypingStop(socket, data) {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Update participant activity
      await this.mediaSoupService.updateParticipantActivity(roomId, userId);

      // Broadcast stop typing to others (not to sender)
      socket.to(roomId).emit('chat:typing-stop', {
        userId,
      });

      logger.debug('Typing stopped', { roomId, userId });
    } catch (error) {
      logger.error('Failed to handle typing stop', error);
    }
  }

  /**
   * Handle collaboration mode change
   */
  async handleCollaborationMode(socket, data) {
    try {
      const { roomId, mode } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Update participant activity
      await this.mediaSoupService.updateParticipantActivity(roomId, userId);

      // Update collaboration state
      const updatedState =
        this.collaborationStateManager.updateCollaborationMode(
          roomId,
          mode,
          userId
        );

      // Broadcast mode change with proper state to all clients
      this.io.to(roomId).emit('collaboration:mode-changed', {
        mode,
        activeTool: mode,
        presenter: updatedState.presenter,
        changedBy: userId,
        timestamp: Date.now(),
      });

      logger.info('Collaboration mode changed', {
        roomId,
        userId,
        mode,
      });
    } catch (error) {
      logger.error('Failed to handle collaboration mode change', error);
    }
  }

  /**
   * Handle collaboration tool change
   */
  async handleCollaborationTool(socket, data) {
    try {
      const { roomId, tool } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Update participant activity
      await this.mediaSoupService.updateParticipantActivity(roomId, userId);

      // Broadcast tool change to all clients
      this.io.to(roomId).emit('collaboration:tool-changed', {
        tool,
        changedBy: userId,
        timestamp: Date.now(),
      });

      logger.info('Collaboration tool changed', {
        roomId,
        userId,
        tool,
      });
    } catch (error) {
      logger.error('Failed to handle collaboration tool change', error);
    }
  }

  /**
   * Handle presentation settings
   */
  async handlePresentationSettings(socket, data) {
    try {
      const { roomId, settings } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Update participant activity
      await this.mediaSoupService.updateParticipantActivity(roomId, userId);

      // Update collaboration settings
      const success =
        this.collaborationStateManager.updateCollaborationSettings(
          roomId,
          settings,
          userId
        );

      if (success) {
        // Broadcast settings update to all clients
        this.io.to(roomId).emit('collaboration:settings-changed', {
          settings,
          changedBy: userId,
          timestamp: Date.now(),
        });

        logger.info('Presentation settings updated', {
          roomId,
          userId,
          settings,
        });
      } else {
        logger.warn(
          'Failed to update presentation settings - user not authorized',
          {
            roomId,
            userId,
          }
        );
      }
    } catch (error) {
      logger.error('Failed to handle presentation settings', error);
    }
  }

  /**
   * Handle collaboration state request
   */
  async handleCollaborationStateRequest(socket, data) {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Get current collaboration state
      const state =
        this.collaborationStateManager.getCollaborationState(roomId);

      socket.emit('collaboration:state', state);

      logger.debug('Collaboration state requested', {
        roomId,
        userId,
        mode: state.mode,
      });
    } catch (error) {
      logger.error('Failed to handle collaboration state request', error);
    }
  }

  /**
   * Handle workflow operation
   */
  async handleWorkflowOperation(socket, data) {
    try {
      const { roomId, operation } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Get current collaboration state
      const collabState =
        this.collaborationStateManager.getCollaborationState(roomId);

      // Validate mode
      if (!collabState || collabState.mode !== 'workflow') {
        logger.warn('Workflow operation rejected - not in workflow mode', {
          roomId,
          userId,
          operationType: operation.type,
          currentMode: collabState?.mode,
        });
        return;
      }

      // Check if user can edit
      if (!this.collaborationStateManager.canEdit(roomId, userId)) {
        logger.warn('Workflow operation rejected - user not authorized', {
          roomId,
          userId,
          operationType: operation.type,
        });
        return;
      }

      // Update participant activity
      await this.mediaSoupService.updateParticipantActivity(roomId, userId);

      // Initialize workflow data if needed
      if (!collabState.workflowData) {
        collabState.workflowData = {
          nodes: [],
          edges: [],
          version: 0,
          lastModified: new Date(),
          lastModifiedBy: userId,
        };
      }

      // Apply operation to current workflow data
      const newWorkflowData = applyWorkflowOperation(
        collabState.workflowData,
        operation
      );

      // Update state with new workflow data
      const updatedData = this.collaborationStateManager.updateWorkflowData(
        roomId,
        {
          ...newWorkflowData,
          version: (collabState.workflowData.version || 0) + 1,
        },
        userId
      );

      // Broadcast workflow operation to all clients including sender for confirmation
      this.io.to(roomId).emit('workflow:operation', {
        operation,
        userId,
        timestamp: Date.now(),
        version: updatedData.version,
      });

      logger.info('Workflow operation applied', {
        roomId,
        userId,
        operationType: operation.type,
        version: updatedData.version,
        nodesCount: newWorkflowData.nodes?.length || 0,
        edgesCount: newWorkflowData.edges?.length || 0,
      });
    } catch (error) {
      logger.error('Failed to handle workflow operation', error);
      socket.emit('error', {
        message: 'Failed to apply workflow operation',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle workflow awareness update (cursor position, active node)
   */
  async handleWorkflowAwareness(socket, data) {
    try {
      const { roomId, cursor, activeNodeId, isActive } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Broadcast awareness update to all other users in room (not sender)
      socket.to(roomId).emit('workflow:awareness', {
        userId,
        userName: socket.user.name || socket.user.email,
        userEmail: socket.user.email,
        cursor,
        activeNodeId,
        isActive,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('Failed to handle workflow awareness', error);
    }
  }

  /**
   * Handle workflow sync request
   */
  async handleWorkflowSyncRequest(socket, data) {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Get current collaboration state
      const state =
        this.collaborationStateManager.getCollaborationState(roomId);

      socket.emit('workflow:state-sync', state);

      logger.debug('Workflow state sync requested', {
        roomId,
        userId,
        mode: state.mode,
        hasWorkflowData: !!state.workflowData,
      });
    } catch (error) {
      logger.error('Failed to handle workflow state sync request', error);
    }
  }

  /**
   * Handle whiteboard update
   */
  async handleWhiteboardUpdate(socket, data) {
    try {
      const { roomId, update } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Check if user can edit
      if (!this.collaborationStateManager.canEdit(roomId, userId)) {
        logger.warn('Whiteboard update rejected - user not authorized', {
          roomId,
          userId,
        });
        return;
      }

      // Update participant activity
      await this.mediaSoupService.updateParticipantActivity(roomId, userId);

      // Update whiteboard data
      const updatedData = this.collaborationStateManager.updateWhiteboardData(
        roomId,
        {
          ...update,
          version: update.version || 1,
        },
        userId
      );

      // Broadcast whiteboard update to all clients
      this.io.to(roomId).emit('whiteboard:update', {
        update,
        userId,
        timestamp: Date.now(),
        version: updatedData.version,
      });

      logger.info('Whiteboard update', {
        roomId,
        userId,
        updateVersion: updatedData.version,
      });
    } catch (error) {
      logger.error('Failed to handle whiteboard update', error);
    }
  }

  /**
   * Handle whiteboard sync request
   */
  async handleWhiteboardSyncRequest(socket, data) {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Get current collaboration state
      const state =
        this.collaborationStateManager.getCollaborationState(roomId);

      // Send whiteboard data specifically
      socket.emit(
        'whiteboard:state-sync',
        state.whiteboardData || {
          version: 0,
          data: null,
          lastModified: new Date(),
          lastModifiedBy: null,
        }
      );

      logger.debug('Whiteboard state sync requested', {
        roomId,
        userId,
        hasWhiteboardData: !!state.whiteboardData,
      });
    } catch (error) {
      logger.error('Failed to handle whiteboard state sync request', error);
    }
  }

  /**
   * Handle code update
   */
  async handleCodeUpdate(socket, data) {
    try {
      const { roomId, update } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Check if user can edit
      if (!this.collaborationStateManager.canEdit(roomId, userId)) {
        logger.warn('Code update rejected - user not authorized', {
          roomId,
          userId,
        });
        return;
      }

      // Update participant activity
      await this.mediaSoupService.updateParticipantActivity(roomId, userId);

      // Update code data
      const updatedData = this.collaborationStateManager.updateCodeData(
        roomId,
        {
          ...update,
          version: update.version || 1,
        },
        userId
      );

      // Broadcast code update to all clients
      this.io.to(roomId).emit('code:update', {
        update,
        userId,
        timestamp: Date.now(),
        version: updatedData.version,
      });

      logger.info('Code update', {
        roomId,
        userId,
        updateVersion: updatedData.version,
        language: update.language,
      });
    } catch (error) {
      logger.error('Failed to handle code update', error);
    }
  }

  /**
   * Handle code language change
   */
  async handleCodeLanguageChange(socket, data) {
    try {
      const { roomId, language, userId: requestUserId, timestamp } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Check if user can edit
      if (!this.collaborationStateManager.canEdit(roomId, userId)) {
        logger.warn('Code language change rejected - user not authorized', {
          roomId,
          userId,
        });
        return;
      }

      // Update participant activity
      await this.mediaSoupService.updateParticipantActivity(roomId, userId);

      // Change code language
      const updatedData = this.collaborationStateManager.changeCodeLanguage(
        roomId,
        language,
        userId
      );

      // Broadcast language change to all clients
      this.io.to(roomId).emit('code:language-change', {
        language,
        userId,
        timestamp: timestamp || Date.now(),
      });

      logger.info('Code language changed', {
        roomId,
        userId,
        language,
      });
    } catch (error) {
      logger.error('Failed to handle code language change', error);
    }
  }

  /**
   * Handle code sync request
   */
  async handleCodeSyncRequest(socket, data) {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Get current collaboration state
      const state =
        this.collaborationStateManager.getCollaborationState(roomId);

      // Send code data specifically
      socket.emit(
        'code:state-sync',
        state.codeData || {
          code: '',
          language: 'javascript',
          version: 0,
          lastModified: new Date(),
          lastModifiedBy: null,
        }
      );

      logger.debug('Code state sync requested', {
        roomId,
        userId,
        hasCodeData: !!state.codeData,
      });
    } catch (error) {
      logger.error('Failed to handle code state sync request', error);
    }
  }

  /**
   * Handle presentation start
   */
  async handlePresentationStart(socket, data) {
    try {
      const { roomId, mode } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Update participant activity
      await this.mediaSoupService.updateParticipantActivity(roomId, userId);

      // Update collaboration mode
      const updatedState =
        this.collaborationStateManager.updateCollaborationMode(
          roomId,
          mode,
          userId
        );

      // Broadcast presentation start to all clients
      this.io.to(roomId).emit('collaboration:mode-changed', {
        mode,
        activeTool: mode,
        presenter: updatedState.presenter,
        changedBy: userId,
        timestamp: Date.now(),
      });

      logger.info('Presentation started', {
        roomId,
        userId,
        mode,
      });
    } catch (error) {
      logger.error('Failed to handle presentation start', error);
    }
  }

  /**
   * Handle presentation stop
   */
  async handlePresentationStop(socket, data) {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Update participant activity
      await this.mediaSoupService.updateParticipantActivity(roomId, userId);

      // Update collaboration mode to none
      const updatedState =
        this.collaborationStateManager.updateCollaborationMode(
          roomId,
          'none',
          userId
        );

      // Broadcast presentation stop to all clients
      this.io.to(roomId).emit('collaboration:mode-changed', {
        mode: 'none',
        activeTool: 'none',
        presenter: updatedState.presenter,
        changedBy: userId,
        timestamp: Date.now(),
      });

      logger.info('Presentation stopped', {
        roomId,
        userId,
      });
    } catch (error) {
      logger.error('Failed to handle presentation stop', error);
    }
  }

  /**
   * Handle collaboration state request (for users joining room)
   */
  async handleCollaborationStateRequest(socket, data) {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      logger.debug('Collaboration state requested', { roomId, userId });

      // Get current collaboration state
      const collaborationState =
        this.collaborationStateManager.getCollaborationState(roomId);

      // Get screen sharing state from MediaSoup service
      let screenSharingUserId = null;
      try {
        const screenShareInfo = this.mediaSoupService.getScreenSharing(roomId);
        if (screenShareInfo && screenShareInfo.userId) {
          screenSharingUserId = screenShareInfo.userId;
        }
      } catch (error) {
        logger.warn('Failed to get screen sharing state', { error });
      }

      // Send complete state to requesting user
      socket.emit('collaboration:state', {
        mode: collaborationState?.mode || 'none',
        activeTool: collaborationState?.activeTool || 'none',
        presenter: collaborationState?.presenter || null,
        screenSharingUserId,
        workflowData: collaborationState?.workflowData || null,
        whiteboardData: collaborationState?.whiteboardData || null,
        codeData: collaborationState?.codeData || null,
        timestamp: Date.now(),
      });

      logger.debug('Collaboration state sent', {
        roomId,
        userId,
        mode: collaborationState?.mode,
      });
    } catch (error) {
      logger.error('Failed to handle collaboration state request', {
        error: error.message,
        stack: error.stack,
      });
    }
  }
}
