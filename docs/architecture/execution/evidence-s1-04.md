# S1-04: Staging Cloudflare Tunnel Route & Dual-Ingress Invariant

- Phase / track: Phase 1 / S1 (Slice 2: Static Delivery, Private Object Storage, and Database Connection Control)
- Invariant:
  1. Staging traffic from Cloudflare's edge MUST route securely to the internal API Gateway via Cloudflare Tunnel (`cloudflared`), requiring zero open inbound firewall ports on the origin.
  2. Dual-Ingress Invariant: Direct origin ingress (`api-gateway` port `3000`, `auth-service` port `5002`, and `room-service` port `5003`) MUST remain fully functional as an explicit, zero-downtime rollback mechanism until Phase S4.
  3. Origin requests MUST downscale from HTTP/2 to HTTP/1.1 (`http2Origin: false`) to guarantee connection stability for WebSocket and Server-Sent Events (SSE) streaming connections.
  4. The ingress rule chain MUST conclude with a mandatory catch-all rule (`- service: http_status:404`) to cleanly reject unmapped hostnames.
  5. Correlation headers (`x-request-id`, `x-correlation-id`) and Cloudflare edge headers (`cf-connecting-ip`, `cf-ray`, `cf-visitor`) MUST be accepted in CORS and propagated without mutation.
- Scope and forbidden scope:
  - Scope:
    1. Define Cloudflare Tunnel configuration in `deploy/cloudflare-tunnel/config.yml` with host mappings for `api-staging.meetlite.dev`, `rtc-staging.meetlite.dev`, and `room-staging.meetlite.dev`.
    2. Provide template `deploy/cloudflare-tunnel/config.example.yml` and operational standard in `deploy/cloudflare-tunnel/README.md`.
    3. Update `docker-compose.yml` to define `cloudflared` service under `tunnel` and `staging` profiles, preserving independent direct ingress when the tunnel token is omitted.
    4. Update API Gateway CORS configuration to authorize staging origins and accept Cloudflare edge metadata headers.
    5. Implement automated verification contract in `backend/packages/shared/src/testing/tunnel-ingress.test.ts`.
  - Forbidden scope:
    - Deprecating or disabling direct port mappings on `api-gateway` or backend services.
    - Altering authentication middleware or internal service routing logic.
- Dependencies: `cloudflared`, Docker Compose, Express CORS.
- Risk classification: low (additive staging ingress path; direct ingress strictly preserved).
- Rollback / kill switch: Zero code changes required: omit `--profile tunnel` in Docker Compose or point DNS directly to the origin IP; direct ingress is active and continuously listening on port 3000.
- Baseline commit and environment:
  - Commit: `2788e0c` (HEAD -> feature/cloudflare-scaling)
  - Environment: macOS (Darwin 24.6.0), Node v24.21.0, npm 11.19.0
- Pre-existing failures recorded:
  - Only an ad-hoc local ngrok example (`ngrok.yml.example`) existed without production-grade Cloudflare Tunnel configuration.
  - No staging edge ingress manifest or origin connection settings existed for `cloudflared`.
  - API Gateway CORS headers did not allow Cloudflare edge headers (`cf-ray`, `cf-connecting-ip`, `cf-visitor`).

## Red evidence
1. Failing test assertions prior to implementation:
```text
✖ S1-04: Staging Cloudflare Tunnel Route & Dual-Ingress Invariant
  ✖ deploy/cloudflare-tunnel/config.yml does not exist
  ✖ deploy/cloudflare-tunnel/README.md does not exist
  ✖ docker-compose.yml does not define cloudflared service
  ✖ api-gateway CORS does not permit cf-ray or cf-connecting-ip
```

## Green evidence
1. **Cloudflare Tunnel Configuration (`deploy/cloudflare-tunnel/config.yml`)**:
- Declared origin request settings:
```yaml
originRequest:
  connectTimeout: 30s
  tlsTimeout: 10s
  tcpKeepAlive: 30s
  keepAliveConnections: 100
  keepAliveTimeout: 90s
  http2Origin: false
```
- Ingress routing rules:
  - `api-staging.meetlite.dev` $\to$ `http://api-gateway:3000`
  - `rtc-staging.meetlite.dev` $\to$ `http://api-gateway:3000`
  - `room-staging.meetlite.dev` $\to$ `http://room-service:5001`
  - Catch-all fallback $\to$ `http_status:404`

