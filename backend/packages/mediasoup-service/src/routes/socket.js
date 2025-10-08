import { logger } from '../utils/logger.js';

/**
 * Socket.IO event routing to controllers
 * Extracted from index.js for better separation of concerns
 */
export const setupSocketRoutes = (
  io,
  mediaController,
  collaborationController,
  roomController
) => {
  // Socket.IO connection handling
  io.on('connection', (socket) => {
    logger.info('User connected to MediaSoup service', {
      userId: socket.user.userId,
      email: socket.user.email,
      socketId: socket.id,
    });

    // ============================================================================
    // MEDIA EVENTS - Route to MediaController
    // ============================================================================

    // Room creation
    socket.on('mediasoup:create-room', (data) =>
      mediaController.handleCreateRoom(socket, data)
    );

    // Main room join flow (ready event)
    socket.on('ready', (data) => mediaController.handleReady(socket, data));

    // Room joining
    socket.on('mediasoup:join-room', (data) =>
      mediaController.handleJoinRoom(socket, data)
    );

    // Transport management
    socket.on('mediasoup:create-transport', (data) =>
      mediaController.handleCreateTransport(socket, data)
    );

    socket.on('mediasoup:connect-transport', (data) =>
      mediaController.handleConnectTransport(socket, data)
    );

    // Producer management
    socket.on('mediasoup:create-producer', (data) =>
      mediaController.handleCreateProducer(socket, data)
    );

    socket.on('mediasoup:producer-pause', (data) =>
      mediaController.handlePauseProducer(socket, data)
    );

    socket.on('mediasoup:producer-resume', (data) =>
      mediaController.handleResumeProducer(socket, data)
    );

    // Consumer management
    socket.on('mediasoup:create-consumer', (data) =>
      mediaController.handleCreateConsumer(socket, data)
    );

    // Media state changes
    socket.on('media-state-change', (data) =>
      mediaController.handleMediaStateChange(socket, data)
    );

    // Screen sharing
    socket.on('screen-share-started', (data) =>
      mediaController.handleScreenShareStarted(socket, data)
    );

    socket.on('screen-share-stopped', (data) =>
      mediaController.handleScreenShareStopped(socket, data)
    );

    socket.on('screen-share-ready', (data) =>
      mediaController.handleScreenShareReady(socket, data)
    );

    // Participant activity
    socket.on('mediasoup:participant-activity', (data) =>
      mediaController.handleParticipantActivity(socket, data)
    );

    // ============================================================================
    // COLLABORATION EVENTS - Route to CollaborationController
    // ============================================================================

    // Chat events
    socket.on('chat:message', (data) =>
      collaborationController.handleChatMessage(socket, data)
    );

    socket.on('chat:typing-start', (data) =>
      collaborationController.handleTypingStart(socket, data)
    );

    socket.on('chat:typing-stop', (data) =>
      collaborationController.handleTypingStop(socket, data)
    );

    // Collaboration mode and tools
    socket.on('collaboration:mode', (data) =>
      collaborationController.handleCollaborationMode(socket, data)
    );

    socket.on('collaboration:tool', (data) =>
      collaborationController.handleCollaborationTool(socket, data)
    );

    socket.on('presentation:settings', (data) =>
      collaborationController.handlePresentationSettings(socket, data)
    );

    socket.on('collaboration:request-state', (data) =>
      collaborationController.handleCollaborationStateRequest(socket, data)
    );

    // Workflow events
    socket.on('workflow:operation', (data) =>
      collaborationController.handleWorkflowOperation(socket, data)
    );

    socket.on('workflow:request-sync', (data) =>
      collaborationController.handleWorkflowSyncRequest(socket, data)
    );

    // Whiteboard events
    socket.on('whiteboard:update', (data) =>
      collaborationController.handleWhiteboardUpdate(socket, data)
    );

    socket.on('whiteboard:request-sync', (data) =>
      collaborationController.handleWhiteboardSyncRequest(socket, data)
    );

    // Presentation events
    socket.on('presentation:start', (data) =>
      collaborationController.handlePresentationStart(socket, data)
    );

    socket.on('presentation:stop', (data) =>
      collaborationController.handlePresentationStop(socket, data)
    );

    // ============================================================================
    // ROOM MANAGEMENT EVENTS - Route to RoomController
    // ============================================================================

    // Room leaving
    socket.on('user-left', (data) =>
      roomController.handleUserLeft(socket, data)
    );

    socket.on('mediasoup:leave-room', (data) =>
      roomController.handleLeaveRoom(socket, data)
    );

    // Disconnect handling
    socket.on('disconnect', () => roomController.handleDisconnect(socket));
  });
};
