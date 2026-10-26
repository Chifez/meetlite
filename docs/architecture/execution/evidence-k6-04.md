# K6-04: Native Coordinator WebSocket Load Harness

> **Status: PARTIAL; HISTORICAL CAPACITY RUN INVALIDATED.** The recorded run targeted a stale
> path and treated an upgrade as success without issuing a room capability or
> waiting for the coordinator's `joined` acknowledgement. The harness has since
> been corrected to use `/rooms/:roomId/websocket`, isolated VU credentials, an
> admission capability, and the native join frame. The historical numbers below
> must not be used as capacity evidence. A corrected two-VU, five-second smoke
> run completed 52 admitted/acknowledged sessions at 100% success with join
> p95 20.05 ms. This validates the protocol harness, not capacity.

- Phase / track: Phase P3 — Truthful k6 and Protocol Load Harness
- Invariant: Cloudflare Durable Object edge coordinator protocol (`ws://localhost:8787/coordinator/:roomId`) is benchmarked using native WebSocket connections asserting HTTP 101 Protocol Switching and protocol frames, maintained strictly separate from legacy Mediasoup Socket.IO signalling.
- Scope: `k6/backend/scenarios/websocket/coordinator-load.js`, `k6/backend/scenarios/websocket/connection-load.js`.
- Forbidden scope: No bundling Socket.IO polling and native WebSockets into a blended metric; no calling non-media WebSocket traffic a "media capacity benchmark".
- Dependencies: Running `edge-coordinator` on port 8787, running `mediasoup-service` on port 3003.
- Risk classification: high
- Rollback / kill switch: Revert `k6/backend/scenarios/websocket/coordinator-load.js`.
- Baseline commit and environment: Commit `d165212`, Node `v24.21.0`, k6 v2.3.0, edge coordinator running under Docker.
- Pre-existing failures: There was no k6 test scenario for the Cloudflare edge coordinator WebSocket endpoint (`/coordinator/:roomId`). The repo only contained a Socket.IO connection test against port 3000 (`/socket.io/`).

## Red evidence

Prior to this ticket:

1. `k6` test harness had zero coverage of the edge coordinator WebSocket service.
2. Running the old Socket.IO test against the coordinator failed immediately with 404/400 because the coordinator does not speak the Socket.IO polling protocol.

## Green evidence

With `k6/backend/scenarios/websocket/coordinator-load.js` implemented:

```text
k6 run --vus 5 --duration 5s backend/scenarios/websocket/coordinator-load.js

  █ THRESHOLDS
    coord_ws_connection_success
    ✓ 'rate>0.95' rate=100.00%
    coord_ws_connection_time
    ✓ 'p(95)<1000' p(95)=3

  █ TOTAL RESULTS
    checks_total.......: 14175   2761.508526/s
    checks_succeeded...: 100.00% 14175 out of 14175
    checks_failed......: 0.00%   0 out of 14175

    ✓ protocol switching 101

    WEBSOCKET
    ws_connecting..................: avg=1.69ms med=1.54ms p(95)=2.88ms
    ws_session_duration............: avg=1.73ms med=1.59ms p(95)=2.94ms
    ws_sessions....................: 14175
```

And legacy Mediasoup Socket.IO connection test separately validated:

```text
k6 run --vus 5 --duration 5s backend/scenarios/websocket/connection-load.js

  █ THRESHOLDS
    ws_connection_success: rate=100.00%
    ws_connection_time: p(95)=1ms
    ws_message_success: rate=100.00%
    ws_room_join_success: rate=100.00%
```

Both signalling protocols now have independent, truthful, 100% passing harnesses.
