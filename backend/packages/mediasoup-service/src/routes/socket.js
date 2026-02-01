import { logger } from '../utils/logger.js';

/**
 * Socket.IO event routing to controllers
 * Extracted from index.js for better separation of concerns
 */
export const setupSocketRoutes = (
  io,
  mediaController,
  collaborationController,
  roomController,
  yjsController,
  recordingController = null
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

    // Collaboration state sync (for users joining room)
    socket.on('collaboration:request-state', (data) =>
      collaborationController.handleCollaborationStateRequest(socket, data)
    );

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

    // Workflow events
    socket.on('workflow:operation', (data) =>
      collaborationController.handleWorkflowOperation(socket, data)
    );

    socket.on('workflow:request-sync', (data) =>
      collaborationController.handleWorkflowSyncRequest(socket, data)
    );

    socket.on('workflow:awareness', (data) =>
      collaborationController.handleWorkflowAwareness(socket, data)
    );

    // Whiteboard events
    socket.on('whiteboard:update', (data) =>
      collaborationController.handleWhiteboardUpdate(socket, data)
    );

    socket.on('whiteboard:request-sync', (data) =>
      collaborationController.handleWhiteboardSyncRequest(socket, data)
    );

    // Code editor events
    socket.on('code:update', (data) =>
      collaborationController.handleCodeUpdate(socket, data)
    );

    socket.on('code:language-change', (data) =>
      collaborationController.handleCodeLanguageChange(socket, data)
    );

    socket.on('code:request-sync', (data) =>
      collaborationController.handleCodeSyncRequest(socket, data)
    );

    // Presentation events
    socket.on('presentation:start', (data) =>
      collaborationController.handlePresentationStart(socket, data)
    );

    socket.on('presentation:stop', (data) =>
      collaborationController.handlePresentationStop(socket, data)
    );

    // ============================================================================
    // YJS SYNC EVENTS - Route to YjsController
    // ============================================================================

    // Yjs sync protocol
    socket.on('yjs:sync-step1', (data) =>
      yjsController.handleSyncStep1(socket, data)
    );

    socket.on('yjs:update', (data) => yjsController.handleUpdate(socket, data));

    socket.on('yjs:awareness', (data) =>
      yjsController.handleAwarenessUpdate(socket, data)
    );

    socket.on('yjs:query-awareness', (data) =>
      yjsController.handleAwarenessQuery(socket, data)
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

    // ============================================================================
    // RECORDING EVENTS - Route to RecordingController
    // ============================================================================

    if (recordingController) {
      // Start recording
      socket.on('recording:start', (data) =>
        recordingController.handleStartRecording(socket, data)
      );

      // Stop recording
      socket.on('recording:stop', (data) =>
        recordingController.handleStopRecording(socket, data)
      );

      // Get recording status
      socket.on('recording:status', (data) =>
        recordingController.handleGetStatus(socket, data)
      );

      // Receive recording chunk from client
      socket.on('recording:chunk', (data) =>
        recordingController.handleRecordingChunk(socket, data)
      );

      // Finalize recording (complete upload from client)
      socket.on('recording:finalize', (data) =>
        recordingController.handleFinalizeRecording(socket, data)
      );
    }
  });
};
