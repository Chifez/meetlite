import * as Y from 'yjs';
import {
  YjsProviderConfig,
  YjsProvider as IYjsProvider,
  YjsDocument,
  YjsDocumentConfig,
  YjsMessageType,
  YjsError,
  YjsErrorCode,
} from './types';
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
} from 'y-protocols/awareness';
import { encodeStateVector, applyUpdate } from 'yjs';
import { awarenessManager } from './yjs-awareness-manager';

/**
 * Yjs Provider that connects to our Socket.IO MediaSoup service
 * Bridges Yjs binary protocol with Socket.IO events
 */
export class YjsProvider implements IYjsProvider {
  config: YjsProviderConfig;
  documents: Map<string, YjsDocument>;
  awareness: Map<string, Awareness>;
  connected: boolean;
  private eventListeners: Map<string, Set<Function>>;

  constructor(config: YjsProviderConfig) {
    this.config = config;
    this.documents = new Map();
    this.awareness = new Map();
    this.connected = false;
    this.eventListeners = new Map();

    console.log('[YjsProvider] Initialized with config:', {
      roomId: config.roomId,
      userId: config.userId,
      userName: config.userName,
    });
  }

  /**
   * Connect to WebSocket and setup event listeners
   */
  connect(): void {
    if (!this.config.socket) {
      throw new YjsError('Socket not provided', YjsErrorCode.CONNECTION_FAILED);
    }

    if (this.connected) {
      console.warn('[YjsProvider] Already connected');
      return;
    }

    console.log('[YjsProvider] Connecting...');

    // Setup Socket.IO event listeners
    this.setupSocketListeners();

    this.connected = true;
    this.emit('connected');

    console.log('[YjsProvider] Connected successfully');
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (!this.connected) return;

    console.log('[YjsProvider] Disconnecting...');

    // Cleanup all documents
    this.documents.forEach((_doc, docId) => {
      this.destroyDocument(docId);
    });

    // Remove socket listeners
    if (this.config.socket) {
      this.config.socket.off('yjs:sync-step2');
      this.config.socket.off('yjs:update');
      this.config.socket.off('yjs:awareness');
    }

    this.connected = false;
    this.emit('disconnected');

    console.log('[YjsProvider] Disconnected');
  }

