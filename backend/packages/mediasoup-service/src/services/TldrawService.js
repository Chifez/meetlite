import { TLSocketRoom } from '@tldraw/sync-core';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { logger } from '../utils/logger.js';

/**
 * TldrawService - Handles Tldraw whiteboard functionality
 * Migrated from signaling service to MediaSoup service
 */
export class TldrawService {
  constructor() {
    this.tldrawRooms = new Map();
    this.DIR = './.tldraw-rooms';
    // Per-room mutexes instead of global mutex
    this.roomMutexes = new Map();

    // Start persistence interval
    this.startPersistenceInterval();

    logger.info('TldrawService initialized');
  }

  /**
   * Validate roomId to prevent security issues
   */
  validateRoomId(roomId) {
    if (!roomId) {
      throw new Error('Room ID is required');
    }

    // Only allow alphanumeric characters and hyphens/underscores
    const validRoomIdPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validRoomIdPattern.test(roomId)) {
      throw new Error('Invalid room ID format');
    }

    // Limit room ID length to prevent abuse
    if (roomId.length > 50) {
      throw new Error('Room ID too long');
    }

    // Prevent path traversal attacks
    if (
      roomId.includes('..') ||
      roomId.includes('/') ||
      roomId.includes('\\')
    ) {
      throw new Error('Invalid room ID characters');
    }

