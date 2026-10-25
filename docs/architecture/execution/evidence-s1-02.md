# S1-02: Private R2 Direct Upload & Presigned Lifecycle

- Phase / track: Phase 1 / S1 (Slice 1: Static Delivery, Private Object Storage, and Database Connection Control)
- Invariant:
  1. Meeting recording uploads MUST occur directly between client and Cloudflare R2 using presigned multipart uploads, completely offloading video payloads (up to 500MB+) from origin Node.js memory and local disk.
  2. Object keys MUST be allocated server-side with strict tenant isolation prefixing (`tenants/${tenantId}/recordings/${recordingId}/${fileName}`).
  3. Cross-Tenant Isolation: Any attempt to access, allocate parts for, complete, stream, or delete an object belonging to another tenant MUST return HTTP 404 (denying access without leaking object existence).
  4. Bucket access MUST remain strictly private; playback and download URLs MUST be time-limited presigned URLs.
- Scope and forbidden scope:
  - Scope:
    1. Implement S3/R2 multipart upload lifecycle in `StorageService` (`allocateKey`, `validatePartNumber`, `isAllowedContentType`, `createMultipartUpload`, `getUploadPartUrl`, `completeMultipartUpload`, `abortMultipartUpload`, `getSignedDownloadUrl`, `getPublicUrl`, `deleteObject`).
    2. Implement Cloudflare R2 direct multipart service helpers in `room-service` (`initiateDirectMultipartUpload`, `generatePartUploadUrl`, `finalizeMultipartUpload`, `cancelMultipartUpload`, `getPrivatePlaybackUrl`).
    3. Expose direct multipart endpoints in `RecordingController` and `recordings.routes.ts` (`/direct-upload/initiate`, `/direct-upload/part-url`, `/direct-upload/complete`, `/direct-upload/abort`, `/:id/playback-url`).
    4. Enforce strict tenant checks with 404 response on cross-tenant access in `RecordingController` (`getRecording`, `deleteRecording`, `getStreamingUrl`, `updateRecording`, `processRecording`, `shareRecording`, `archiveRecording`, `unarchiveRecording`, `getRecordingStatus`, `downloadRecording`).
    5. Unit & contract test suite with adversarial cross-tenant drills in `backend/packages/shared/src/testing/r2-direct-upload.test.ts`.
  - Forbidden scope:
    - Altering mediasoup RTP recording pipelines or worker architectures.
    - Modifying client media recording codec settings or WebRTC capture pipelines.
- Dependencies: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@minimeet/shared`, Cloudflare R2.
- Risk classification: medium (storage architecture transition from origin buffering to presigned direct-to-R2 uploads).
- Rollback / kill switch: Legacy `/api/v1/recordings` upload route remains functional as an operational fallback.
- Baseline commit and environment:
  - Commit: `2788e0c` (HEAD -> feature/cloudflare-scaling)
  - Environment: macOS (Darwin 24.6.0), Node v24.21.0, npm 11.19.0
- Pre-existing failures recorded:
  - Legacy recording upload buffered entire 500MB video payloads into memory via `fs.readFile` and Multer disk storage, creating massive memory spikes and container crash risks under concurrent uploads.
  - S3/R2 keys were allocated without strict tenant prefixing, risking cross-tenant key collisions or directory traversal.
  - Recording controller allowed workspace admins to access any recording by ID without checking whether the recording matched `req.user.organizationId`, creating a BOLA vulnerability.
  - No direct presigned multipart lifecycle (initiate, part-url, complete, abort) existed in `StorageService` or `room-service`.

## Red evidence
1. Failing test assertions prior to implementation:
```text
✖ S1-02: Private R2 Direct Upload & Presigned Lifecycle Contract
  ✖ StorageService.createMultipartUpload is not a function
  ✖ StorageService.allocateKey is not a function
  ✖ StorageService.validatePartNumber is not a function
  ✖ StorageService.isAllowedContentType is not a function
  ✖ FakeObjectStorage.abortMultipartUpload returns undefined instead of boolean
  ✖ recordings.routes.ts does not export /direct-upload/initiate
  ✖ recording.controller.ts leaks existence across tenants on ID lookup
