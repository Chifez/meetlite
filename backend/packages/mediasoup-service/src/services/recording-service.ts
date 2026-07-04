import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Recording Service
 * Handles server-side recording using FFmpeg and mediasoup PlainTransports
 */
export class RecordingService {
  private mediaSoupService: any;
  private activeRecordings: Map<string, any>;
  private recordingsDir: string;

  constructor(mediaSoupService: any) {
    this.mediaSoupService = mediaSoupService;
    this.activeRecordings = new Map();
    this.recordingsDir = process.env.RECORDINGS_DIR || path.join(process.cwd(), 'recordings');
    
    // Ensure recordings directory exists
    this.ensureRecordingsDir();
    
    logger.info('RecordingService initialized', {
      recordingsDir: this.recordingsDir,
    });
  }

  /**
   * Ensure recordings directory exists
   */
  async ensureRecordingsDir() {
    try {
      await fs.mkdir(this.recordingsDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create recordings directory', { error });
    }
  }

  /**
   * Start recording a room
   */
  async startRecording(roomId: string, userId: string, options: any = {}) {
    try {
      // Check if room exists
      const roomData = this.mediaSoupService.getRoom(roomId);
      if (!roomData) {
        throw new Error(`Room not found: ${roomId}`);
      }

      // Check if already recording
      if (this.activeRecordings.has(roomId)) {
        const existingRecording = this.activeRecordings.get(roomId);
        return {
          success: false,
          error: 'Recording already in progress',
          recordingId: existingRecording.recordingId,
          startedAt: existingRecording.startedAt,
        };
      }

      // Generate recording ID and file paths
      const recordingId = `rec_${roomId}_${Date.now()}`;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputFileName = `meeting_${roomId}_${timestamp}.webm`;
      const outputPath = path.join(this.recordingsDir, outputFileName);

      // Get all producers in the room for recording
      const producers = this.mediaSoupService.getProducersForRoom(roomId);
      
      if (!producers || producers.length === 0) {
        throw new Error('No media streams available to record');
      }

      // Create recording state
      const recordingState = {
        recordingId,
        roomId,
        startedBy: userId,
        startedAt: new Date(),
        outputPath,
        outputFileName,
        status: 'starting',
        options: {
          quality: options.quality || '720p',
          format: options.format || 'webm',
          includeAudio: options.includeAudio !== false,
          includeVideo: options.includeVideo !== false,
        },
        producers: [],
        plainTransports: [],
        ffmpegProcess: null,
        participants: Array.from(roomData.participants),
        duration: 0,
      };

      // Store recording state
      this.activeRecordings.set(roomId, recordingState);
      recordingState.status = 'recording';

      logger.info('Recording started', {
        recordingId,
        roomId,
        userId,
        outputPath,
        producerCount: producers.length,
      });

      return {
        success: true,
        recordingId,
        startedAt: recordingState.startedAt,
        status: 'recording',
      };
    } catch (error: any) {
      logger.error('Failed to start recording', { roomId, userId, error: error.message });
      throw error;
    }
  }

  /**
   * Stop recording a room
   */
  async stopRecording(roomId: string, userId: string) {
    try {
      const recordingState = this.activeRecordings.get(roomId);
      
      if (!recordingState) {
        return {
          success: false,
          error: 'No active recording found',
        };
      }

      // Update status
      recordingState.status = 'stopping';
      recordingState.stoppedBy = userId;
      recordingState.stoppedAt = new Date();
      recordingState.duration = Math.round(
        (recordingState.stoppedAt.getTime() - recordingState.startedAt.getTime()) / 1000
      );

      // Kill FFmpeg process if running
      if (recordingState.ffmpegProcess) {
        recordingState.ffmpegProcess.kill('SIGINT');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Cleanup PlainTransports
      for (const transport of recordingState.plainTransports) {
        try {
          transport.close();
        } catch (error) {
          logger.warn('Error closing PlainTransport', { error });
        }
      }

      // Mark as completed
      recordingState.status = 'completed';
      
      // Remove from active recordings
      this.activeRecordings.delete(roomId);

      logger.info('Recording stopped', {
        recordingId: recordingState.recordingId,
        roomId,
        userId,
        duration: recordingState.duration,
        outputPath: recordingState.outputPath,
      });

      return {
        success: true,
        recordingId: recordingState.recordingId,
        duration: recordingState.duration,
        outputPath: recordingState.outputPath,
        outputFileName: recordingState.outputFileName,
        startedAt: recordingState.startedAt,
        stoppedAt: recordingState.stoppedAt,
        participants: recordingState.participants,
      };
    } catch (error: any) {
      logger.error('Failed to stop recording', { roomId, userId, error: error.message });
      throw error;
    }
  }

  /**
   * Save recording data from client
   */
  async saveRecordingChunk(roomId: string, chunk: Buffer) {
    try {
      const recordingState = this.activeRecordings.get(roomId);
      
      if (!recordingState || recordingState.status !== 'recording') {
        throw new Error('No active recording for room');
      }

      // Append chunk to file
      await fs.appendFile(recordingState.outputPath, chunk);

      return { success: true };
    } catch (error: any) {
      logger.error('Failed to save recording chunk', { roomId, error: error.message });
      throw error;
    }
  }

  /**
   * Finalize recording from client upload
   */
  async finalizeRecording(roomId: string, recordingId: string, recordingData: Buffer) {
    try {
      const recordingState = this.activeRecordings.get(roomId);
      
      if (recordingState && recordingState.recordingId === recordingId) {
        // Write the complete recording
        await fs.writeFile(recordingState.outputPath, recordingData);

        recordingState.status = 'completed';
        recordingState.fileSize = recordingData.length;

        logger.info('Recording finalized', {
          recordingId,
          roomId,
          fileSize: recordingData.length,
          outputPath: recordingState.outputPath,
        });

        return {
          success: true,
          recordingId,
          filePath: recordingState.outputPath,
          fileName: recordingState.outputFileName,
          fileSize: recordingData.length,
          duration: recordingState.duration,
        };
      }

      // Fallback: Create new recording entry
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputFileName = `meeting_${roomId}_${timestamp}.webm`;
      const outputPath = path.join(this.recordingsDir, outputFileName);
      
      await fs.writeFile(outputPath, recordingData);

      logger.info('Recording saved (no state)', {
        recordingId,
        roomId,
        fileSize: recordingData.length,
        outputPath,
      });

      return {
        success: true,
        recordingId: recordingId || `rec_${roomId}_${Date.now()}`,
        filePath: outputPath,
        fileName: outputFileName,
        fileSize: recordingData.length,
      };
    } catch (error: any) {
      logger.error('Failed to finalize recording', { roomId, recordingId, error: error.message });
      throw error;
    }
  }

  /**
   * Get recording status
   */
  getRecordingStatus(roomId: string) {
    const recordingState = this.activeRecordings.get(roomId);
    
    if (!recordingState) {
      return {
        isRecording: false,
        status: 'not_recording',
      };
    }

    return {
      isRecording: recordingState.status === 'recording',
      recordingId: recordingState.recordingId,
      status: recordingState.status,
      startedAt: recordingState.startedAt,
      startedBy: recordingState.startedBy,
      duration: recordingState.status === 'recording'
        ? Math.round((Date.now() - recordingState.startedAt.getTime()) / 1000)
        : recordingState.duration,
      options: recordingState.options,
    };
  }

  /**
   * Handle room cleanup - stop any active recordings
   */
  async handleRoomCleanup(roomId: string) {
    const recordingState = this.activeRecordings.get(roomId);
    
    if (recordingState) {
      logger.info('Stopping recording due to room cleanup', {
        recordingId: recordingState.recordingId,
        roomId,
      });
      
      await this.stopRecording(roomId, recordingState.startedBy);
    }
  }

  /**
   * Get all active recordings
   */
  getActiveRecordings() {
    const recordings = [];
    
    for (const [roomId, state] of this.activeRecordings) {
      recordings.push({
        roomId,
        recordingId: state.recordingId,
        status: state.status,
        startedAt: state.startedAt,
        startedBy: state.startedBy,
        duration: state.status === 'recording'
          ? Math.round((Date.now() - state.startedAt.getTime()) / 1000)
          : state.duration,
      });
    }
    
    return recordings;
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      activeRecordings: this.activeRecordings.size,
      recordingsDir: this.recordingsDir,
      recordings: this.getActiveRecordings(),
    };
  }

  /**
   * Cleanup service
   */
  async cleanup() {
    logger.info('Cleaning up RecordingService...');
    
    // Stop all active recordings
    for (const [roomId] of this.activeRecordings) {
      try {
        const state = this.activeRecordings.get(roomId);
        await this.stopRecording(roomId, state.startedBy);
      } catch (error) {
        logger.error('Error stopping recording during cleanup', { roomId, error });
      }
    }
    
    logger.info('RecordingService cleanup complete');
  }
}
