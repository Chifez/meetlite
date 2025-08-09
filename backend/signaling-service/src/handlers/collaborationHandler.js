import { applyWorkflowOperation } from '../../controllers/workflow-controller.js';

export class CollaborationHandler {
  constructor(io, stateManager) {
    this.io = io;
    this.stateManager = stateManager;
  }

  handleCollaborationMode(socket, { roomId, mode }) {
    // Validate room
    if (!this.stateManager.isValidRoom(roomId)) {
      return;
    }

    // Update collaboration state
    const updatedState = this.stateManager.updateCollaborationMode(
      roomId,
      mode,
      socket.user.userId
    );
    if (updatedState) {
      // Broadcast mode change to all clients
      this.io.to(roomId).emit('collaboration:mode-changed', {
        mode,
        activeTool: mode,
        presenter: updatedState.presenter,
        changedBy: socket.user.userId,
        timestamp: Date.now(),
      });
    }
  }

  handleToolChange(socket, { roomId, tool }) {
    const collabState = this.stateManager.getCollaborationState(roomId);
    if (collabState && collabState.mode !== 'none') {
      collabState.activeTool = tool;

      this.io.to(roomId).emit('collaboration:tool-changed', {
        tool,
        changedBy: socket.user.userId,
        timestamp: Date.now(),
      });
    }
  }

  handlePresenterSettings(socket, { roomId, settings }) {
    // Validate room and presenter status
    if (
      !this.stateManager.isValidRoom(roomId) ||
      !this.stateManager.isPresenter(roomId, socket.user.userId)
    ) {
      return;
    }

    // Update settings
    if (
      this.stateManager.updateCollaborationSettings(
        roomId,
        settings,
        socket.user.userId
      )
    ) {
      // Broadcast settings update
      this.io.to(roomId).emit('collaboration:settings-changed', {
        settings,
        changedBy: socket.user.userId,
        timestamp: Date.now(),
      });
    }
  }

  handleStateRequest(socket, { roomId }) {
    const state = this.stateManager.getCollaborationState(roomId);
    if (state) {
      socket.emit('collaboration:state', state);
    }
  }

  validateEditPermission(roomId, userId) {
    return this.stateManager.canEdit(roomId, userId);
  }

  setupSocketHandlers(socket) {
    socket.on('collaboration:mode', (data) =>
      this.handleCollaborationMode(socket, data)
    );
    socket.on('collaboration:tool', (data) =>
      this.handleToolChange(socket, data)
    );
    socket.on('presentation:settings', (data) =>
      this.handlePresenterSettings(socket, data)
    );
    socket.on('collaboration:request-state', (data) =>
      this.handleStateRequest(socket, data)
    );
  }
}