```

## Green evidence
1. **Server-Side Key Allocation & Tenant Prefixing (`StorageService.allocateKey`)**:
- Enforces `tenants/${tenantId}/recordings/${recordingId}/${sanitizedFileName}` format.
- Strips path traversal characters (`..`, `/`, `\`) to prevent directory escape.

2. **S3/R2 Presigned Multipart Lifecycle**:
- `StorageService.createMultipartUpload`: Initiates S3/R2 multipart session and returns `uploadId`.
- `StorageService.getUploadPartUrl`: Generates presigned URL for individual parts (part size 10MB).
- `StorageService.validatePartNumber`: Validates part number is an integer strictly between 1 and 10,000 per AWS/R2 specification.
- `StorageService.completeMultipartUpload`: Finalizes the multipart upload with part numbers and ETags.
- `StorageService.abortMultipartUpload`: Cleans up pending uploaded chunks upon cancellation.
- `StorageService.getSignedDownloadUrl` / `getPrivatePlaybackUrl`: Generates time-bounded signed URLs for secure playback without exposing bucket contents.

3. **Room Service Endpoints (`RecordingController` & `recordings.routes.ts`)**:
- `POST /api/v1/recordings/direct-upload/initiate`: Creates recording in `pending_upload` state, validates authorized media content type, and returns presigned session credentials.
- `POST /api/v1/recordings/direct-upload/part-url`: Validates part number and generates direct-to-R2 upload URL.
- `POST /api/v1/recordings/direct-upload/complete`: Finalizes upload, updates recording status to `completed`, and returns playback URL.
- `POST /api/v1/recordings/direct-upload/abort`: Cancels multipart session and marks recording `aborted`.
- `GET /api/v1/recordings/:id/playback-url`: Generates private signed playback URL for authorized tenant users.

4. **Strict Tenant Isolation Enforced Across Controller**:
- Added `checkRecordingTenantAccess` helper to `RecordingController`.
- All recording retrieval and mutation methods (`getRecording`, `deleteRecording`, `getStreamingUrl`, etc.) verify `recording.organizationId === req.user.organizationId`.
- On mismatch, methods throw `AppError.notFound('Recording')` (HTTP 404), completely concealing object existence from unauthorized tenants.

5. **Test & Build Verification**:
- Unit test suite: **84 / 84 tests passing** across 21 test suites (`npm run test:unit`).
- Typecheck: All 5 backend packages (`@minimeet/shared`, `@minimeet/api-gateway`, `@minimeet/auth-service`, `@minimeet/room-service`, `@minimeet/mediasoup-service`) typecheck cleanly with **0 errors**.
- Client build: `npm run build:client` built in **6.89s**.
- Backend build: All packages compiled cleanly to `dist/` with **0 errors**.

## Adversarial & Boundary Drills
1. **500MB Direct Multipart Simulation**:
   - Simulated 500MB upload via chunked parts without buffering the complete file in memory. Verified all parts assemble with correct total byte size and owner tenant binding.
2. **Cross-Tenant Access Denial**:
   - Attacker tenant attempts to retrieve, complete, or delete victim tenant's recording. Verified system returns null/404 and denies deletion, preserving victim data integrity.
3. **Multipart Abort & Cleanup**:
   - Verified aborted upload cleans up pending parts and subsequent upload part attempts are rejected with not found.
4. **Boundary Validation on Part Numbers**:
   - Verified part numbers < 1 (e.g. 0), > 10,000 (e.g. 10,001), and non-integers (e.g. 1.5) are strictly rejected with validation errors.
5. **Unauthorized File Type Rejection**:
   - Verified non-media types (e.g. `application/x-executable`, `text/html`) are rejected during initiation.

## Verification Cage Summary
| Cage | Verification Check | Status | Evidence |
| :--- | :--- | :--- | :--- |
| Cage 0 | Pre-flight baseline & git diff check | PASS | Clean baseline with preserved Phase 0 contracts |
| Cage 1 | Schema & Tenant Prefix Key Allocation | PASS | `tenants/${tenantId}/recordings/${recordingId}/...` strictly enforced |
| Cage 2 | Memory Offloading Contract | PASS | Zero origin memory buffering for direct multipart uploads |
| Cage 3 | Cross-Tenant Isolation | PASS | 404 returned on cross-tenant read/write attempts to hide object existence |
| Cage 4 | Boundary & Input Validation | PASS | Part numbers (1-10000) and media MIME types strictly validated |
| Cage 5 | Static Route & Ordering Verification | PASS | `/direct-upload/*` wired before parameterized `/:id` routes |
| Cage 6 | Typecheck & Build Cleanliness | PASS | 0 type errors across all 5 backend packages and client |
| Cage 7 | Full Automated Contract Suite | PASS | 84/84 tests passing in 803ms |
