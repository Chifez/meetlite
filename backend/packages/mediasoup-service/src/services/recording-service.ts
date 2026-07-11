import fs from 'fs/promises';
import path from 'path';
// @ts-ignore
import fetch from 'node-fetch';
import FormData from 'form-data';
import { logger } from '../utils/logger.js';
import { RECORDING_STATUSES } from '@minimeet/shared';


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
        status: RECORDING_STATUSES.STARTING as string,
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
      recordingState.status = RECORDING_STATUSES.RECORDING as string;

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
        status: RECORDING_STATUSES.RECORDING,
      };
    } catch (error: any) {
      logger.error('Failed to start recording', { roomId, userId, error: error.message });
      throw error;
    }
  }

  /**
   * Add a participant to an active recording
   */
  addParticipantToRecording(roomId: string, userId: string) {
    const recordingState = this.activeRecordings.get(roomId);
    if (recordingState && recordingState.status === RECORDING_STATUSES.RECORDING) {
      if (!recordingState.participants.includes(userId)) {
        recordingState.participants.push(userId);
        logger.info('Added late joiner to recording participants', { roomId, userId });
      }
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
      recordingState.status = RECORDING_STATUSES.STOPPING as string;
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
      
      if (!recordingState || recordingState.status !== RECORDING_STATUSES.RECORDING) {
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

        const result = {
          success: true,
          recordingId,
          filePath: recordingState.outputPath,
          fileName: recordingState.outputFileName,
          fileSize: recordingData.length,
          duration: recordingState.duration,
          roomId,
          startedBy: recordingState.startedBy,
          participants: recordingState.participants,
        };

        logger.info('Recording finalized', {
          recordingId,
          roomId,
          fileSize: recordingData.length,
          outputPath: recordingState.outputPath,
        });

        this.activeRecordings.delete(roomId);

        // Asynchronously upload to room-service for queued processing
        this.uploadToRoomService(result).catch((err) =>
          logger.error('Failed to upload recording to room-service', { recordingId, error: err.message })
        );

        return result;
      }

      // Fallback: Create new recording entry
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputFileName = `meeting_${roomId}_${timestamp}.webm`;
      const outputPath = path.join(this.recordingsDir, outputFileName);
      
      await fs.writeFile(outputPath, recordingData);

      const fallbackResult = {
        success: true,
        recordingId: recordingId || `rec_${roomId}_${Date.now()}`,
        filePath: outputPath,
        fileName: outputFileName,
        fileSize: recordingData.length,
        roomId,
      };

      logger.info('Recording saved (no state)', {
        recordingId,
        roomId,
        fileSize: recordingData.length,
        outputPath,
      });

      // Also upload fallback to room-service
      this.uploadToRoomService(fallbackResult).catch((err) =>
        logger.error('Failed to upload fallback recording to room-service', { recordingId, error: err.message })
      );

      return fallbackResult;
    } catch (error: any) {
      logger.error('Failed to finalize recording', { roomId, recordingId, error: error.message });
      throw error;
    }
  }

  /**
   * Upload a finalized recording file to room-service for async queue processing.
   */
  private async uploadToRoomService(recordingMeta: any): Promise<void> {
    const roomServiceUrl = process.env.ROOM_SERVICE_URL || 'http://localhost:5001';
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET || 'internal-secret';
    const endpoint = `${roomServiceUrl}/api/v1/recordings/internal-finalize`;

    try {
      const fileBuffer = await fs.readFile(recordingMeta.filePath);
      const form = new FormData();
      form.append('recording', fileBuffer, {
        filename: recordingMeta.fileName,
        contentType: 'video/webm',
      });
      form.append('roomId', recordingMeta.roomId || '');
      form.append('recordingId', recordingMeta.recordingId || '');
      form.append('duration', String(recordingMeta.duration || 0));
      form.append('fileSize', String(recordingMeta.fileSize || 0));
      form.append('startedBy', recordingMeta.startedBy || '');
      if (recordingMeta.participants) {
        form.append('participants', JSON.stringify(recordingMeta.participants));
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...form.getHeaders(),
          'x-internal-secret': internalSecret,
        },
        body: form,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`room-service responded with ${response.status}: ${text}`);
      }

      logger.info('Recording uploaded to room-service for queue processing', {
        recordingId: recordingMeta.recordingId,
        roomId: recordingMeta.roomId,
      });

      // Clean up local file after successful upload
      await fs.unlink(recordingMeta.filePath).catch(() => {});
    } catch (error: any) {
      logger.error('uploadToRoomService failed', { error: error.message, recordingMeta });
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
      isRecording: recordingState.status === RECORDING_STATUSES.RECORDING,
      recordingId: recordingState.recordingId,
      status: recordingState.status,
      startedAt: recordingState.startedAt,
      startedBy: recordingState.startedBy,
      duration: recordingState.status === RECORDING_STATUSES.RECORDING
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
        duration: state.status === RECORDING_STATUSES.RECORDING
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
