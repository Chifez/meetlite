import { Server } from 'socket.io';
import { AuthenticatedSocket } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

/**
 * Socket.IO event routing to controllers
 */
export const setupSocketRoutes = (
  io: Server,
  mediaController: any,
  collaborationController: any,
  roomController: any,
  yjsController: any,
  recordingController: any = null
) => {
  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info('User connected to MediaSoup service', {
      userId: socket.user?.userId,
      email: socket.user?.email,
      socketId: socket.id,
    });

    // ============================================================================
    // MEDIA EVENTS - Route to MediaController
    // ============================================================================

    socket.on('mediasoup:create-room', (data) =>
      mediaController.handleCreateRoom(socket, data)
    );

    socket.on('ready', (data) => mediaController.handleReady(socket, data));

    socket.on('mediasoup:join-room', (data) =>
      mediaController.handleJoinRoom(socket, data)
    );

    socket.on('mediasoup:create-transport', (data) =>
      mediaController.handleCreateTransport(socket, data)
    );

    socket.on('mediasoup:connect-transport', (data) =>
      mediaController.handleConnectTransport(socket, data)
    );

    socket.on('mediasoup:create-producer', (data) =>
      mediaController.handleCreateProducer(socket, data)
    );

    socket.on('mediasoup:producer-pause', (data) =>
      mediaController.handlePauseProducer(socket, data)
    );

    socket.on('mediasoup:producer-resume', (data) =>
      mediaController.handleResumeProducer(socket, data)
    );

    socket.on('mediasoup:create-consumer', (data) =>
      mediaController.handleCreateConsumer(socket, data)
    );

    socket.on('media:set-layers', (data, callback) =>
      mediaController.handleSetLayers(socket, data, callback)
    );

    socket.on('media:restart-ice', (data) =>
      mediaController.handleRestartIce(socket, data)
    );

    socket.on('media-state-change', (data) =>
      mediaController.handleMediaStateChange(socket, data)
    );

    socket.on('screen-share-started', (data) =>
      mediaController.handleScreenShareStarted(socket, data)
    );

    socket.on('screen-share-stopped', (data) =>
      mediaController.handleScreenShareStopped(socket, data)
    );

    socket.on('screen-share-ready', (data) =>
      mediaController.handleScreenShareReady(socket, data)
    );

    socket.on('mediasoup:participant-activity', (data) =>
      mediaController.handleParticipantActivity(socket, data)
    );

    // ============================================================================
    // COLLABORATION EVENTS - Route to CollaborationController
    // ============================================================================

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

    socket.on('user-left', (data) =>
      roomController.handleUserLeft(socket, data)
    );

    socket.on('mediasoup:leave-room', (data) =>
      roomController.handleLeaveRoom(socket, data)
    );

    socket.on('disconnect', () => roomController.handleDisconnect(socket));

    // ============================================================================
    // RECORDING EVENTS - Route to RecordingController
    // ============================================================================

    if (recordingController) {
      socket.on('recording:start', (data) =>
        recordingController.handleStartRecording(socket, data)
      );

      socket.on('recording:stop', (data) =>
        recordingController.handleStopRecording(socket, data)
      );

      socket.on('recording:status', (data) =>
        recordingController.handleGetStatus(socket, data)
      );

      socket.on('recording:chunk', (data) =>
        recordingController.handleRecordingChunk(socket, data)
      );

      socket.on('recording:finalize', (data) =>
        recordingController.handleFinalizeRecording(socket, data)
      );
    }
  });
};
export default setupSocketRoutes;
