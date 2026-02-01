import { logger } from '../utils/logger.js';

/**
 * Recording Controller
 * Handles WebSocket events for recording functionality
 */
export class RecordingController {
  constructor(recordingService, io) {
    this.recordingService = recordingService;
    this.io = io;

    logger.info('RecordingController initialized');
  }

  /**
   * Handle recording:start event
   */
  async handleStartRecording(socket, data) {
    const { roomId, options = {} } = data;
    const userId = socket.user?.id;

    logger.info('Recording start request', { roomId, userId });

    try {
      const result = await this.recordingService.startRecording(roomId, userId, options);

      if (result.success) {
        // Notify all participants in the room
        this.io.to(roomId).emit('recording:started', {
          recordingId: result.recordingId,
          startedBy: userId,
          startedAt: result.startedAt,
        });

        socket.emit('recording:start-success', result);
      } else {
        socket.emit('recording:start-error', {
          error: result.error,
          recordingId: result.recordingId,
        });
      }

      return result;
    } catch (error) {
      logger.error('Failed to start recording', { roomId, userId, error: error.message });
      
      socket.emit('recording:start-error', {
        error: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Handle recording:stop event
   */
  async handleStopRecording(socket, data) {
    const { roomId } = data;
    const userId = socket.user?.id;

    logger.info('Recording stop request', { roomId, userId });

    try {
      const result = await this.recordingService.stopRecording(roomId, userId);

      if (result.success) {
        // Notify all participants in the room
        this.io.to(roomId).emit('recording:stopped', {
          recordingId: result.recordingId,
          stoppedBy: userId,
          duration: result.duration,
        });

        socket.emit('recording:stop-success', result);
      } else {
        socket.emit('recording:stop-error', {
          error: result.error,
        });
      }

      return result;
    } catch (error) {
      logger.error('Failed to stop recording', { roomId, userId, error: error.message });
      
      socket.emit('recording:stop-error', {
        error: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Handle recording:status event
   */
  handleGetStatus(socket, data) {
    const { roomId } = data;

    try {
      const status = this.recordingService.getRecordingStatus(roomId);
      socket.emit('recording:status', status);
      return status;
    } catch (error) {
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
  async handleRecordingChunk(socket, data) {
    const { roomId, chunk } = data;

    try {
      await this.recordingService.saveRecordingChunk(roomId, Buffer.from(chunk));
      return { success: true };
    } catch (error) {
      logger.error('Failed to save recording chunk', { roomId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle recording:finalize event (client uploading complete recording)
   */
  async handleFinalizeRecording(socket, data) {
    const { roomId, recordingId, recordingData, metadata = {} } = data;
    const userId = socket.user?.id;

    logger.info('Recording finalize request', { roomId, recordingId, userId });

    try {
      const result = await this.recordingService.finalizeRecording(
        roomId,
        recordingId,
        Buffer.from(recordingData)
      );

      if (result.success) {
        // Notify all participants
        this.io.to(roomId).emit('recording:finalized', {
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
    } catch (error) {
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
  setupSocketHandlers(socket) {
    socket.on('recording:start', (data) => this.handleStartRecording(socket, data));
    socket.on('recording:stop', (data) => this.handleStopRecording(socket, data));
    socket.on('recording:status', (data) => this.handleGetStatus(socket, data));
    socket.on('recording:chunk', (data) => this.handleRecordingChunk(socket, data));
    socket.on('recording:finalize', (data) => this.handleFinalizeRecording(socket, data));
  }
}

