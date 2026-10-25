import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryRoomStorage } from './storage.js';
import { CollaborationManager } from './collaboration-manager.js';
import { HyperdriveClient } from './hyperdrive-client.js';
import * as Y from 'yjs';

function createYjsUpdates(count: number): Uint8Array[] {
  const doc = new Y.Doc();
  const values = doc.getArray<number>('strokes');
  const updates: Uint8Array[] = [];
  doc.on('update', (update: Uint8Array) => updates.push(update));
  for (let index = 0; index < count; index++) values.push([index]);
  doc.destroy();
  return updates;
}

describe('S5-01: Collaboration State Persistence, CRDT Compaction & Edge Hyperdrive', () => {
  let storage: InMemoryRoomStorage;
  let collabManager: CollaborationManager;

  beforeEach(async () => {
    storage = new InMemoryRoomStorage();
    await storage.initialize();
    collabManager = new CollaborationManager({
      storage,
      maxBatchSize: 5,
      compactionThreshold: 10,
      maxUpdateSizeBytes: 64 * 1024, // 64 KB test limit
    });
  });

  it('batches incremental CRDT updates in memory and flushes in a single transaction', async () => {
    const docName = 'whiteboard_main';
    const [stroke1, stroke2] = createYjsUpdates(2);

    // Queue 2 updates (below batch size 5)
    await collabManager.queueUpdate(docName, stroke1);
    await collabManager.queueUpdate(docName, stroke2);

    // Stored deltas in storage should still be 0 (buffered in memory)
    const storedBeforeFlush = await storage.listCollaborationUpdates(docName);
    assert.equal(storedBeforeFlush.length, 0, 'Updates must be buffered in memory prior to flush');

    // Flush to storage
    await collabManager.flush();

    // Now storage must contain the 2 batched deltas
    const storedAfterFlush = await storage.listCollaborationUpdates(docName);
    assert.equal(storedAfterFlush.length, 2);
    assert.deepEqual(storedAfterFlush[0].data, stroke1);
    assert.deepEqual(storedAfterFlush[1].data, stroke2);
  });

  it('automatically flushes when maxBatchSize is reached', async () => {
    const docName = 'notes_doc';

    for (const update of createYjsUpdates(5)) {
      await collabManager.queueUpdate(docName, update);
    }

    // Since maxBatchSize is 5, it should have auto-flushed
    const stored = await storage.listCollaborationUpdates(docName);
    assert.equal(stored.length, 5, 'Should have automatically flushed upon reaching maxBatchSize');
  });

  it('rejects updates exceeding maxUpdateSizeBytes', async () => {
    const docName = 'oversized_doc';
    const oversizedPayload = new Uint8Array(65 * 1024); // 65 KB exceeds 64 KB limit

    await assert.rejects(
      async () => {
        await collabManager.queueUpdate(docName, oversizedPayload);
      },
      /exceeds maximum permitted size/
    );
  });

  it('rejects malformed CRDT data before it can poison durable snapshots', async () => {
    await assert.rejects(
      collabManager.queueUpdate('whiteboard_main', new Uint8Array([1, 2, 3])),
      /not a valid Yjs update/
    );
  });

  it('preserves 100% of strokes across DO eviction and restart with measured latency (Zero Lost Strokes)', async () => {
    const docName = 'whiteboard_eviction_test';

    // 1. Host and participants draw strokes
    const strokes = createYjsUpdates(3);

    for (const stroke of strokes) {
      await collabManager.queueUpdate(docName, stroke);
    }
    await collabManager.flush();

    // 2. SIMULATE SUDDEN DURABLE OBJECT EVICTION / RESTART
    // The DO instance and CollaborationManager are discarded, simulating memory teardown.
    // The underlying SQLite storage remains intact.
    const rehydratedManager = new CollaborationManager({
      storage,
      maxBatchSize: 5,
      compactionThreshold: 10,
    });

    // 3. Rehydrated DO restores document state upon client reconnect
    const restored = await rehydratedManager.restoreDocument(docName);

    assert.equal(restored.documentName, docName);
    assert.equal(restored.totalDeltas, 3);
    assert.equal(restored.updates.length, 3);
    assert.ok(restored.restoreLatencyMs >= 0, 'Must record measured restoration latency');

    // Verify all strokes survived with exact byte equivalence
    for (let i = 0; i < strokes.length; i++) {
      assert.deepEqual(restored.updates[i], strokes[i], `Stroke ${i} must match exactly`);
    }
  });

  it('compacts accumulated deltas into a single snapshot and prunes SQLite delta history', async () => {
    const docName = 'high_churn_canvas';

    // Queue 10 updates (reaches compactionThreshold of 10)
    const updates = createYjsUpdates(11);
    for (const update of updates.slice(0, 10)) {
      await collabManager.queueUpdate(docName, update);
    }
    await collabManager.flush();

    // Compaction should have triggered automatically during flush
    const snapshot = await storage.getCollaborationSnapshot(docName);
    assert.ok(snapshot !== null, 'Canonical snapshot must exist after compaction');
    assert.equal(snapshot.revision, 1);
    assert.ok(snapshot.data.byteLength > 0);

    // Delta table must be pruned
    const deltaCount = await collabManager.getStoredDeltaCount(docName);
    assert.equal(deltaCount, 0, 'Deltas must be pruned following compaction');

    // Adding more updates accumulates post-compaction deltas
    await collabManager.queueUpdate(docName, updates[10]);
    await collabManager.flush();

    const postDeltaCount = await collabManager.getStoredDeltaCount(docName);
    assert.equal(postDeltaCount, 1);

    // Restoring after second restart yields snapshot + remaining delta
    const restored = await collabManager.restoreDocument(docName);
    assert.ok(restored.snapshot !== null);
    assert.equal(restored.totalDeltas, 1);
    assert.deepEqual(restored.updates[0], updates[10]);
  });

  it('isolates ephemeral awareness state and NEVER persists cursor movements to storage', async () => {
    const docName = 'shared_editor';

    // Participants broadcast cursor movements
    collabManager.updateAwareness(docName, 'client_alice', new Uint8Array([1, 10, 20]));
    collabManager.updateAwareness(docName, 'client_bob', new Uint8Array([2, 55, 80]));

    // Awareness map is available for live peers
    const liveAwareness = collabManager.getAwarenessStates(docName);
    assert.equal(liveAwareness.size, 2);
    assert.deepEqual(liveAwareness.get('client_alice'), new Uint8Array([1, 10, 20]));

    // Storage must be 100% untouched by awareness updates (zero write amplification)
    const storedDeltas = await storage.listCollaborationUpdates(docName);
    const storedSnapshot = await storage.getCollaborationSnapshot(docName);
    assert.equal(storedDeltas.length, 0, 'Awareness state must never be written to SQLite updates');
    assert.equal(storedSnapshot, null, 'Awareness state must never create snapshots');

    // Disconnecting client removes awareness
    collabManager.removeAwareness(docName, 'client_alice');
    assert.equal(collabManager.getAwarenessStates(docName).size, 1);
    assert.equal(collabManager.getAwarenessStates(docName).has('client_alice'), false);
  });

  it('exports compacted snapshot to Cloudflare R2 object storage with metadata', async () => {
    const docName = 'final_whiteboard';
    await collabManager.queueUpdate(docName, createYjsUpdates(1)[0]);
    await collabManager.flush();

    // Mock Cloudflare R2 bucket binding
    const r2Store = new Map<string, { value: Uint8Array; options: any }>();
    const mockR2Bucket = {
      async put(key: string, value: Uint8Array, options?: any) {
        r2Store.set(key, { value, options });
      },
    };

    const exportResult = await collabManager.exportSnapshotToR2(docName, mockR2Bucket, 'room_omega_77');

    assert.ok(exportResult.key.startsWith('rooms/room_omega_77/collaboration/final_whiteboard-rev1.bin'));
    assert.ok(exportResult.bytesWritten > 0);
    assert.equal(exportResult.revision, 1);

    const storedR2Object = r2Store.get(exportResult.key);
    assert.ok(storedR2Object);
    assert.equal(storedR2Object.value.byteLength, exportResult.bytesWritten);
    assert.equal(storedR2Object.options.customMetadata.roomId, 'room_omega_77');
    assert.equal(storedR2Object.options.customMetadata.documentName, docName);
  });

  it('enforces Hyperdrive dual-mode consistency: cached for public reads vs direct origin for admission', async () => {
    const executedQueries: Array<{ connectionString: string; sql: string; params: any[] }> = [];

    const hyperdriveClient = new HyperdriveClient({
      hyperdriveCached: {
        connectionString: 'postgres://user:secret@edge-hyperdrive.meetlite.internal:5432/meetlite',
      },
      hyperdriveUncached: {
        connectionString: 'postgres://user:secret@origin.meetlite.internal:5432/meetlite',
      },
      queryExecutor: async (connectionString, sql, params) => {
        executedQueries.push({ connectionString, sql, params });
        if (sql.includes('room_memberships')) {
          return [{ allowed: true, role: 'host' }];
        }
        if (sql.includes('rooms')) {
          return [{ id: 'room_101', active: true }];
        }
        return [];
      },
    });

    // 1. Public check: room existence (Stale-Tolerant Cached)
    const existsResult = await hyperdriveClient.checkRoomExists('room_101');
    assert.equal(existsResult.cacheBypassed, false, 'Room existence check can use cached edge read');
    assert.equal(existsResult.routedMode, 'cached_edge');
    assert.equal(existsResult.rows[0].id, 'room_101');

    // 2. Admission entitlement check: MUST BYPASS CACHE (Strongly Consistent)
    const admissionResult = await hyperdriveClient.verifyAdmissionEntitlement('room_101', 'usr_alice');
    assert.equal(admissionResult.cacheBypassed, true, 'Admission entitlement check must bypass cache');
    assert.equal(admissionResult.routedMode, 'direct_origin');
    assert.equal(admissionResult.rows[0].allowed, true);

    // Verify admission uses the separately configured cache-disabled binding.
    const admissionQuery = executedQueries.find((q) => q.sql.includes('room_memberships'));
    assert.ok(admissionQuery);
    assert.equal(
      admissionQuery.connectionString,
      'postgres://user:secret@origin.meetlite.internal:5432/meetlite'
    );
  });

  it('fails closed when no cache-disabled origin is configured for a strongly consistent query', async () => {
    const hyperdriveClient = new HyperdriveClient({
      hyperdriveCached: {
        connectionString: 'postgres://user:secret@edge-hyperdrive.meetlite.internal:5432/meetlite',
      },
    });

    assert.throws(
      () => hyperdriveClient.resolveConnectionString('strongly_consistent'),
      /cache-disabled Hyperdrive binding or direct-origin database URL/
    );
  });
});
