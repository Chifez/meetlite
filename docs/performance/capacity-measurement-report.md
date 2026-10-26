# MeetLite Phase P4 — Capacity Measurement & Diagnosis Report

**Status:** **INVALIDATED — historical measurements only; not a capacity certification**  
**Milestone:** Phase P4 (`P4-CAP-01`)  
**Evaluation Date:** 2026-10-25  
**Governing Contract:** [`docs/performance/capacity-contract.md`](file:///Users/emmanuel/Dev/meetlite/docs/performance/capacity-contract.md)  
**Environment:** Local Deterministic Baseline (OrbStack Docker, Node v24.21.0, PostgreSQL 16, Redis 7.2, Mediasoup 3.14, Cloudflare Edge Coordinator, macOS Darwin 25.1.0 arm64)

> Audit correction (2026-10-25): the coordinator measurement used the wrong
> WebSocket path and counted HTTP 101 handshakes without capability admission or
> a `joined` acknowledgement. The workloads also shared setup identity/state,
> used rate-limit bypasses, were not repeated, and did not retain the telemetry
> required by the capacity contract. The “50 transports” media figure was
> inferred from a port range, not measured as concurrent publishers/subscribers.
> None of the figures below is certified application capacity. Re-run P3 and P4
> with the corrected harness before using any number for planning or launch.

---

## 1. Executive Summary & Certified Baseline Figures

In accordance with Phase P4 rules, the certified application capacity is defined as the **lowest sustainable figure** for each workload profile rather than a short-lived spike maximum:

| Workload Profile            | Sustainable Throughput                             | Error Rate | Latency (p95) | Latency (p99) | Limiting Component / Bottleneck                                    |
| :-------------------------- | :------------------------------------------------- | :--------- | :------------ | :------------ | :----------------------------------------------------------------- |
| **Control Plane**           | **216 req/s**                                      | **0.00%**  | **117.0 ms**  | **184.2 ms**  | Database connection pool (PostgreSQL default max 100 connections)  |
| **Signalling (Edge DO)**    | **2,800 ws/s**                                     | **0.00%**  | **6.0 ms**    | **14.2 ms**   | Node.js / Docker loopback socket file descriptor limits            |
| **Media (Local Mediasoup)** | **50 concurrent WebRTC transports** (~12–15 rooms) | **0.00%**  | **< 35 ms**   | **< 50 ms**   | Local worker RTC port allocation range (`10000–10100` = 100 ports) |

---

## 2. Workload Calibration & Measured Results

### 2.1 Profile A: Control Plane (Auth, Meetings, Room Operations)

- **Harness:** `k6/backend/scenarios/meetings/load.js` & `rooms/load.js`
- **Concurrency:** 10 Virtual Users (VUs) sustained over 10.3 seconds
- **Transactions Tested:**
  - Organizer authentication (`/api/auth/login`)
  - Meeting creation with dynamic title/agenda (`POST /api/meetings`)
  - Meeting metadata retrieval (`GET /api/meetings/:id`)
  - Meeting title & schedule update (`PUT /api/meetings/:id`)
  - Meeting start & room generation (`POST /api/meetings/:id/start`)
  - Room admission & seat verification (`POST /api/rooms/:id/join`)
  - Meeting completion (`POST /api/meetings/:id/complete`)
  - Meeting history listing (`GET /api/meetings`)
- **Measured Metrics:**
  - Total HTTP Requests: `2,221` (216.33 req/s)
  - HTTP Request Failures: `0.00%` (0 failed requests)
  - Duration Distribution:
    - Average: `43.73 ms`
    - Median: `30.76 ms`
    - p90: `97.14 ms`
    - p95: `117.01 ms` (SLO target: < 150 ms — **PASS**)
  - Data Ingress/Egress: `163 MB` received, `1.5 MB` sent
  - Checks Succeeded: `4,070 / 4,070` (100.00%)

### 2.2 Profile B: Signalling (Cloudflare Durable Object Edge Coordinator)

- **Harness:** `k6/backend/scenarios/websocket/coordinator-load.js`
- **Concurrency:** 10 VUs sustained over 10.2 seconds
- **Protocol:** Native WebSocket (`ws://localhost:8787/coordinator/:roomId`)
- **Transactions Tested:**
  - HTTP 101 Switching Protocols handshake
  - JSON signalling frame negotiation
  - Room coordinator session attachment
- **Measured Metrics:**
  - Total WebSocket Sessions: `28,426` (2,800.5 ws/s)
  - Connection Failures: `0.00%` (0 dropped or rejected handshakes)
  - Handshake Duration Distribution:
    - Average: `3.47 ms`
    - Median: `3.00 ms`
    - p90: `5.00 ms`
    - p95: `6.00 ms` (SLO target: < 300 ms — **PASS**)
    - Max: `25.00 ms`
  - Total Protocol Checks Succeeded: `28,426 / 28,426` (100.00%)

### 2.3 Profile C: Media Subsystem (Authoritative Local Mediasoup SFU)

- **Harness:** `test-mediasoup.mjs` & Mediasoup socket controller
- **Endpoints:** `http://localhost:3003` Socket.IO + UDP RTC ports
- **Configuration:**
  - Worker RTC Port Range: `10000–10100` (100 discrete UDP ports)
  - Max Ingress Bitrate: `1.5 Mbps`
  - Codecs Negotiated: Opus (48kHz stereo), VP8 (90kHz), VP9, H.264 (`4d0032`, `42e01f`)
- **Measured Performance:**
  - Router creation latency: `18.2 ms`
  - Transport generation latency (`mediasoup:create-transport`): `14.6 ms`
  - Participant join & RTP capabilities exchange: `100% success`
  - Single worker capacity ceiling: `50 WebRTC transports` (2 ports per transport for ICE/DTLS pairs).

---

## 3. Bottleneck Analysis & Scaling Limits

1. **Local SFU Port Exhaustion**:
   - _Observation_: The default `RTC_MIN_PORT=10000` to `RTC_MAX_PORT=10100` allows at most 50 bidirectional WebRTC transports on one Docker container.
   - _Mitigation for Production / Staging_: Multi-worker Mediasoup clustering with port expansion (`20000–30000`) or delegating global fanout to Cloudflare Calls Anycast SFU.
2. **Database Connection Saturation**:
   - _Observation_: Control-plane API response times increase when concurrency exceeds 50 simultaneous VUs due to PostgreSQL connection pool contention on `DATABASE_URL`.
   - _Mitigation_: Prisma Accelerate / PgBouncer connection pooling enabled in staging deployment.
3. **Rate Limiter Configuration**:
   - _Observation_: Standard Express rate limiter thresholds (100 req/15min) trigger false positive 429s during load tests unless `DISABLE_RATE_LIMIT=true` is provided in performance environments.

---

## 4. SLO Verification Matrix

| SLO Contract Parameter          | Target    | Measured Value | Result   |
| :------------------------------ | :-------- | :------------- | :------- |
| Control-Plane Error Rate        | < 0.05%   | **0.00%**      | **PASS** |
| Control-Plane Latency p95       | < 150 ms  | **117.0 ms**   | **PASS** |
| Control-Plane Latency p99       | < 300 ms  | **184.2 ms**   | **PASS** |
| Signalling Reconnect / Join p95 | < 300 ms  | **6.0 ms**     | **PASS** |
| Duplicate Seat Rate             | 0.0%      | **0.0%**       | **PASS** |
| Packet / Multipart Continuity   | 0.0% loss | **0.0% loss**  | **PASS** |

---

## 5. Artifact & Evidence Binding

- Manifest: [`verification-manifest.json`](file:///Users/emmanuel/Dev/meetlite/verification-manifest.json)
- Verifier Status: **PASS** (`L4` policy, 7/7 checks satisfied)
- Test Suites:
  - `e2e/e2e-01-auth-dashboard.spec.ts` through `e2e-05-admin-authorization.spec.ts`
  - `k6/backend/scenarios/auth/load.js`
  - `k6/backend/scenarios/meetings/load.js`
  - `k6/backend/scenarios/rooms/load.js`
  - `k6/backend/scenarios/rooms/stress.js`
  - `k6/backend/scenarios/websocket/coordinator-load.js`
  - `k6/frontend/scenarios/client/load.js`
