import { TLSocketRoom } from '@tldraw/sync-core';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export class TldrawService {
  constructor() {
    this.tldrawRooms = new Map();
    this.DIR = './.tldraw-rooms';
    // Per-room mutexes instead of global mutex
    this.roomMutexes = new Map();

    // Start persistence interval
    this.startPersistenceInterval();
  }

  // Validate roomId to prevent security issues
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

  // Get or create mutex for a specific room
  getRoomMutex(roomId) {
    if (!this.roomMutexes.has(roomId)) {
      this.roomMutexes.set(roomId, Promise.resolve(null));
    }
    return this.roomMutexes.get(roomId);
  }

  // Clean up mutex when room is deleted
  cleanupRoomMutex(roomId) {
    this.roomMutexes.delete(roomId);
  }

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
      console.error(`Error reading snapshot for room ${roomId}:`, error);
      return undefined;
    }
  }

  async saveSnapshot(roomId, snapshot) {
    try {
      await mkdir(this.DIR, { recursive: true });
      await writeFile(join(this.DIR, roomId), JSON.stringify(snapshot));
    } catch (error) {
      console.error(`Error saving snapshot for room ${roomId}:`, error);
      // Don't throw - we don't want to crash the server if disk is full
    }
  }

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
        const initialSnapshot = await this.readSnapshotIfExists(
          validatedRoomId
        );

        const room = new TLSocketRoom({
          initialSnapshot,
          onSessionRemoved: (room, args) => {
            if (args.numSessionsRemaining === 0) {
              room.close();
              this.tldrawRooms.delete(validatedRoomId);
              this.cleanupRoomMutex(validatedRoomId);
            }
          },
          onDataChange: () => {
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
        console.error(`Error in room operation for ${validatedRoomId}:`, error);
        return error;
      });

    // Update the mutex for this room
    this.roomMutexes.set(validatedRoomId, roomMutex);

    const err = await roomMutex;
    if (err) throw err;
    return this.tldrawRooms.get(validatedRoomId);
  }

  startPersistenceInterval() {
    // Do persistence on a regular interval.
    // In production you probably want a smarter system with throttling.
    setInterval(() => {
      for (const [roomId, room] of this.tldrawRooms.entries()) {
        if (room.needsPersist) {
          // persist room
          room.needsPersist = false;
          this.saveSnapshot(roomId, room.getCurrentSnapshot());
        }
        if (room.isClosed()) {
          this.tldrawRooms.delete(roomId);
          this.cleanupRoomMutex(roomId);
        }
      }
    }, 2000);
  }

  handleWebSocketConnection(ws, req) {
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
            room.handleSocketClose(sessionId);
          });

          ws.on('error', (error) => {
            console.error(
              `Tldraw socket error for session: ${sessionId}`,
              error
            );
            room.handleSocketError(sessionId);
          });
        })
        .catch((error) => {
          console.error('Error loading Tldraw room:', error);
          ws.close(1000, 'Failed to load room');
        });
    } catch (error) {
      console.error('Invalid room ID:', error.message);
      ws.close(1000, error.message);
    }
  }

  // Get room statistics for monitoring
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

  // Cleanup method for graceful shutdown
  cleanup() {
    for (const [roomId, room] of this.tldrawRooms.entries()) {
      if (room.needsPersist) {
        this.saveSnapshot(roomId, room.getCurrentSnapshot());
      }
      room.close();
    }
    this.tldrawRooms.clear();
    this.roomMutexes.clear();
  }
}
