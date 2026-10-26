# MeetLite Capacity & Performance Contract

**Status:** Approved Baseline Contract (`GOV-01`)  
**Target Milestone:** Phase P0 through Phase P4 (`P0-GOV-01`)  
**Governing Documents:** [MeetLite Agent Execution Plan](../architecture/meetlite-agent-execution-plan.md), [Product & Performance Roadmap](../architecture/meetlite-product-and-performance-roadmap.md), [Agent Change Verifier](../architecture/agent-change-verifier.md)

---

## 1. Workload Personas

Performance evaluation and capacity benchmarks must model real participant behavior rather than synthetic ping loops. The following five personas define all workload generation:

| Persona | Role & Capabilities | Control-Plane Load | Media Publication Profile | Ingress / Signalling |
| :--- | :--- | :--- | :--- | :--- |
| **Organizer (Host)** | Meeting owner; creates room, manages lifecycle, admits guests, starts/stops recording | 1 room creation, 1 recording toggle, participant state mutations | 1x Audio (Opus 48kbps), 1x Video (720p30 1.5Mbps), periodic screenshare (1080p15 2Mbps) | REST API + WebSocket (Durable Object or Mediasoup) |
| **Active Speaker** | Participant with mic unmuted and camera on | Token verification, periodic chat/collaboration deltas | 1x Audio (Opus 48kbps), 1x Video (720p30 1.5Mbps or 360p30 500kbps) | WebSocket audio level & media negotiation |
| **Listener (Auditor)** | Camera off, mic muted, actively receives all room media | Heartbeat, chat read, awareness presence | None (0 publishers); consumes active speaker video + mixed audio | WebSocket state subscriptions only |
| **Presenter** | Shares desktop/application window alongside camera | High-throughput Yjs/collaboration synchronization | 1x Audio, 1x Video (360p30), 1x High-Res Screen Track (1080p15 2Mbps) | WebSocket collaboration + WebRTC screen track |
| **Server Recorder** | Headless container joining as silent subscriber (`role: "recorder"`) | Session validation, R2 multipart chunk completion (5MB–10MB) | Subscribes to all active tracks; 0 publications; egress to Cloudflare R2 | Direct SFU consumer session |

---

## 2. Room Size Distributions

Capacity testing must reproduce the production distribution of room shapes rather than monolithic room sizes:

```text
Room Tier Breakdown:
- 1:1 Direct Consultation:     40% of active rooms (2 participants)
- Small Team Sync:             40% of active rooms (3 to 6 participants)
- Department Standup:          15% of active rooms (7 to 15 participants)
- All-Hands / Broadcast:        5% of active rooms (16 to 50 participants, max 5 publishers)
```

| Profile Name | Participant Count | Publisher Count | Subscriber Count | Dominant SFU Load |
| :--- | :--- | :--- | :--- | :--- |
| **1:1 Call** | 2 | 2 | 2 | Low cross-routing (2 in, 2 out) |
| **Team Sync** | 4–6 | 4 | 16–24 | Mesh forwarding; simulcast layer switching |
| **Standup** | 10–15 | 3–5 active | 30–75 | Dynamic audio-level prioritization |
| **All-Hands** | 50 | 2–4 | 200–250 | High fan-out downstream egress |

---

## 3. Media Bitrate & Codec Profiles

To prevent divergent test criteria, media profiles are pinned to explicit WebRTC encoding standards:

```text
Video Profiles (VP8 / H.264):
- High (720p30):      1,500 kbps (spatial layer 2)
- Medium (360p30):      500 kbps (spatial layer 1)
- Low (180p15):         150 kbps (spatial layer 0)
- Screen (1080p15):   2,000 kbps (presentation mode)

Audio Profile (Opus):
- Full-band Voice:       48 kbps (mono, DTX enabled)
```

---

## 4. Benchmark Regions & Target Topology

All performance measurements must declare the tested infrastructure topology:

