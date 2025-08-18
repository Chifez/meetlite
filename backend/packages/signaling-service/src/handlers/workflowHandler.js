import { applyWorkflowOperation } from '../../controllers/workflow-controller.js';

export class WorkflowHandler {
  constructor(io, stateManager, collaborationHandler) {
    this.io = io;
    this.stateManager = stateManager;
    this.collaborationHandler = collaborationHandler;
  }

  async handleOperation(socket, { roomId, operation }) {
    try {
      // Validate room and mode
      const collabState = this.stateManager.getCollaborationState(roomId);
      if (!collabState || collabState.mode !== 'workflow') {
        return;
      }

      // Check edit permission
      if (
        !this.collaborationHandler.validateEditPermission(
          roomId,
          socket.user.userId
        )
      ) {
        return;
      }

      // Initialize workflow data if needed
      if (!collabState.workflowData) {
        collabState.workflowData = {
          nodes: [],
          edges: [],
          version: 0,
          lastModified: Date.now(),
          lastModifiedBy: socket.user.userId,
        };
      }

      // Apply operation
      const newWorkflowData = await applyWorkflowOperation(
        collabState.workflowData,
        operation
      );

      // Update state atomically
      const updatedData = this.stateManager.updateWorkflowData(
        roomId,
        {
          ...newWorkflowData,
          version: (collabState.workflowData.version || 0) + 1,
        },
        socket.user.userId
      );

      // Broadcast to all clients including sender for confirmation
      this.io.to(roomId).emit('workflow:operation', {
        operation,
        userId: socket.user.userId,
        timestamp: Date.now(),
        version: updatedData.version,
      });
    } catch (error) {
      console.error('Error handling workflow operation:', error);
      socket.emit('error', {
        message: 'Failed to apply workflow operation',
        timestamp: Date.now(),
      });
    }
  }

  handleStateRequest(socket, { roomId }) {
    try {
      const collabState = this.stateManager.getCollaborationState(roomId);
      if (collabState) {
        socket.emit('workflow:state-sync', collabState);
      }
    } catch (error) {
      console.error('Error handling workflow state request:', error);
      socket.emit('error', {
        message: 'Failed to sync workflow state',
        timestamp: Date.now(),
      });
    }
  }

  setupSocketHandlers(socket) {
    socket.on('workflow:operation', (data) =>
      this.handleOperation(socket, data)
    );
    socket.on('workflow:request-sync', (data) =>
      this.handleStateRequest(socket, data)
    );
  }
}
