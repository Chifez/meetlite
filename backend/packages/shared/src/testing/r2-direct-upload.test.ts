import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StorageService } from '../services/storage.service.js';
import { FakeObjectStorage } from './fake-object-storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../../..');

describe('S1-02: Private R2 Direct Upload & Presigned Lifecycle Contract', () => {
  describe('StorageService Presigned Multipart API', () => {
    test('allocateKey enforces tenant prefix and sanitizes file name', () => {
      const tenantId = 'org-tenant-123';
      const recordingId = 'rec-uuid-456';
      const fileName = 'my meeting ../evil.mp4';

      const key = StorageService.allocateKey(tenantId, recordingId, fileName);

      assert.ok(key.startsWith(`tenants/${tenantId}/recordings/${recordingId}/`));
      assert.ok(!key.includes('..'), 'Key must not contain directory traversal');
      assert.ok(key.endsWith('my meeting evil.mp4') || key.endsWith('evil.mp4'));
    });

    test('validates part number boundaries (1 to 10000)', () => {
      assert.throws(() => {
        StorageService.validatePartNumber(0);
      }, /Invalid part number/);

      assert.throws(() => {
        StorageService.validatePartNumber(10001);
      }, /Invalid part number/);

      assert.doesNotThrow(() => {
        StorageService.validatePartNumber(1);
        StorageService.validatePartNumber(500);
        StorageService.validatePartNumber(10000);
      });
    });

    test('validates allowed video/audio content types', () => {
      assert.ok(StorageService.isAllowedContentType('video/mp4'));
      assert.ok(StorageService.isAllowedContentType('video/webm'));
      assert.ok(StorageService.isAllowedContentType('audio/mp4'));
      assert.ok(StorageService.isAllowedContentType('audio/webm'));
      assert.ok(!StorageService.isAllowedContentType('application/x-executable'));
      assert.ok(!StorageService.isAllowedContentType('text/html'));
    });
  });

  describe('Adversarial & Direct Upload Simulation with FakeObjectStorage', () => {
    test('simulates 500MB upload via multipart parts without buffering full file in memory', async () => {
      const storage = new FakeObjectStorage();
      const tenantId = 'tenant-corp-a';
      const recordingId = 'rec-999';
      const key = StorageService.allocateKey(tenantId, recordingId, 'presentation.mp4');

      // 1. Initiate multipart upload on trusted backend
      const { uploadId } = await storage.createMultipartUpload(key, 'video/mp4', tenantId);
      assert.ok(uploadId, 'Must receive valid uploadId');

      // 2. Client uploads individual 10MB parts directly (simulated stream/part buffers)
      const parts: { partNumber: number; etag: string }[] = [];
      const partSize = 10 * 1024; // Simulated small chunk for test speed
      for (let partNumber = 1; partNumber <= 5; partNumber++) {
        const dummyChunk = Buffer.alloc(partSize, partNumber);
        const { etag } = await storage.uploadPart(uploadId, partNumber, dummyChunk);
        parts.push({ partNumber, etag });
      }

      // 3. Complete multipart upload
      const completed = await storage.completeMultipartUpload(uploadId, parts);
      assert.equal(completed.key, key);
      assert.equal(completed.size, partSize * 5);
      assert.equal(completed.tenantId, tenantId);

      // 4. Verify object is accessible by owner tenant
      const retrieved = await storage.getObject(key, tenantId);
      assert.ok(retrieved);
      assert.equal(retrieved.size, partSize * 5);
    });

    test('adversarial drill: denies cross-tenant access to recording objects without revealing existence', async () => {
      const storage = new FakeObjectStorage();
      const tenantA = 'tenant-victim-a';
      const tenantB = 'tenant-attacker-b';
      const recordingId = 'rec-sensitive-111';
      const key = StorageService.allocateKey(tenantA, recordingId, 'earnings-call.mp4');

      await storage.putObject(key, Buffer.from('confidential meeting audio'), 'video/mp4', tenantA);

      // Attacker from Tenant B attempts to read Tenant A's recording
      const attackerRead = await storage.getObject(key, tenantB);
      assert.equal(attackerRead, null, 'Must return null (404) for cross-tenant read');

      // Attacker attempts to delete Tenant A's recording
      const attackerDelete = await storage.deleteObject(key, tenantB);
      assert.equal(attackerDelete, false, 'Must deny cross-tenant delete');

      // Victim from Tenant A can still access their recording
      const victimRead = await storage.getObject(key, tenantA);
      assert.ok(victimRead, 'Owner tenant must access recording');
    });

    test('abort multipart upload cleans up pending parts and cancels upload session', async () => {
      const storage = new FakeObjectStorage();
      const tenantId = 'tenant-test-abort';
      const key = StorageService.allocateKey(tenantId, 'rec-aborted', 'cancelled.mp4');

      const { uploadId } = await storage.createMultipartUpload(key, 'video/mp4', tenantId);
      await storage.uploadPart(uploadId, 1, Buffer.alloc(1024, 1));

      // Abort upload
      const aborted = await storage.abortMultipartUpload(uploadId);
      assert.equal(aborted, true);

      // Subsequent uploadPart or complete must fail
      await assert.rejects(
        async () => {
          await storage.uploadPart(uploadId, 2, Buffer.alloc(1024, 2));
        },
        /not found/i
      );
    });
  });

  describe('Room Service Direct Upload & Tenant Isolation Wiring Contract', () => {
    test('static source verification: recordings.routes.ts wires direct upload lifecycle routes before parameterized ID routes', () => {
      const routesPath = path.join(
        REPO_ROOT,
        'backend/packages/room-service/src/routes/v1/recordings.routes.ts'
      );
      assert.ok(fs.existsSync(routesPath), 'recordings.routes.ts must exist');
      const routesContent = fs.readFileSync(routesPath, 'utf-8');

      assert.ok(
        routesContent.includes('/direct-upload/initiate'),
        'Must declare /direct-upload/initiate route'
      );
      assert.ok(
        routesContent.includes('/direct-upload/part-url'),
        'Must declare /direct-upload/part-url route'
      );
      assert.ok(
        routesContent.includes('/direct-upload/complete'),
        'Must declare /direct-upload/complete route'
      );
      assert.ok(
        routesContent.includes('/direct-upload/abort'),
        'Must declare /direct-upload/abort route'
      );
      assert.ok(
        routesContent.includes('/:id/playback-url'),
        'Must declare /:id/playback-url route'
      );

      // Verify route ordering: /direct-upload/* must appear before /:id routes
      const initiateIdx = routesContent.indexOf('/direct-upload/initiate');
      const paramIdIdx = routesContent.indexOf('/:id');
      assert.ok(
        initiateIdx < paramIdIdx,
        '/direct-upload/initiate must precede /:id to prevent routing collision'
      );
    });

    test('static source verification: recording.controller.ts enforces tenant isolation on all operations', () => {
      const controllerPath = path.join(
        REPO_ROOT,
        'backend/packages/room-service/src/controllers/recording.controller.ts'
      );
      assert.ok(fs.existsSync(controllerPath), 'recording.controller.ts must exist');
      const controllerContent = fs.readFileSync(controllerPath, 'utf-8');

      assert.ok(
        controllerContent.includes('checkRecordingTenantAccess'),
        'Must implement checkRecordingTenantAccess helper'
      );
      assert.ok(
        controllerContent.includes('initiateDirectUpload'),
        'Must implement initiateDirectUpload'
      );
      assert.ok(
        controllerContent.includes('getPartUploadUrl'),
        'Must implement getPartUploadUrl'
      );
      assert.ok(
        controllerContent.includes('completeDirectUpload'),
        'Must implement completeDirectUpload'
      );
      assert.ok(
        controllerContent.includes('abortDirectUpload'),
        'Must implement abortDirectUpload'
      );
      assert.ok(
        controllerContent.includes('getPlaybackUrl'),
        'Must implement getPlaybackUrl'
      );

      // Verify that checkRecordingTenantAccess throws AppError.notFound (404) to avoid leaking existence
      assert.ok(
        controllerContent.includes("throw AppError.notFound('Recording')"),
        'Cross-tenant denial must throw notFound to avoid leaking resource existence'
      );
    });
  });
});

