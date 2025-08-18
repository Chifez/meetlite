export class WhiteboardHandler {
  constructor(io, stateManager, collaborationHandler) {
    this.io = io;
    this.stateManager = stateManager;
    this.collaborationHandler = collaborationHandler;
  }

  handleUpdate(socket, { roomId, update }) {
    try {
      // Validate room and mode
      const collabState = this.stateManager.getCollaborationState(roomId);
      if (!collabState || collabState.mode !== 'whiteboard') {
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

      // Initialize whiteboard data if needed
      if (!collabState.whiteboardData) {
        collabState.whiteboardData = {
          version: 0,
          data: update.data,
          lastModified: new Date(),
          lastModifiedBy: socket.user.userId,
        };
      }

      // Update state
      const updatedData = this.stateManager.updateWhiteboardData(
        roomId,
        {
          version: update.version,
          data: update.data,
        },
        socket.user.userId
      );

      // Broadcast update to all participants (including sender for confirmation)
      this.io.to(roomId).emit('whiteboard:update', {
        update,
        userId: socket.user.userId,
        timestamp: Date.now(),
        version: updatedData.version,
      });
    } catch (error) {
      console.error('Error handling whiteboard update:', error);
      socket.emit('error', {
        message: 'Failed to update whiteboard',
        timestamp: Date.now(),
      });
    }
  }

  handleStateRequest(socket, { roomId }) {
    try {
      const collabState = this.stateManager.getCollaborationState(roomId);

      if (
        collabState &&
        collabState.mode === 'whiteboard' &&
        collabState.whiteboardData
      ) {
        socket.emit('whiteboard:state-sync', collabState.whiteboardData);
      } else {
        socket.emit('whiteboard:state-sync', {
          version: 0,
          data: null,
          lastModified: new Date(),
          lastModifiedBy: null,
        });
      }
    } catch (error) {
      console.error('Error handling whiteboard state request:', error);
      socket.emit('error', {
        message: 'Failed to sync whiteboard state',
        timestamp: Date.now(),
      });
    }
  }

  setupSocketHandlers(socket) {
    socket.on('whiteboard:update', (data) => this.handleUpdate(socket, data));
    socket.on('whiteboard:request-sync', (data) =>
      this.handleStateRequest(socket, data)
    );
  }
}
