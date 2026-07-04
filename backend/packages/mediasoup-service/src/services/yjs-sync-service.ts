// @ts-ignore
import * as Y from 'yjs';
import { logger } from '../utils/logger.js';

/**
 * Yjs Sync Service
 * Handles Yjs document synchronization and awareness on the server
 */
export class YjsSyncService {
  private documents: Map<string, Map<string, any>>;
  private awareness: Map<string, Map<string, Map<string, any>>>;
  private cleanupInterval: any;

  constructor() {
    this.documents = new Map();
    this.awareness = new Map();

    logger.info('YjsSyncService initialized');
  }

  /**
   * Get or create a Yjs document
   */
  getOrCreateDocument(roomId: string, docId: string) {
    if (!this.documents.has(roomId)) {
      this.documents.set(roomId, new Map());
    }

    const roomDocs = this.documents.get(roomId)!;

    if (!roomDocs.has(docId)) {
      const doc = new Y.Doc();
      roomDocs.set(docId, doc);

      logger.debug('Created new Yjs document', { roomId, docId });

      doc.on('update', (update: any, origin: any) => {
        this.handleDocumentUpdate(roomId, docId, update, origin);
      });
    }

    return roomDocs.get(docId)!;
  }

  /**
   * Handle document update (for persistence or logging)
   */
  handleDocumentUpdate(roomId: string, docId: string, update: any, origin: any) {
    logger.debug('Document updated', {
      roomId,
      docId,
      updateSize: update.length,
      origin,
    });
  }

  /**
   * Apply update to document
   */
  applyUpdate(roomId: string, docId: string, update: Uint8Array) {
    const doc = this.getOrCreateDocument(roomId, docId);

    try {
      Y.applyUpdate(doc, update);
      logger.debug('Applied update to document', {
        roomId,
        docId,
        updateSize: update.length,
      });
      return true;
    } catch (error: any) {
      logger.error('Failed to apply update', {
        roomId,
        docId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get document state as update (for sync step 2)
   */
  getDocumentState(roomId: string, docId: string, stateVector: Uint8Array | null = null) {
    const doc = this.getOrCreateDocument(roomId, docId);

    try {
      if (stateVector) {
        return Y.encodeStateAsUpdate(doc, stateVector);
      } else {
        return Y.encodeStateAsUpdate(doc);
      }
    } catch (error: any) {
      logger.error('Failed to get document state', {
        roomId,
        docId,
        error: error.message,
      });
      return new Uint8Array(0);
    }
  }

  /**
   * Handle awareness update
   */
  updateAwareness(roomId: string, docId: string, clientId: string, awarenessState: any) {
    if (!this.awareness.has(roomId)) {
      this.awareness.set(roomId, new Map());
    }

    const roomAwareness = this.awareness.get(roomId)!;

    if (!roomAwareness.has(docId)) {
      roomAwareness.set(docId, new Map());
    }

    const docAwareness = roomAwareness.get(docId)!;

    if (awarenessState === null) {
      docAwareness.delete(clientId);
      logger.debug('Removed awareness state', { roomId, docId, clientId });
    } else {
      docAwareness.set(clientId, {
        ...awarenessState,
        clientId,
        lastUpdate: Date.now(),
      });
      logger.debug('Updated awareness state', { roomId, docId, clientId });
    }
  }

  /**
   * Get all awareness states for a document
   */
  getAwarenessStates(roomId: string, docId: string) {
    const roomAwareness = this.awareness.get(roomId);
    if (!roomAwareness) return [];

    const docAwareness = roomAwareness.get(docId);
    if (!docAwareness) return [];

    return Array.from(docAwareness.values());
  }

  /**
   * Clean up old awareness states (inactive users)
   */
  cleanupAwareness(roomId: string, docId: string, timeout = 30000) {
    const roomAwareness = this.awareness.get(roomId);
    if (!roomAwareness) return 0;

    const docAwareness = roomAwareness.get(docId);
    if (!docAwareness) return 0;

    const now = Date.now();
    const toRemove: string[] = [];

    docAwareness.forEach((state: any, clientId: string) => {
      if (now - state.lastUpdate > timeout) {
        toRemove.push(clientId);
      }
    });

    toRemove.forEach((clientId) => {
      docAwareness.delete(clientId);
      logger.debug('Cleaned up inactive awareness', {
        roomId,
        docId,
        clientId,
      });
    });

    return toRemove.length;
  }

  /**
   * Destroy document and cleanup
   */
  destroyDocument(roomId: string, docId: string) {
    const roomDocs = this.documents.get(roomId);
    if (roomDocs) {
      const doc = roomDocs.get(docId);
      if (doc) {
        doc.destroy();
        roomDocs.delete(docId);
        logger.info('Destroyed Yjs document', { roomId, docId });
      }
    }

    const roomAwareness = this.awareness.get(roomId);
    if (roomAwareness) {
      roomAwareness.delete(docId);
    }
  }

  /**
   * Destroy all documents for a room
   */
  destroyRoom(roomId: string) {
    const roomDocs = this.documents.get(roomId);
    if (roomDocs) {
      roomDocs.forEach((doc: any, docId: string) => {
        doc.destroy();
        logger.debug('Destroyed document', { roomId, docId });
      });
      this.documents.delete(roomId);
    }

    this.awareness.delete(roomId);

    logger.info('Destroyed all Yjs documents for room', { roomId });
  }

  /**
   * Get statistics
   */
  getStats() {
    let totalDocs = 0;
    let totalAwarenessStates = 0;

    this.documents.forEach((roomDocs) => {
      totalDocs += roomDocs.size;
    });

    this.awareness.forEach((roomAwareness) => {
      roomAwareness.forEach((docAwareness) => {
        totalAwarenessStates += docAwareness.size;
      });
    });

    return {
      rooms: this.documents.size,
      documents: totalDocs,
      awarenessStates: totalAwarenessStates,
    };
  }

  /**
   * Periodic cleanup of inactive awareness states
   */
  startAwarenessCleanup(interval = 60000) {
    this.cleanupInterval = setInterval(() => {
      let totalCleaned = 0;

      this.documents.forEach((roomDocs, roomId) => {
        roomDocs.forEach((doc, docId) => {
          const cleaned = this.cleanupAwareness(roomId, docId);
          totalCleaned += cleaned;
        });
      });

      if (totalCleaned > 0) {
        logger.info('Awareness cleanup completed', { cleaned: totalCleaned });
      }
    }, interval);

    logger.info('Started awareness cleanup task', { interval });
  }

  /**
   * Stop cleanup task
   */
  stopAwarenessCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      logger.info('Stopped awareness cleanup task');
    }
  }
}