    return roomId;
  }

  /**
   * Get or create mutex for a specific room
   */
  getRoomMutex(roomId) {
    if (!this.roomMutexes.has(roomId)) {
      this.roomMutexes.set(roomId, Promise.resolve(null));
    }
    return this.roomMutexes.get(roomId);
  }

  /**
   * Clean up mutex when room is deleted
   */
  cleanupRoomMutex(roomId) {
    this.roomMutexes.delete(roomId);
  }

  /**
   * Read snapshot if it exists
   */
  async readSnapshotIfExists(roomId) {
    try {
      const data = await readFile(join(this.DIR, roomId));
      return JSON.parse(data.toString()) ?? undefined;
    } catch (error) {
      // Log specific error types for better debugging
      if (error.code === 'ENOENT') {
        // File doesn't exist, which is normal for new rooms
        return undefined;
      }
      logger.error(`Error reading snapshot for room ${roomId}`, {
        error: error.message,
      });
      return undefined;
    }
  }

  /**
   * Save snapshot to disk
   */
  async saveSnapshot(roomId, snapshot) {
    try {
      await mkdir(this.DIR, { recursive: true });
      await writeFile(join(this.DIR, roomId), JSON.stringify(snapshot));
      logger.debug(`Snapshot saved for room ${roomId}`);
    } catch (error) {
      logger.error(`Error saving snapshot for room ${roomId}`, {
        error: error.message,
      });
      // Don't throw - we don't want to crash the server if disk is full
    }
  }

  /**
   * Make or load a Tldraw room
   */
  async makeOrLoadRoom(roomId) {
    // Validate roomId first
    const validatedRoomId = this.validateRoomId(roomId);

    // Get room-specific mutex
    let roomMutex = this.getRoomMutex(validatedRoomId);

    roomMutex = roomMutex
      .then(async () => {
        if (this.tldrawRooms.has(validatedRoomId)) {
          const room = this.tldrawRooms.get(validatedRoomId);
          if (!room.isClosed()) {
            return null; // all good
          }
        }

        logger.info('Loading Tldraw room', { roomId: validatedRoomId });
        const initialSnapshot = await this.readSnapshotIfExists(
          validatedRoomId
        );

        const room = new TLSocketRoom({
          initialSnapshot,
          onSessionRemoved: (room, args) => {
            logger.info('Tldraw client disconnected', {
              sessionId: args.sessionId,
              roomId: validatedRoomId,
            });
            if (args.numSessionsRemaining === 0) {
              logger.info('Closing Tldraw room', { roomId: validatedRoomId });
              room.close();
              this.tldrawRooms.delete(validatedRoomId);
              this.cleanupRoomMutex(validatedRoomId);
            }
          },
          onDataChange: () => {
            logger.debug('Tldraw data changed in room', {
              roomId: validatedRoomId,
            });
            // Mark for persistence
            room.needsPersist = true;
          },
        });

        room.needsPersist = false;
        this.tldrawRooms.set(validatedRoomId, room);
        return null; // all good
      })
      .catch((error) => {
        // Log the error but don't stop the mutex chain
        logger.error(`Error in room operation for ${validatedRoomId}`, {
          error: error.message,
        });
        return error;
      });

    // Update the mutex for this room
    this.roomMutexes.set(validatedRoomId, roomMutex);

    const err = await roomMutex;
    if (err) throw err;
    return this.tldrawRooms.get(validatedRoomId);
  }

  /**
   * Start persistence interval for saving room snapshots
   */
  startPersistenceInterval() {
    // Do persistence on a regular interval.
    // In production you probably want a smarter system with throttling.
    setInterval(() => {
      for (const [roomId, room] of this.tldrawRooms.entries()) {
        if (room.needsPersist) {
          // persist room
          room.needsPersist = false;
          logger.debug('Saving Tldraw snapshot', { roomId });
          this.saveSnapshot(roomId, room.getCurrentSnapshot());
        }
        if (room.isClosed()) {
          logger.info('Deleting Tldraw room', { roomId });
          this.tldrawRooms.delete(roomId);
          this.cleanupRoomMutex(roomId);
        }
      }
    }, 2000);
  }

  /**
   * Handle WebSocket connection for Tldraw
   */
  handleWebSocketConnection(ws, req) {
    logger.info('Tldraw WebSocket connection established');

    const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
    const rawRoomId = pathname.split('/connect/')[1];

    try {
      // Validate roomId
      const roomId = this.validateRoomId(rawRoomId);

      const sessionId =
        'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

      this.makeOrLoadRoom(roomId)
        .then((room) => {
          // Handle the WebSocket connection
          room.handleSocketConnect({
            sessionId: sessionId,
            socket: ws,
            isReadonly: false, // Set to true if you want read-only clients
          });

          // Handle socket close events manually if needed
          ws.on('close', () => {
            logger.info(`Tldraw socket closed for session: ${sessionId}`, {
              roomId,
            });
            room.handleSocketClose(sessionId);
          });

          ws.on('error', (error) => {
            logger.error(`Tldraw socket error for session: ${sessionId}`, {
              error: error.message,
              roomId,
            });
            room.handleSocketError(sessionId);
          });
        })
        .catch((error) => {
          logger.error('Error loading Tldraw room', {
            error: error.message,
            roomId,
          });
          ws.close(1000, 'Failed to load room');
        });
    } catch (error) {
      logger.error('Invalid room ID', { error: error.message, rawRoomId });
      ws.close(1000, error.message);
    }
  }

  /**
   * Get room statistics for monitoring
   */
  getRoomStats() {
    return {
      totalRooms: this.tldrawRooms.size,
      activeRooms: Array.from(this.tldrawRooms.values()).filter(
        (room) => !room.isClosed()
      ).length,
      closedRooms: Array.from(this.tldrawRooms.values()).filter((room) =>
        room.isClosed()
      ).length,
      totalMutexes: this.roomMutexes.size,
    };
  }

  /**
   * Cleanup method for graceful shutdown
   */
  cleanup() {
    logger.info('Cleaning up Tldraw service...');
    for (const [roomId, room] of this.tldrawRooms.entries()) {
      if (room.needsPersist) {
        logger.info('Saving final snapshot for room', { roomId });
        this.saveSnapshot(roomId, room.getCurrentSnapshot());
      }
      room.close();
    }
    this.tldrawRooms.clear();
    this.roomMutexes.clear();
  }
}
