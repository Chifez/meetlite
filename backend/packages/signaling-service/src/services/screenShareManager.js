import { createScreenConnectionKey } from '../utils/connectionKeys.js';

export class ScreenShareManager {
  constructor(io, stateManager) {
    this.io = io;
    this.stateManager = stateManager;
  }

  handleScreenShareStart(socket, { roomId }) {
    try {
      // Update screen sharing state
      this.stateManager.setScreenSharing(roomId, socket.user.userId);

      // Notify other participants
      socket.to(roomId).emit('screen-share-started', {
        userId: socket.user.userId,
      });
    } catch (error) {
      console.error('Error starting screen share:', error);
      socket.emit('error', {
        message: 'Failed to start screen sharing',
        timestamp: Date.now(),
      });
    }
  }

  handleScreenShareReady(socket, { roomId }) {
    try {
      const roomSockets = this.io.sockets.adapter.rooms.get(roomId);
      if (!roomSockets) return;

      // Setup connections with all participants
      roomSockets.forEach((socketId) => {
        if (socketId !== socket.id) {
          const userId = this.stateManager.getUserBySocket(socketId);
          if (userId) {
            this.setupScreenConnection(socket, userId);
          }
        }
      });
    } catch (error) {
      console.error('Error handling screen share ready:', error);
      socket.emit('error', {
        message: 'Failed to setup screen sharing connections',
        timestamp: Date.now(),
      });
    }
  }

  setupScreenConnection(socket, targetUserId) {
    try {
      const connectionKey = createScreenConnectionKey(
        socket.user.userId,
        targetUserId
      );

      // Check if connection already exists
      if (this.stateManager.getConnection(connectionKey)) {
        return;
      }

      // Create new connection
      this.stateManager.setConnection(connectionKey, {
        users: [socket.user.userId, targetUserId],
        status: 'screen-initiating',
      });

      // Initiate connection
      this.io.to(socket.id).emit('initiate-screen-connection', {
        targetUserId,
        isInitiator: true,
      });
    } catch (error) {
      console.error('Error setting up screen connection:', error);
    }
  }

  handleScreenShareStop(socket, { roomId }) {
    try {
      // Clear screen sharing state
      this.stateManager.stopScreenSharing(roomId);

      // Notify other participants
      socket.to(roomId).emit('screen-share-stopped');
    } catch (error) {
      console.error('Error stopping screen share:', error);
      socket.emit('error', {
        message: 'Failed to stop screen sharing',
        timestamp: Date.now(),
      });
    }
  }

  handleScreenShareCall(socket, { to, offer }) {
    try {
      const targetSocketId = this.stateManager.getUserSocket(to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit('screen-share-call', {
          from: socket.user.userId,
          offer,
        });
      }
    } catch (error) {
      console.error('Error handling screen share call:', error);
    }
  }

  handleScreenShareAnswer(socket, { to, answer }) {
    try {
      const targetSocketId = this.stateManager.getUserSocket(to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit('screen-share-answer', {
          from: socket.user.userId,
          answer,
        });
      }
    } catch (error) {
      console.error('Error handling screen share answer:', error);
    }
  }

  handleScreenShareCandidate(socket, { to, candidate }) {
    try {
      const targetSocketId = this.stateManager.getUserSocket(to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit('screen-share-candidate', {
          from: socket.user.userId,
          candidate,
        });
      }
    } catch (error) {
      console.error('Error handling screen share candidate:', error);
    }
  }

  setupNewParticipant(socket, roomId, sharingUserId) {
    try {
      if (!sharingUserId) return;

      // Create connection between sharer and new participant
      const connectionKey = createScreenConnectionKey(
        sharingUserId,
        socket.user.userId
      );
      if (!this.stateManager.getConnection(connectionKey)) {
        this.stateManager.setConnection(connectionKey, {
          users: [sharingUserId, socket.user.userId],
          status: 'screen-initiating',
        });

        // Notify sharer to initiate connection
        const sharerSocketId = this.stateManager.getUserSocket(sharingUserId);
        if (sharerSocketId) {
          this.io.to(sharerSocketId).emit('initiate-screen-connection', {
            targetUserId: socket.user.userId,
            isInitiator: true,
          });
        }
      }

      // Notify new participant about active screen share
      socket.emit('screen-share-started', { userId: sharingUserId });
    } catch (error) {
      console.error(
        'Error setting up new participant for screen share:',
        error
      );
    }
  }

  cleanupUserScreenShare(socket, roomId) {
    try {
      const currentSharer = this.stateManager.getScreenSharing(roomId);
      if (currentSharer === socket.user.userId) {
        this.stateManager.stopScreenSharing(roomId);
        socket.to(roomId).emit('screen-share-stopped');
      }
    } catch (error) {
      console.error('Error cleaning up user screen share:', error);
    }
  }

  setupSocketHandlers(socket) {
    socket.on('screen-share-started', (data) =>
      this.handleScreenShareStart(socket, data)
    );
    socket.on('screen-share-ready', (data) =>
      this.handleScreenShareReady(socket, data)
    );
    socket.on('screen-share-stopped', (data) =>
      this.handleScreenShareStop(socket, data)
    );
    socket.on('screen-share-call', (data) =>
      this.handleScreenShareCall(socket, data)
    );
    socket.on('screen-share-answer', (data) =>
      this.handleScreenShareAnswer(socket, data)
    );
    socket.on('screen-share-candidate', (data) =>
      this.handleScreenShareCandidate(socket, data)
    );
  }
}
