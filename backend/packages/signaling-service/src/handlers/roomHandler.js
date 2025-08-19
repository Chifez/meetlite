export class RoomHandler {
  constructor(io, stateManager, connectionManager, screenShareManager) {
    this.io = io;
    this.stateManager = stateManager;
    this.connectionManager = connectionManager;
    this.screenShareManager = screenShareManager;
  }

  async handleJoinRoom(socket, { roomId, mediaState }) {
    console.log(`User ${socket.user.userId} joining room ${roomId}`);

    socket.join(roomId);

    // Initialize room state
    const room = this.stateManager.initializeRoom(roomId);
    this.stateManager.setUserMediaState(roomId, socket.user.userId, mediaState);

    // Attempt to recover any existing connections for this user
    await this.attemptUserConnectionRecovery(socket.user.userId, roomId);

    // Get existing participants
    const existingParticipants = [];
    const roomSockets = this.io.sockets.adapter.rooms.get(roomId);

    if (roomSockets) {
      roomSockets.forEach((socketId) => {
        if (socketId !== socket.id) {
          const userId = this.stateManager.getUserBySocket(socketId);
          if (userId) {
            existingParticipants.push(userId);
          }
        }
      });
    }

    // Setup connections with existing participants
    existingParticipants.forEach((existingUserId) => {
      this.connectionManager.setupConnection(socket, existingUserId);
    });

    // Prepare room data for broadcast
    const allParticipants = [socket.user.userId, ...existingParticipants];
    const roomStateData = {};
    const participantInfo = {};

    allParticipants.forEach((participantId) => {
      // Get media state
      const userMediaState = this.stateManager.getUserMediaState(
        roomId,
        participantId
      );
      if (userMediaState) {
        roomStateData[participantId] = userMediaState;
      }

      // Get user info
      const user = this.stateManager.getUserInfo(participantId);
      if (user) {
        participantInfo[participantId] = {
          email: user.email,
          userId: user.userId,
        };
      }
    });

    // Send room data to all participants
    this.io.to(roomId).emit('room-data', {
      participants: allParticipants,
      mediaState: roomStateData,
      participantInfo,
    });

    // Notify others about new participant
    if (existingParticipants.length > 0) {
      socket.to(roomId).emit('user-joined', {
        userId: socket.user.userId,
        userEmail: socket.user.email,
      });
    }

    // Handle screen sharing state
    const currentScreenSharer = this.stateManager.getScreenSharing(roomId);
    if (currentScreenSharer) {
      this.screenShareManager.setupNewParticipant(
        socket,
        roomId,
        currentScreenSharer
      );
    }

    // Send current collaboration state
    const currentCollabState = this.stateManager.getCollaborationState(roomId);
    socket.emit('collaboration:state', currentCollabState);

    // Clean up old connections
    this.connectionManager.cleanupOldConnections();
  }

  // Attempt to recover user connections
  async attemptUserConnectionRecovery(userId, roomId) {
    try {
      // Get user's existing connections
      const userConnections = this.stateManager.getUserConnections(userId);

      for (const connection of userConnections) {
        // Check if connection is stale and attempt recovery
        if (this.isConnectionStale(connection)) {
          console.log(
            `🔄 Attempting to recover connection ${connection.key} for user ${userId}`
          );
          const recovered = await this.stateManager.attemptConnectionRecovery(
            connection.key
          );

          if (recovered) {
            console.log(
              `✅ Successfully recovered connection ${connection.key} for user ${userId}`
            );
          } else {
            console.log(
              `❌ Failed to recover connection ${connection.key} for user ${userId}`
            );
          }
        }
      }
    } catch (error) {
      console.error(
        `❌ Error attempting user connection recovery for ${userId}:`,
        error
      );
    }
  }

  // Check if connection is stale
  isConnectionStale(connection) {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    return now - connection.timestamp > staleThreshold;
  }

  handleUserLeaving(socket, roomId, emitUserLeft = true) {
    console.log(`User ${socket.user.userId} leaving room ${roomId}`);

    // Remove user from room state
    const room = this.stateManager.getRoomState(roomId);
    if (!room) return;

    room.delete(socket.user.userId);

    // Clean up screen sharing
    this.screenShareManager.cleanupUserScreenShare(socket, roomId);

    // Clean up collaboration state if user was presenter
    const collabState = this.stateManager.getCollaborationState(roomId);
    if (collabState?.presenter?.userId === socket.user.userId) {
      const updatedState = this.stateManager.updateCollaborationMode(
        roomId,
        'none',
        socket.user.userId
      );
      socket.to(roomId).emit('collaboration:mode-changed', {
        mode: 'none',
        activeTool: 'none',
        presenter: updatedState.presenter,
        changedBy: socket.user.userId,
      });
    }

    // Clean up connections
    this.connectionManager.cleanupConnections(socket.user.userId);

    // Clean up room if empty
    if (room.size === 0) {
      this.stateManager.cleanupRoom(roomId);
    }

    // Notify others
    if (emitUserLeft) {
      socket.to(roomId).emit('user-left', socket.user.userId);
    }

    // Leave the room
    socket.leave(roomId);
  }

  handleDisconnect(socket) {
    console.log('User disconnected:', socket.user.email);

    // Leave all rooms
    const rooms = Array.from(socket.rooms);
    rooms.forEach((roomId) => {
      if (roomId !== socket.id) {
        this.handleUserLeaving(socket, roomId, false);
      }
    });

    // Clean up user state
    this.stateManager.cleanupUser(socket.user.userId, socket.id);
  }

  setupSocketHandlers(socket) {
    socket.on('ready', (data) => this.handleJoinRoom(socket, data));
    socket.on('user-left', (data) =>
      this.handleUserLeaving(socket, data.roomId)
    );
    socket.on('disconnect', () => this.handleDisconnect(socket));
  }
}
