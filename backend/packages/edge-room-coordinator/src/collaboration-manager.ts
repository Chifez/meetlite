/**
 * Collaboration State Persistence & CRDT Compaction Manager
 *
 * Implements S5-01 / Phase 5: Manages real-time Yjs CRDT document persistence
 * in Durable Object SQLite with debounced batching, periodic snapshot compaction,
 * and ephemeral awareness isolation.
 */

import * as Y from 'yjs';
import { IRoomStorage, CollaborationSnapshot, CollaborationUpdate } from './storage.js';

export interface CollaborationManagerConfig {
  readonly storage: IRoomStorage;
  readonly maxBatchSize?: number; // Maximum updates before forcing an immediate SQLite write
  readonly compactionThreshold?: number; // Number of deltas before squashing to snapshot
  readonly flushIntervalMs?: number; // Debounce interval for batch writes
  readonly maxUpdateSizeBytes?: number; // Max size for single incremental update (default 512KB)
}

export interface RestoredDocumentState {
  readonly documentName: string;
  readonly snapshot: Uint8Array | null;
  readonly updates: Uint8Array[];
  readonly totalDeltas: number;
  readonly restoreLatencyMs: number;
}

export class CollaborationManager {
  private readonly storage: IRoomStorage;
  private readonly maxBatchSize: number;
  private readonly compactionThreshold: number;
  private readonly flushIntervalMs: number;
  private readonly maxUpdateSizeBytes: number;
  private readonly pendingUpdateBatches = new Map<string, Uint8Array[]>();
  private flushTimer: NodeJS.Timeout | null = null;

  // Ephemeral awareness tracking (held in memory, NEVER written to SQLite)
  private readonly awarenessStates = new Map<string, Map<string, Uint8Array>>();

  constructor(config: CollaborationManagerConfig) {
    this.storage = config.storage;
    this.maxBatchSize = config.maxBatchSize ?? 20;
    this.compactionThreshold = config.compactionThreshold ?? 50;
    this.flushIntervalMs = config.flushIntervalMs ?? 500;
    this.maxUpdateSizeBytes = config.maxUpdateSizeBytes ?? 512 * 1024; // 512 KB default limit
  }