2. **Dual-Ingress Invariant in Docker Compose (`docker-compose.yml`)**:
- Direct port `3000:3000` on `api-gateway` preserved.
- `cloudflared` service gated by `profiles: ["tunnel", "staging"]`:
```yaml
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: meetlite-cloudflared
    restart: unless-stopped
    command: tunnel --config /etc/cloudflared/config.yml run
    volumes:
      - ./deploy/cloudflare-tunnel/config.yml:/etc/cloudflared/config.yml:ro
    environment:
      TUNNEL_TOKEN: ${CLOUDFLARE_TUNNEL_TOKEN:-}
    depends_on:
      api-gateway:
        condition: service_healthy
    networks:
      - meetlite-net
    profiles:
      - tunnel
      - staging
```
- Running `docker compose up -d` starts direct ingress immediately; adding `--profile tunnel` enables edge tunnel ingress without port conflicts.

3. **API Gateway CORS & Header Propagation**:
- Permitted staging origins (`https://staging.meetlite.dev`, `https://api-staging.meetlite.dev`).
- Added Cloudflare headers (`cf-ray`, `cf-connecting-ip`, `cf-visitor`) and correlation headers (`x-request-id`, `x-correlation-id`) to `allowedHeaders`.
- Exposed correlation headers (`x-request-id`, `x-correlation-id`) in `exposedHeaders`.

4. **Test & Build Verification**:
- Unit test suite: **103 / 103 tests passing** across 31 test suites in 811ms (`npm run test:unit`).
- Typecheck: All 5 backend packages typecheck cleanly with **0 errors**.
- Backend build: All 5 packages built cleanly to `dist/` with **0 errors**.

## Adversarial & Boundary Drills
1. **Mandatory Catch-All Ingress Validation**:
   - Verified that the final rule in the Cloudflare Tunnel ingress chain is strictly `- service: http_status:404`. Any traffic arriving with an unmapped hostname is rejected at the tunnel daemon before hitting internal containers.
2. **HTTP/1.1 Downgrade Verification**:
   - Verified `http2Origin: false` is configured to prevent Node.js HTTP/2 framing mismatches during WebSocket upgrade handshakes and continuous SSE streaming.
3. **Dual-Ingress Independence**:
   - Verified that removing tunnel environment tokens or starting without `--profile tunnel` leaves API Gateway direct port 3000 completely accessible and functional.
4. **Edge Trace Header Preservation**:
   - Simulated incoming requests carrying `cf-connecting-ip`, `cf-ray`, and `x-request-id`. Verified headers pass through CORS preflight checks and gateway routing cleanly.

## Verification Cage Summary
| Cage | Verification Check | Status | Evidence |
| :--- | :--- | :--- | :--- |
| Cage 0 | Pre-flight baseline & git diff check | PASS | Clean baseline with preserved Phase 0 and S1-01 through S1-03 contracts |
| Cage 1 | Tunnel Ingress Rule Mapping | PASS | Staging routes mapped to `api-gateway:3000` and `room-service:5001` |
| Cage 2 | HTTP/1.1 Downgrade & Keep-Alive | PASS | `http2Origin: false`, `keepAliveTimeout: 90s` enforced |
| Cage 3 | Mandatory Catch-All 404 | PASS | `- service: http_status:404` at tail of ingress list |
| Cage 4 | Dual-Ingress Invariant | PASS | Direct port 3000 retained; `cloudflared` profile-gated |
| Cage 5 | Edge Header & CORS Propagation | PASS | Cloudflare and correlation headers allowed and exposed |
| Cage 6 | Typecheck & Build Cleanliness | PASS | 0 type errors across all 5 backend packages |
| Cage 7 | Full Automated Contract Suite | PASS | 103/103 tests passing in 811ms |
