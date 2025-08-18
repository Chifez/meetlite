import {
  shouldInitiateConnection,
  createConnectionKey,
} from '../utils/connectionKeys.js';

export class ConnectionManager {
  constructor(io, stateManager) {
    this.io = io;
    this.stateManager = stateManager;
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
}