  private validateDocumentName(documentName: string): void {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(documentName)) {
      throw new Error('Document name must contain only letters, numbers, underscores, or hyphens');
    }
  }

  /**
   * Enqueues an incremental CRDT update.
   * Batches writes to avoid one SQLite transaction per keystroke or stroke.
   */
  public async queueUpdate(documentName: string, update: Uint8Array): Promise<void> {
    this.validateDocumentName(documentName);
    if (update.byteLength > this.maxUpdateSizeBytes) {
      throw new Error(
        `Payload size ${update.byteLength} bytes exceeds maximum permitted size of ${this.maxUpdateSizeBytes} bytes`
      );
    }
    try {
      const validationDoc = new Y.Doc();
      Y.applyUpdate(validationDoc, update);
      validationDoc.destroy();
    } catch {
      throw new Error('Collaboration payload is not a valid Yjs update');
    }

    if (!this.pendingUpdateBatches.has(documentName)) {
      this.pendingUpdateBatches.set(documentName, []);
    }

    const batch = this.pendingUpdateBatches.get(documentName)!;
    batch.push(update);

    if (batch.length >= this.maxBatchSize) {
      await this.flushDocument(documentName);
    } else if (!this.flushTimer && this.flushIntervalMs > 0) {
      this.flushTimer = setTimeout(async () => {
        this.flushTimer = null;
        try {
          await this.flush();
        } catch (err) {
          console.error('Failed to flush collaboration updates on timer:', err);
        }
      }, this.flushIntervalMs);
      if (typeof (this.flushTimer as any)?.unref === 'function') {
        (this.flushTimer as any).unref();
      }
    }
  }

  /**
   * Flushes all pending in-memory update batches to SQLite storage
   */
  public async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    for (const docName of Array.from(this.pendingUpdateBatches.keys())) {
      await this.flushDocument(docName);
    }
  }

  private async flushDocument(documentName: string): Promise<void> {
    const batch = this.pendingUpdateBatches.get(documentName);
    if (!batch || batch.length === 0) return;

    const updatesToWrite = [...batch];
    this.pendingUpdateBatches.set(documentName, []);

    await this.storage.appendCollaborationUpdates(documentName, updatesToWrite);

    // Check if compaction threshold has been reached
    const existingUpdates = await this.storage.listCollaborationUpdates(documentName);
    if (existingUpdates.length >= this.compactionThreshold) {
      await this.compactDocument(documentName, existingUpdates);
    }
  }

  /**
   * Compacts accumulated incremental updates into a single canonical snapshot
   * using Yjs CRDT merging and prunes older deltas from SQLite.
   */
  public async compactDocument(
    documentName: string,
    updates?: CollaborationUpdate[]
  ): Promise<CollaborationSnapshot> {
    const allUpdates = updates ?? (await this.storage.listCollaborationUpdates(documentName));
    const previousSnapshot = await this.storage.getCollaborationSnapshot(documentName);

    const buffersToMerge: Uint8Array[] = [];
    if (previousSnapshot?.data && previousSnapshot.data.byteLength > 0) {
      buffersToMerge.push(previousSnapshot.data);
    }
    for (const u of allUpdates) {
      if (u.data && u.data.byteLength > 0) {
        buffersToMerge.push(u.data);
      }
    }

    let compactedBlob: Uint8Array;
    if (buffersToMerge.length === 0) {
      compactedBlob = new Uint8Array();
    } else {
      try {
        // Canonical Yjs update merging: squashes all updates into a single minimal binary update
        compactedBlob = Y.mergeUpdates(buffersToMerge);
      } catch {
        throw new Error(`Stored collaboration state for ${documentName} is not valid Yjs data`);
      }
    }

    const nextRevision = (previousSnapshot?.revision ?? 0) + 1;
    await this.storage.saveCollaborationSnapshot(documentName, compactedBlob, nextRevision);
    await this.storage.pruneCollaborationUpdates(documentName);

    return {
      documentName,
      data: compactedBlob,
      revision: nextRevision,
      compactedAt: Date.now(),
    };
  }

  /**
   * Restores document state after Durable Object hibernation or restart.
   * Accurately measures restoration latency.
   */
  public async restoreDocument(documentName: string): Promise<RestoredDocumentState> {
    this.validateDocumentName(documentName);
    const start = performance.now();

    // Flush any pending memory queue first
    await this.flushDocument(documentName);

    const snapshot = await this.storage.getCollaborationSnapshot(documentName);
    const updates = await this.storage.listCollaborationUpdates(documentName);

    const restoreLatencyMs = Number((performance.now() - start).toFixed(2));

    return {
      documentName,
      snapshot: snapshot?.data ?? null,
      updates: updates.map((u) => u.data),
      totalDeltas: updates.length,
      restoreLatencyMs,
    };
  }

  /**
   * Retrieves full consolidated document binary state for synchronization
   */
  public async getConsolidatedDocumentState(documentName: string): Promise<Uint8Array | null> {
    const restored = await this.restoreDocument(documentName);
    const buffersToMerge: Uint8Array[] = [];
    if (restored.snapshot && restored.snapshot.byteLength > 0) {
      buffersToMerge.push(restored.snapshot);
    }
    for (const u of restored.updates) {
      if (u && u.byteLength > 0) {
        buffersToMerge.push(u);
      }
    }
    if (buffersToMerge.length === 0) return null;
    if (buffersToMerge.length === 1) return buffersToMerge[0];

    try {
      return Y.mergeUpdates(buffersToMerge);
    } catch {
      throw new Error(`Stored collaboration state for ${documentName} is not valid Yjs data`);
    }
  }

  /**
   * Exports the latest canonical snapshot to Cloudflare R2 object storage.
   * Used for periodic checkpoints and archival upon room completion.
   */
  public async exportSnapshotToR2(
    documentName: string,
    r2Bucket: { put: (key: string, value: Uint8Array, options?: any) => Promise<any> },
    roomId: string = 'default'
  ): Promise<{ key: string; bytesWritten: number; revision: number }> {
    // Ensure document is compacted first to minimize object size
    const snapshot = await this.compactDocument(documentName);
    const key = `rooms/${roomId}/collaboration/${documentName}-rev${snapshot.revision}.bin`;

    await r2Bucket.put(key, snapshot.data, {
      customMetadata: {
        documentName,
        revision: String(snapshot.revision),
        compactedAt: String(snapshot.compactedAt),
        roomId,
      },
    });

    return {
      key,
      bytesWritten: snapshot.data.byteLength,
      revision: snapshot.revision,
    };
  }

  /**
   * Helper: returns the number of uncompacted delta updates stored in SQLite for a document.
   */
  public async getStoredDeltaCount(documentName: string): Promise<number> {
    const updates = await this.storage.listCollaborationUpdates(documentName);
    return updates.length;
  }

  /**
   * Ephemeral awareness update: updates in-memory cursor/presence state.
   * Deliberately never written to SQLite to avoid storage write amplification.
   */
  public updateAwareness(documentName: string, clientId: string, awarenessData: Uint8Array): void {
    this.validateDocumentName(documentName);
    if (awarenessData.byteLength > 64 * 1024) {
      throw new Error('Awareness payload exceeds maximum permitted size of 65536 bytes');
    }
    if (!this.awarenessStates.has(documentName)) {
      this.awarenessStates.set(documentName, new Map());
    }
    this.awarenessStates.get(documentName)!.set(clientId, awarenessData);
  }

  public removeAwareness(documentName: string, clientId: string): void {
    const docAwareness = this.awarenessStates.get(documentName);
    if (docAwareness) {
      docAwareness.delete(clientId);
    }
  }

  public removeAwarenessForClient(clientId: string): void {
    for (const docAwareness of this.awarenessStates.values()) {
      docAwareness.delete(clientId);
    }
  }

  public getAwarenessStates(documentName: string): ReadonlyMap<string, Uint8Array> {
    this.validateDocumentName(documentName);
    return this.awarenessStates.get(documentName) ?? new Map();
  }
}
