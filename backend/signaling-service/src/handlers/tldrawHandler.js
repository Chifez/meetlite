import { TLSocketRoom } from '@tldraw/sync-core';

export class TldrawHandler {
  constructor(io, stateManager) {
    this.io = io;
    this.stateManager = stateManager;
    this.setupNamespace();
  }

  setupNamespace() {
    const namespace = this.io.of('/connect');
    namespace.on('connection', (socket) => this.handleConnection(socket));
  }

  handleConnection(socket) {
    try {
      console.log('Tldraw Socket.IO connection established');

      const roomId = socket.handshake.query.roomId;
      const userId = socket.user?.userId;

      if (!this.validateConnection(roomId, userId, socket)) {
        return;
      }

      this.setupRoom(roomId);
      this.setupSocketHandlers(socket, roomId);

      // Join room and notify
      socket.join(roomId);
      this.emitPresence(socket, roomId, 'connected');
    } catch (error) {
      this.handleError(socket, 'Error establishing Tldraw connection', error);
    }
  }

  validateConnection(roomId, userId, socket) {
    if (!roomId) {
      this.handleError(socket, 'Room ID required');
      socket.disconnect();
      return false;
    }

    if (!userId) {
      this.handleError(socket, 'User ID required');
      socket.disconnect();
      return false;
    }

    if (!this.stateManager.isValidRoom(roomId)) {
      this.handleError(socket, 'Invalid room');
      socket.disconnect();
      return false;
    }

    if (!this.stateManager.canEdit(roomId, userId)) {
      this.handleError(socket, 'Permission denied');
      socket.disconnect();
      return false;
    }

    return true;
  }

  setupRoom(roomId) {
    try {
      let tldrawRoom = this.stateManager.getTldrawRoom(roomId);
      if (!tldrawRoom) {
        tldrawRoom = new TLSocketRoom(roomId);
        this.stateManager.setTldrawRoom(roomId, tldrawRoom);
      }
      return tldrawRoom;
    } catch (error) {
      console.error('Error setting up Tldraw room:', error);
      throw error;
    }
  }

  setupSocketHandlers(socket, roomId) {
    // Handle Tldraw messages
    socket.on('message', (data) => {
      try {
        if (!this.stateManager.canEdit(roomId, socket.user.userId)) {
          throw new Error('Permission denied');
        }
        socket.to(roomId).emit('message', data);
      } catch (error) {
        this.handleError(socket, 'Error handling Tldraw message', error);
      }
    });

    // Handle presence updates
    socket.on('presence', (data) => {
      try {
        socket.to(roomId).emit('presence', {
          ...data,
          userId: socket.user.userId,
          userInfo: this.stateManager.getUserInfo(socket.user.userId),
        });
      } catch (error) {
        this.handleError(socket, 'Error handling presence update', error);
      }
    });

    // Handle state sync requests
    socket.on('sync-request', () => {
      try {
        const tldrawRoom = this.stateManager.getTldrawRoom(roomId);
        if (tldrawRoom) {
          const state = tldrawRoom.getState();
          socket.emit('sync-state', state);
        }
      } catch (error) {
        this.handleError(socket, 'Error handling sync request', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      try {
        console.log('Tldraw Socket.IO connection closed');
        this.handleDisconnect(socket, roomId);
      } catch (error) {
        console.error('Error handling disconnect:', error);
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      this.handleError(socket, 'Tldraw client error', error);
    });
  }

  handleDisconnect(socket, roomId) {
    this.emitPresence(socket, roomId, 'disconnected');

    const namespace = this.io.of('/connect');
    const room = namespace.adapter.rooms.get(roomId);

    if (!room || room.size === 0) {
      this.stateManager.deleteTldrawRoom(roomId);
    }
  }

  emitPresence(socket, roomId, status) {
    socket.to(roomId).emit('presence', {
      userId: socket.user.userId,
      status,
      userInfo: this.stateManager.getUserInfo(socket.user.userId),
      timestamp: Date.now(),
    });
  }

  handleError(socket, message, error = null) {
    const errorMessage = error?.message || message;
    console.error(`${message}:`, error || errorMessage);

    socket.emit('error', {
      message: errorMessage,
      timestamp: Date.now(),
    });
  }
}
