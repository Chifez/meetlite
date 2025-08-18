export class MediaHandler {
  constructor(io, stateManager) {
    this.io = io;
    this.stateManager = stateManager;
  }

  handleMediaStateChange(socket, { roomId, audioEnabled, videoEnabled }) {
    // Validate room and user
    if (
      !this.stateManager.isValidRoom(roomId) ||
      !this.stateManager.isUserInRoom(roomId, socket.user.userId)
    ) {
      return;
    }

    // Update media state
    this.stateManager.setUserMediaState(roomId, socket.user.userId, {
      audioEnabled,
      videoEnabled,
    });

    // Broadcast update to other participants
    socket.to(roomId).emit('media-state-update', {
      userId: socket.user.userId,
      audioEnabled,
      videoEnabled,
    });
  }

  setupSocketHandlers(socket) {
    socket.on('media-state-change', (data) =>
      this.handleMediaStateChange(socket, data)
    );
  }
}
