import { logger } from '../utils/logger.js';
import * as encoding from 'lib0/encoding.js';
import * as decoding from 'lib0/decoding.js';

/**
 * Yjs Controller
 * Handles Socket.IO events for Yjs synchronization
 */
export class YjsController {
  constructor(yjsSyncService, io) {
    this.yjsSyncService = yjsSyncService;
    this.io = io;

    logger.info('YjsController initialized');
  }

  /**
   * Handle Sync Step 1: Client requests sync
   */
  async handleSyncStep1(socket, data) {
    try {
      const { roomId, docId, update: stateVector } = data;
      const userId = socket.user.userId;

      if (!roomId || !docId) {
        logger.warn('Sync step 1: Missing roomId or docId', { userId });
        return;
      }

      // Convert ArrayBuffer to Uint8Array if needed
      const stateVectorArray = stateVector
        ? stateVector instanceof Uint8Array
          ? stateVector
          : new Uint8Array(stateVector)
        : null;

      logger.debug('Sync step 1 received', {
        roomId,
        docId,
        userId,
        stateVectorSize: stateVectorArray?.length || 0,
      });

      // Get document state based on client's state vector
      const docState = this.yjsSyncService.getDocumentState(
        roomId,
        docId,
        stateVectorArray
      );

      // Convert Uint8Array to ArrayBuffer for Socket.IO
      const docStateBuffer = docState.buffer.slice(
        docState.byteOffset,
        docState.byteOffset + docState.byteLength
      );

      // Send sync step 2 back to client
      const response = {
        roomId,
        docId,
        update: docStateBuffer,
        timestamp: Date.now(),
      };

      socket.emit('yjs:sync-step2', response);

      logger.debug('Sync step 2 sent', {
        roomId,
        docId,
        userId,
        updateSize: docState.length,
      });
    } catch (error) {
      logger.error('Failed to handle sync step 1', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Handle document update from client
   */
  async handleUpdate(socket, data) {
    try {
      const { roomId, docId, update } = data;
      const userId = socket.user.userId;

      if (!roomId || !docId || !update) {
        logger.warn('Update: Missing required fields', { userId });
        return;
      }

      // Convert ArrayBuffer to Uint8Array if needed
      const updateArray =
        update instanceof Uint8Array ? update : new Uint8Array(update);

      logger.debug('Update received', {
        roomId,
        docId,
        userId,
        updateSize: updateArray.length,
      });

      // Apply update to server-side document
      const success = this.yjsSyncService.applyUpdate(
        roomId,
        docId,
        updateArray
      );

      if (!success) {
        logger.error('Failed to apply update', { roomId, docId, userId });
        return;
      }

      // Convert back to ArrayBuffer for broadcasting
      const updateBuffer = updateArray.buffer.slice(
        updateArray.byteOffset,
        updateArray.byteOffset + updateArray.byteLength
      );

      // Broadcast update to all other clients in the room
      socket.to(roomId).emit('yjs:update', {
        roomId,
        docId,
        update: updateBuffer,
        timestamp: Date.now(),
      });

      logger.debug('Update broadcast', {
        roomId,
        docId,
        userId,
        updateSize: updateArray.length,
      });
    } catch (error) {
      logger.error('Failed to handle update', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Handle awareness update from client
   */
  async handleAwarenessUpdate(socket, data) {
    try {
      const { roomId, docId, update: awarenessUpdate } = data;
      const userId = socket.user.userId;

      if (!roomId || !docId) {
        logger.warn('Awareness: Missing roomId or docId', { userId });
        return;
      }

      // Convert ArrayBuffer to Uint8Array if needed
      const updateArray = awarenessUpdate
        ? awarenessUpdate instanceof Uint8Array
          ? awarenessUpdate
          : new Uint8Array(awarenessUpdate)
        : null;

      logger.debug('Awareness update received', {
        roomId,
        docId,
        userId,
        updateSize: updateArray?.length || 0,
      });

      // Convert back to ArrayBuffer for broadcasting
      const updateBuffer = updateArray
        ? updateArray.buffer.slice(
            updateArray.byteOffset,
            updateArray.byteOffset + updateArray.byteLength
          )
        : null;

      // Simply broadcast awareness update to all other clients in the room
      // No need to decode - clients handle their own awareness states
      socket.to(roomId).emit('yjs:awareness', {
        roomId,
        docId,
        update: updateBuffer,
        timestamp: Date.now(),
      });

      logger.debug('Awareness update broadcast', {
        roomId,
        docId,
        userId,
      });
    } catch (error) {
      logger.error('Failed to handle awareness update', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Handle awareness query (request all awareness states)
   * Note: Awareness is handled peer-to-peer by clients
   * Server just broadcasts updates, doesn't store state
   */
  async handleAwarenessQuery(socket, data) {
    try {
      const { roomId, docId } = data;
      const userId = socket.user.userId;

      if (!roomId || !docId) {
        logger.warn('Awareness query: Missing roomId or docId', { userId });
        return;
      }

      logger.debug('Awareness query received', { roomId, docId, userId });

      // Send empty awareness state - clients will sync via broadcasts
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 0); // 0 states
      const awarenessUpdate = encoding.toUint8Array(encoder);

      socket.emit('yjs:awareness', {
        roomId,
        docId,
        update: awarenessUpdate,
        timestamp: Date.now(),
      });

      logger.debug('Awareness query response sent (empty)', {
        roomId,
        docId,
        userId,
      });
    } catch (error) {
      logger.error('Failed to handle awareness query', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Handle client disconnect - cleanup awareness
   */
  async handleDisconnect(socket, roomId) {
    try {
      const userId = socket.user?.userId;

      if (!userId || !roomId) return;

      logger.info('Client disconnected, cleaning up Yjs awareness', {
        userId,
        roomId,
      });

      // Note: Awareness cleanup is handled automatically by the service's
      // periodic cleanup task. We could also do immediate cleanup here if needed.
    } catch (error) {
      logger.error('Failed to handle disconnect cleanup', {
        error: error.message,
      });
    }
  }

  /**
   * Handle room cleanup when all users leave
   */
  async handleRoomCleanup(roomId) {
    try {
      logger.info('Cleaning up Yjs documents for room', { roomId });
      this.yjsSyncService.destroyRoom(roomId);
    } catch (error) {
      logger.error('Failed to cleanup room', {
        roomId,
        error: error.message,
      });
    }
  }

  /**
   * Get Yjs statistics
   */
  async getStats() {
    try {
      return this.yjsSyncService.getStats();
    } catch (error) {
      logger.error('Failed to get Yjs stats', { error: error.message });
      return {
        rooms: 0,
        documents: 0,
        awarenessStates: 0,
      };
    }
  }
}