1. **Local Deterministic (Baseline)**: Single-host Docker / OrbStack (Node 22, Postgres 16, Redis 7.2, Mediasoup SFU RTC `10000-10100`).
2. **Cloudflare Edge Canary (Staging)**: Cloudflare Tunnel ingress, Edge Room Coordinator (Durable Objects), Cloudflare Calls (Global Anycast SFU), Cloudflare R2 (Private storage bucket).
3. **Target Multi-Region (Production Target)**: WNAM (North America West), ENAM (North America East), WEUR (Western Europe).

---

## 5. Service Level Objectives (SLOs)

Benchmarks fail if any of the following boundaries are exceeded during a sustained measurement run:

| Metric | Target SLO | Abort / Failure Boundary | Measurement Method |
| :--- | :--- | :--- | :--- |
| **Control-Plane API Error Rate** | < 0.05% | ≥ 0.5% | Gateway access logs / Prometheus |
| **Control-Plane API Latency (p95)** | < 150 ms | ≥ 300 ms | k6 HTTP request duration |
| **Control-Plane API Latency (p99)** | < 300 ms | ≥ 600 ms | k6 HTTP request duration |
| **Room Join Handshake (p95)** | < 300 ms | ≥ 800 ms | Browser timing: `joinRoom` call to `room-data` ack |
| **Time to First Remote Media (TTFM)** | < 800 ms | ≥ 1,500 ms | MediaStream `onaddtrack` timestamp minus join time |
| **Signalling Reconnect Time (p95)** | < 1,000 ms | ≥ 2,500 ms | Socket disconnect to resubscribe completion |
| **Seat Duplication Rate** | 0.0% (Zero) | > 0 duplicate seats | Database & room participant map verification |
| **Recording Packet Loss / Gap** | 0.0% | Any lost chunk | R2 multipart part audit & playback validation |

---

## 6. Economic Guardrails & Cost Ceilings

Capacity claims are invalid if unit economics violate the product budget:

- **Recorded Hour Cost**: Total marginal compute and storage cost must not exceed **$0.15 per recorded hour**.
- **Edge Coordinator Memory**: Durable Object instance heap must not exceed **128 MB** under 50 concurrent participants.
- **Abort Limits**: Any test run where error rates spike above **2.0%** for more than 10 consecutive seconds, or memory increases monotonically without plateauing, must immediately abort to prevent runaway cloud provider charges.

---

## 7. Test-Data & Privacy Isolation

1. **Synthetic Identities Only**: Real personal accounts, production customer emails, or real OAuth tokens are strictly forbidden in performance suites.
2. **Deterministic Cleanup**: All rooms, recordings, and database rows created during a benchmark run must be deleted in the post-test teardown phase.
3. **Tenant Prefixing**: All test objects in R2 must use the dedicated prefix `perf-test/tenants/{tenantId}/`.

---

## 8. Result Schema & Reporting Specification

Every capacity run must emit a versioned JSON summary file adhering to this schema:

```json
{
  "$schema": "https://meetlite.dev/schemas/capacity-report-v1.json",
  "reportVersion": "1.0.0",
  "timestamp": "2026-10-25T16:00:00Z",
  "commitSha": "immutable-git-commit-sha",
  "environment": {
    "name": "staging-canary",
    "mediaEngine": "mediasoup | cloudflare",
    "gatewayUrl": "https://api-staging.meetlite.dev",
    "hardware": "8 vCPU, 16 GB RAM"
  },
  "workload": {
    "profile": "mixed-team-sync",
    "durationSeconds": 600,
    "targetCCU": 2500,
    "roomCount": 500,
    "userCount": 2500
  },
  "results": {
    "verdict": "PASS | FAIL | INCONCLUSIVE",
    "httpRequestsTotal": 142050,
    "httpErrorRate": 0.0002,
    "httpLatencyP95Ms": 112.4,
    "httpLatencyP99Ms": 240.1,
    "signallingConnectionsTotal": 2500,
    "signallingErrorRate": 0.0000,
    "joinLatencyP95Ms": 245.0,
    "timeToFirstMediaMs": 680.0,
    "reconnectSuccessRate": 1.0,
    "duplicateSeatsDetected": 0
  },
  "limitingComponent": "postgres-connection-pool",
  "rawArtifacts": [
    "k6-summary.json",
    "gateway-telemetry.log"
  ]
}
```