  /**
   * Get or create a Yjs document
   */
  getOrCreateDocument(docId: string, type: YjsDocumentConfig['type']): Y.Doc {
    let yjsDoc = this.documents.get(docId);

    if (yjsDoc) {
      console.log(`[YjsProvider] Document ${docId} already exists`);
      return yjsDoc.doc;
    }

    console.log(
      `[YjsProvider] Creating new document: ${docId} (type: ${type})`
    );

    // Create new Y.Doc
    const doc = new Y.Doc();

    // Create awareness
    const awareness = new Awareness(doc);

    // Set local awareness state
    awareness.setLocalState({
      userId: this.config.userId,
      userName: this.config.userName,
      userEmail: this.config.userEmail,
      userColor: this.generateUserColor(this.config.userId),
      cursor: null,
      selection: null,
      activeNodeId: null,
      activeFieldName: null,
      lastActivity: Date.now(),
      isActive: true,
    });

    // Create document config
    const config: YjsDocumentConfig = {
      roomId: this.config.roomId,
      docId,
      type,
    };

    // Store document
    const yjsDocument: YjsDocument = {
      doc,
      config,
      awareness,
      synced: false,
    };

    this.documents.set(docId, yjsDocument);
    this.awareness.set(docId, awareness);

    // Register awareness with awareness manager
    awarenessManager.register(docId, awareness);

    // Setup document update listener
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      // Don't broadcast updates that came from remote
      if (origin === 'remote') return;

      this.broadcastUpdate(docId, update);
    });

    // Setup awareness update listener
    awareness.on('update', ({ added, updated, removed }: any) => {
      const awarenessUpdate = encodeAwarenessUpdate(awareness, [
        ...added,
        ...updated,
        ...removed,
      ]);
      this.broadcastAwarenessUpdate(docId, awarenessUpdate);
    });

    // Request initial sync from server
    this.requestSync(docId);

    return doc;
  }

  /**
   * Destroy a document and cleanup
   */
  destroyDocument(docId: string): void {
    const yjsDoc = this.documents.get(docId);
    if (!yjsDoc) return;

    console.log(`[YjsProvider] Destroying document: ${docId}`);

    // Unregister awareness from manager
    awarenessManager.unregister(docId);

    // Cleanup awareness
    yjsDoc.awareness?.destroy();

    // Cleanup document
    yjsDoc.doc.destroy();

    // Remove from maps
    this.documents.delete(docId);
    this.awareness.delete(docId);
  }

  /**
   * Broadcast document update to server
   */
  private broadcastUpdate(docId: string, update: Uint8Array): void {
    if (!this.config.socket || !this.connected) return;

    // Convert Uint8Array to ArrayBuffer for proper Socket.IO binary transmission
    const updateBuffer = update.buffer.slice(
      update.byteOffset,
      update.byteOffset + update.byteLength
    );

    const message = {
      type: YjsMessageType.SYNC_UPDATE,
      roomId: this.config.roomId,
      docId,
      update: updateBuffer,
      timestamp: Date.now(),
    };

    console.log(`[YjsProvider] Broadcasting update for ${docId}`, {
      updateSize: update.length,
    });

    this.config.socket.emit('yjs:update', message);
  }

  /**
   * Broadcast awareness update to server
   */
  private broadcastAwarenessUpdate(docId: string, update: Uint8Array): void {
    if (!this.config.socket || !this.connected) return;

    // Convert Uint8Array to ArrayBuffer for proper Socket.IO binary transmission
    const updateBuffer = update.buffer.slice(
      update.byteOffset,
      update.byteOffset + update.byteLength
    );

    const message = {
      type: YjsMessageType.AWARENESS,
      roomId: this.config.roomId,
      docId,
      update: updateBuffer,
      timestamp: Date.now(),
    };

    this.config.socket.emit('yjs:awareness', message);
  }

  /**
   * Request sync from server (Step 1 of sync protocol)
   */
  private requestSync(docId: string): void {
    if (!this.config.socket || !this.connected) return;

    const yjsDoc = this.documents.get(docId);
    if (!yjsDoc) return;

    const stateVector = encodeStateVector(yjsDoc.doc);

    // Convert Uint8Array to ArrayBuffer for proper Socket.IO binary transmission
    const stateVectorBuffer = stateVector.buffer.slice(
      stateVector.byteOffset,
      stateVector.byteOffset + stateVector.byteLength
    );

    const message = {
      type: YjsMessageType.SYNC_STEP1,
      roomId: this.config.roomId,
      docId,
      update: stateVectorBuffer,
      timestamp: Date.now(),
    };

    console.log(`[YjsProvider] Requesting sync for ${docId}`);

    this.config.socket.emit('yjs:sync-step1', message);
  }

  /**
   * Setup Socket.IO event listeners
   */
  private setupSocketListeners(): void {
    if (!this.config.socket) return;

    // Sync Step 2: Receive full state from server
    this.config.socket.on('yjs:sync-step2', (message: any) => {
      console.log('[YjsProvider] Received yjs:sync-step2', {
        docId: message.docId,
        hasUpdate: !!message.update,
      });
      this.handleSyncStep2(message);
    });

    // Receive incremental updates
    this.config.socket.on('yjs:update', (message: any) => {
      console.log('[YjsProvider] Received yjs:update', {
        docId: message.docId,
        hasUpdate: !!message.update,
      });
      this.handleUpdate(message);
    });

    // Receive awareness updates
    this.config.socket.on('yjs:awareness', (message: any) => {
      this.handleAwarenessUpdate(message);
    });
  }

  /**
   * Handle Sync Step 2 (full state from server)
   */
  private handleSyncStep2(message: any): void {
    const { docId, update } = message;
    const yjsDoc = this.documents.get(docId);

    if (!yjsDoc || !update) {
      console.warn(
        `[YjsProvider] Received sync for unknown document: ${docId}`
      );
      return;
    }

    try {
      // Convert ArrayBuffer back to Uint8Array if needed
      const updateArray =
        update instanceof Uint8Array ? update : new Uint8Array(update);

      console.log(`[YjsProvider] Applying full sync for ${docId}`, {
        updateSize: updateArray.length,
      });

      // Apply update from server
      applyUpdate(yjsDoc.doc, updateArray, 'remote');

      // Mark as synced
      yjsDoc.synced = true;
      this.emit('synced', docId);

      console.log(`[YjsProvider] Document ${docId} synced successfully`);
    } catch (error) {
      console.error(`[YjsProvider] Error applying sync for ${docId}:`, error);
    }
  }

  /**
   * Handle incremental update from server
   */
  private handleUpdate(message: any): void {
    const { docId, update } = message;
    const yjsDoc = this.documents.get(docId);

    if (!yjsDoc || !update) return;

    try {
      // Convert ArrayBuffer back to Uint8Array if needed
      const updateArray =
        update instanceof Uint8Array ? update : new Uint8Array(update);

      console.log(`[YjsProvider] Applying update for ${docId}`, {
        updateSize: updateArray.length,
      });

      // Apply update from server
      applyUpdate(yjsDoc.doc, updateArray, 'remote');
      this.emit('update', docId, updateArray);
    } catch (error) {
      console.error(`[YjsProvider] Error applying update for ${docId}:`, error);
    }
  }

  /**
   * Handle awareness update from server
   */
  private handleAwarenessUpdate(message: any): void {
    const { docId, update } = message;
    const awareness = this.awareness.get(docId);

    if (!awareness || !update) return;

    try {
      // Convert ArrayBuffer back to Uint8Array if needed
      const updateArray =
        update instanceof Uint8Array ? update : new Uint8Array(update);

      // Apply awareness update
      applyAwarenessUpdate(awareness, updateArray, 'remote');
    } catch (error) {
      console.error(
        `[YjsProvider] Error applying awareness update for ${docId}:`,
        error
      );
    }
  }

  /**
   * Sync a document manually
   */
  syncDocument(docId: string, update: Uint8Array): void {
    const yjsDoc = this.documents.get(docId);
    if (!yjsDoc) return;

    applyUpdate(yjsDoc.doc, update, 'remote');
  }

  /**
   * Broadcast awareness state manually
   */
  broadcastAwareness(docId: string, state: Partial<any>): void {
    const awareness = this.awareness.get(docId);
    if (!awareness) return;

    const currentState = awareness.getLocalState();
    awareness.setLocalState({
      ...currentState,
      ...state,
      lastActivity: Date.now(),
    });
  }

  /**
   * Generate unique color for user
   */
  private generateUserColor(userId: string): string {
    const colors = [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#FFA07A',
      '#98D8C8',
      '#F7DC6F',
      '#BB8FCE',
      '#85C1E2',
      '#F8B739',
      '#52B788',
    ];

    // Simple hash function to get consistent color per user
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Event emitter methods
   */
  private emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (!listeners) return;

    listeners.forEach((listener) => {
      try {
        listener(...args);
      } catch (error) {
        console.error(
          `[YjsProvider] Error in event listener for ${event}:`,
          error
        );
      }
    });
  }

  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }
}
