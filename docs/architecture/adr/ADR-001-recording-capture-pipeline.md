# ADR-001: Recording Capture Architecture & Delivery Pipeline

- **Status**: **Accepted**
- **Date**: 2026-10-24
- **Deciders**: MeetLite Core Engineering Team
- **Target Milestones**: Phase 2.5 (`S2.5`), Phase 4 (`R4`)
- **Verification Evidence**: `docs/architecture/execution/evidence-s2-05.md`

---

## 1. Context and Problem Statement

MeetLite's legacy video conferencing relied on `mediasoup-service` running on dedicated origin servers with local disk storage, or a toy client prototype buffering blobs in browser RAM and serializing hundreds of megabytes of raw JSON arrays over WebSocket (`recording:finalize`).

As part of the phased scaling roadmap to 200,000 CCU, MeetLite decoupled media transport to **Cloudflare Realtime SFU** and room state to **Cloudflare Durable Objects**. Cloudflare R2 serves as the immutable object store for recordings. 

However, **R2 is a storage target, not a media capture engine**. Cloudflare Realtime SFU acts as a selective forwarding unit; it forwards WebRTC media packets between participants but does not natively compose multi-party video grids into an MP4 file. 

Before deprecating legacy Mediasoup recording, MeetLite must choose and prove a scalable recording capture architecture that satisfies non-negotiable product guarantees and strict unit economics.

---

## 2. Product Guarantees & Constraints

1. **Host Departure Resilience**: In all scheduled, organizational, and paid meetings, recording must continue uninterrupted if the meeting host closes their laptop, loses Wi-Fi, or leaves the call.
2. **Audio/Video Synchronization**: Output MP4/WebM recordings must maintain lip-sync alignment and smoothly incorporate screen-share presentations without drift.
3. **Zero Origin Memory Exhaustion**: Video streams must pipe directly to Cloudflare R2 via presigned multipart uploads in 5MB–10MB chunks (`StorageService`), completely bypassing API Gateway and origin RAM.
4. **Tenant Isolation & Security**: Recording files in R2 must be partitioned strictly by tenant ID (`tenants/{tenantId}/recordings/{recordingId}/composite.mp4`). Playback URLs must be short-lived, presigned, and scoped to verified principals.
5. **Economic Guardrail**: Total marginal cost per recorded hour must not exceed **$0.15 / hour**.

---

## 3. Evaluation of Candidate Models

### Model 1: Designated-Browser Composite (Client MediaRecorder)
- **Mechanism**: The meeting host's browser composites participant video elements onto an HTML5 `<canvas>`, captures the mixed stream with `MediaRecorder`, and streams chunks directly to R2 via S1-02 presigned multipart URLs.
- **Advantages**: Zero server compute cost ($0.00 / hr).
- **Fatal Disqualifiers**:
  - **Host Disconnect Termination**: If the host closes their laptop lid, runs out of battery, or crashes, the recording abruptly terminates or corrupts. Attempting to hand off recording to another participant introduces race conditions, missing segments, and timestamp discontinuity.
  - **Client Resource Strain**: Decoding multiple 720p streams while simultaneously re-encoding 1080p WebM causes high CPU spikes, dropped frames, and fan noise on client laptops.
- **Verdict**: **Rejected as the production default.** Retained only for optional local client capture in free, unauthenticated ad-hoc rooms with explicit UI disclaimer.

### Model 2: Server-Side Recorder Participant (Headless WebRTC Container Compositor)
- **Mechanism**: When recording is started, the background worker pool (`auth-service/worker` or dedicated recording worker) spawns a lightweight headless WebRTC container process. The recorder joins the room as an authorized, silent participant (`role: "recorder"`). It subscribes to all published audio, video, and screen tracks via `CloudflareMediaEndpoint`, renders the active layout, encodes to MP4 (H.264/AAC), and streams 5MB chunks to R2 via multipart upload.
- **Advantages**:
  - **100% Host Departure Resilience**: The recorder process remains active until the room closes or an authorized moderator stops recording.
  - **Deterministic A/V Quality**: Server-controlled compositing guarantees clean 1080p/720p layout switching, participant badges, and active screen sharing.
  - **Zero Client Overhead**: Participants experience no battery drain or CPU load.
- **Verdict**: **Accepted as the primary production engine.**

### Model 3: Per-Track Raw Capture & Asynchronous Composition
- **Mechanism**: SFU dumps individual RTP audio/video streams to object storage, followed by an asynchronous batch FFmpeg job to composite them into a final video file.
- **Fatal Disqualifiers**:
  - Cloudflare Realtime SFU does not support raw RTP bucket dumping without active WebRTC participant sessions.
  - High post-processing latency: recordings are not playable immediately after meeting completion.
  - 3x intermediate storage footprint and high batch compute cost.
- **Verdict**: **Rejected.**

---

## 4. Economic & Mathematical Cost Model (Per Recorded Hour)

The production server-side recorder participant (Model 2) satisfies the economic guardrail:

| Cost Component | Unit Rate | Usage per 1-Hour Meeting | Cost per Hour |
| :--- | :--- | :--- | :--- |
| **Recorder Container Compute** | Spot container ($0.035 / vCPU-hr) | 1 vCPU for 60 min | **$0.035** |
| **Cloudflare Realtime SFU Egress** | $0.045 / GB egress | ~1 Mbps composite downstream (~0.45 GB) | **$0.020** |
| **Cloudflare R2 Storage** | $0.015 / GB-month | ~1.2 GB per recorded hour (1st month) | **$0.018** |
| **Transcription (AI Whisper)** | $0.001 / minute | 60 minutes audio | **$0.060** |
| **Total Estimated Cost** | — | — | **$0.133 / hr** |

**Margin Analysis**: At MeetLite's Pro ($10/mo) and Enterprise ($25/mo) pricing with an average of 15 recorded hours per organization monthly ($1.99 in recording cost), the gross margin on recording remains **> 80%**.

---

## 5. Architectural Decision

1. **Deploy Model 2 (Server-Side Recorder Participant)** as MeetLite's authoritative recording engine for all organization and enterprise rooms.
2. The headless recorder process authenticates via an Ed25519 Room Capability token issued with the specialized `recorder` role and `media:subscribe` permission (disallowing publishing).
3. The recorder streams multipart parts directly to Cloudflare R2 using `StorageService.uploadPart` and commits the record in PostgreSQL via `initiateDirectUpload` and `completeDirectUpload`.
4. If an aborted recording occurs, `abortMultipartUpload` cleans up partial parts within 10 seconds to eliminate orphaned storage costs.
5. Mediasoup recording remains active on port 3003 as a zero-regression fallback until Phase 6.

---

## 6. Consequences

- **Positive**:
  - Recordings survive host departure, laptop sleep, and participant disconnections.
  - Origin memory remains flat regardless of recording duration or file size.
  - High-fidelity lip-sync and dynamic screen-share layout rendering.
- **Negative / Operational Requirements**:
  - Requires maintaining a containerized recorder worker pool in Docker Compose and Kubernetes/Fly.io.
  - Spawning recorder introduces a brief startup latency (~3–5 seconds) before recording begins, which is surfaced cleanly to users via the `starting` UI status badge.
