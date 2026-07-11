import { logger } from '../utils/logger.js';
import { SOCKET_EVENTS } from '@minimeet/shared';


/**
 * Recording Controller
 * Handles WebSocket events for recording functionality
 */
export class RecordingController {
  private recordingService: any;
  private mediaSoupService: any;
  private io: any;

  constructor(recordingService: any, io: any, mediaSoupService?: any) {
    this.recordingService = recordingService;
    this.mediaSoupService = mediaSoupService;
    this.io = io;

    logger.info('RecordingController initialized');
  }

  /**
   * Verify that the socket user is authorized to control recording for the room.
   * Authorization: user must be the room creator OR have owner/admin role in the org.
   */
  private async verifyHostAuthorization(socket: any, roomId: string): Promise<{ authorized: boolean; reason?: string }> {
    const userId = socket.user?.userId;
    const userRole = socket.user?.role;
    const token = socket.handshake?.auth?.token;

    if (!userId) {
      return { authorized: false, reason: 'User not authenticated' };
    }

    // Org-level admins/owners can always control recording
    if (userRole === 'owner' || userRole === 'admin') {
      return { authorized: true };
    }

    // Otherwise, validate via room service that the user is the room creator
    if (this.mediaSoupService?.validateRoomAccess) {
      try {
        const result = await this.mediaSoupService.validateRoomAccess(roomId, userId, token);
        if (!result.valid) {
          return { authorized: false, reason: result.error || 'Room access denied' };
        }
        // Room response includes createdBy from Room Service
        const roomData = result.room?.data || result.room;
        const createdBy = roomData?.createdBy;
        if (createdBy && createdBy === userId) {
          return { authorized: true };
        }
        return { authorized: false, reason: 'Only the meeting host can control recording' };
      } catch (error: any) {
        logger.warn('Could not verify room host status, denying recording', { roomId, userId, error: error.message });
        return { authorized: false, reason: 'Could not verify host status' };
      }
    }

    // Fallback: allow if we can't verify (for backward compat during development)
    logger.warn('mediaSoupService not available for authorization check, allowing recording', { roomId, userId });
    return { authorized: true };
  }

  /**
   * Handle recording:start event
   */
  async handleStartRecording(socket: any, data: any) {
    const { roomId, options = {} } = data;
    // Fix: use userId (not id) – matches what auth middleware sets on socket.user
    const userId = socket.user?.userId;

    logger.info('Recording start request', { roomId, userId });

    try {
      // Host-only authorization check
      const authResult = await this.verifyHostAuthorization(socket, roomId);
      if (!authResult.authorized) {
        socket.emit(SOCKET_EVENTS.RECORDING_START_ERROR, {
          error: authResult.reason || 'Not authorized to start recording',
        });
        return { success: false, error: authResult.reason };
      }

      const result = await this.recordingService.startRecording(roomId, userId, options);

      if (result.success) {
        // Notify all participants in the room
        this.io.to(roomId).emit(SOCKET_EVENTS.RECORDING_STARTED, {
          recordingId: result.recordingId,
          startedBy: userId,
          startedAt: result.startedAt,
        });

        socket.emit('recording:start-success', result);
      } else {
        socket.emit(SOCKET_EVENTS.RECORDING_START_ERROR, {
          error: result.error,
          recordingId: result.recordingId,
        });
      }

      return result;
    } catch (error: any) {
      logger.error('Failed to start recording', { roomId, userId, error: error.message });
      
      socket.emit(SOCKET_EVENTS.RECORDING_START_ERROR, {
        error: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Handle recording:stop event
   */
  async handleStopRecording(socket: any, data: any) {
    const { roomId } = data;
    // Fix: use userId (not id)
    const userId = socket.user?.userId;

    logger.info('Recording stop request', { roomId, userId });

    try {
      // Host-only authorization check
      const authResult = await this.verifyHostAuthorization(socket, roomId);
      if (!authResult.authorized) {
        socket.emit(SOCKET_EVENTS.RECORDING_STOP_ERROR, {
          error: authResult.reason || 'Not authorized to stop recording',
        });
        return { success: false, error: authResult.reason };
      }

      const result = await this.recordingService.stopRecording(roomId, userId);

      if (result.success) {
        // Notify all participants in the room
        this.io.to(roomId).emit(SOCKET_EVENTS.RECORDING_STOPPED, {
          recordingId: result.recordingId,
          stoppedBy: userId,
          duration: result.duration,
        });

        socket.emit('recording:stop-success', result);
      } else {
        socket.emit(SOCKET_EVENTS.RECORDING_STOP_ERROR, {
          error: result.error,
        });
      }

      return result;
    } catch (error: any) {
      logger.error('Failed to stop recording', { roomId, userId, error: error.message });
      
      socket.emit(SOCKET_EVENTS.RECORDING_STOP_ERROR, {
        error: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Handle recording:status event
   */
  handleGetStatus(socket: any, data: any) {
    const { roomId } = data;

    try {
      const status = this.recordingService.getRecordingStatus(roomId);
      socket.emit(SOCKET_EVENTS.RECORDING_STATUS, status);
      return status;
    } catch (error: any) {
      logger.error('Failed to get recording status', { roomId, error: error.message });
      
      socket.emit('recording:status-error', {
        error: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Handle recording:chunk event (receiving recording chunks from client)
   */
  async handleRecordingChunk(socket: any, data: any) {
    const { roomId, chunk } = data;

    try {
      await this.recordingService.saveRecordingChunk(roomId, Buffer.from(chunk));
      return { success: true };
    } catch (error: any) {
      logger.error('Failed to save recording chunk', { roomId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle recording:finalize event (client uploading complete recording)
   */
  async handleFinalizeRecording(socket: any, data: any) {
    const { roomId, recordingId, recordingData } = data;
    // Fix: use userId (not id)
    const userId = socket.user?.userId;

    logger.info('Recording finalize request', { roomId, recordingId, userId });

    try {
      const result = await this.recordingService.finalizeRecording(
        roomId,
        recordingId,
        Buffer.from(recordingData)
      );

      if (result.success) {
        // Notify all participants
        this.io.to(roomId).emit(SOCKET_EVENTS.RECORDING_FINALIZED, {
          recordingId: result.recordingId,
          fileName: result.fileName,
          fileSize: result.fileSize,
          duration: result.duration,
        });

        socket.emit('recording:finalize-success', result);

        logger.info('Recording finalized successfully', {
          recordingId: result.recordingId,
          roomId,
          fileSize: result.fileSize,
        });
      } else {
        socket.emit('recording:finalize-error', {
          error: result.error,
        });
      }

      return result;
    } catch (error: any) {
      logger.error('Failed to finalize recording', { roomId, recordingId, error: error.message });
      
      socket.emit('recording:finalize-error', {
        error: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Setup socket event handlers for recording
   */
  setupSocketHandlers(socket: any) {
    socket.on(SOCKET_EVENTS.RECORDING_START, (data: any) => this.handleStartRecording(socket, data));
    socket.on(SOCKET_EVENTS.RECORDING_STOP, (data: any) => this.handleStopRecording(socket, data));
    socket.on(SOCKET_EVENTS.RECORDING_STATUS, (data: any) => this.handleGetStatus(socket, data));
    socket.on('recording:chunk', (data: any) => this.handleRecordingChunk(socket, data));
    socket.on(SOCKET_EVENTS.RECORDING_FINALIZE, (data: any) => this.handleFinalizeRecording(socket, data));
  }
}
