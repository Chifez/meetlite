export class ChatHandler {
  constructor(io, stateManager) {
    this.io = io;
    this.stateManager = stateManager;
  }

  handleMessage(socket, data) {
    const { roomId, message, timestamp, type = 'text' } = data;

    // Validate input
    if (!roomId || !message || message.trim().length === 0) {
      return;
    }

    // Verify user is in room
    if (!socket.rooms.has(roomId)) {
      return;
    }

    // Get user info
    const userInfo = this.stateManager.getUserInfo(socket.user.userId);
    if (!userInfo) return;

    // Broadcast message to all users in room (including sender for confirmation)
    this.io.to(roomId).emit('chat:message', {
      userId: socket.user.userId,
      userEmail: userInfo.email,
      message: message.trim(),
      timestamp,
      type,
    });
  }

  handleTypingStart(socket, data) {
    const { roomId } = data;

    if (!roomId || !socket.rooms.has(roomId)) {
      return;
    }

    const userInfo = this.stateManager.getUserInfo(socket.user.userId);
    if (!userInfo) return;

    // Broadcast typing indicator to others (not to sender)
    socket.to(roomId).emit('chat:typing-start', {
      userId: socket.user.userId,
      userEmail: userInfo.email,
    });
  }

  handleTypingStop(socket, data) {
    const { roomId } = data;

    if (!roomId || !socket.rooms.has(roomId)) {
      return;
    }

    // Broadcast stop typing to others (not to sender)
    socket.to(roomId).emit('chat:typing-stop', {
      userId: socket.user.userId,
    });
  }

  setupSocketHandlers(socket) {
    socket.on('chat:message', (data) => this.handleMessage(socket, data));
    socket.on('chat:typing-start', (data) =>
      this.handleTypingStart(socket, data)
    );
    socket.on('chat:typing-stop', (data) =>
      this.handleTypingStop(socket, data)
    );
  }
}
