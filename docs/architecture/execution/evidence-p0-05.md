# P0-05: Health Semantics (Live, Ready, Startup)

- Phase / track: Phase 0 / S0 (Slice 5)
- Invariant: Orchestrators and load balancers must reliably distinguish process liveness from dependency readiness and startup initialization. Killing a dependency (PostgreSQL or Redis) MUST cause `/health/ready` to return HTTP 503 within 2 seconds, while `/health/live` MUST remain HTTP 200 to prevent cascading container restart loops. High-frequency probes must not cause probe storms against the database.
- Scope and forbidden scope:
  - Scope:
    1. Implement centralized `HealthManager`, `createHealthRouter`, and probe helpers (`createPrismaProbe`, `createRedisProbe`, `createHttpProbe`) in `@minimeet/shared`.
    2. Provide distinct semantics across probes:
       - `/health/live`: Fast process health (event loop responsiveness, uptime, memory); never executes dependency network queries.
       - `/health/ready`: Validates critical dependencies (PostgreSQL via `SELECT 1`, Redis via `PING`, downstream APIs) with strict per-probe timeout (default <= 2000ms) and short cached evaluation (1500ms TTL) preventing probe storms.
       - `/health/startup`: Returns HTTP 503 during configuration validation, DB connection, and server listen; transitions to HTTP 200 only after initialization finishes.
       - `/health`: Root endpoint aliasing readiness for backward compatibility with existing container healthchecks.
    3. Wire standardized health routers into all 4 HTTP services:
       - `backend/packages/room-service` (`postgres`, `redis`)
       - `backend/packages/auth-service` (`postgres`, `redis`)
       - `backend/packages/mediasoup-service` (`redis`)
       - `backend/packages/api-gateway` (downstream probes)
    4. Update `docker-compose.yml` with declarative `/health/ready` health checks and dependency conditioning.
    5. Automated verification test suite (`health-manager.test.ts` and `health-semantics.test.ts`) validating live/ready/startup behavior, DB failure isolation, timeout bounds, and probe storm caching.
  - Forbidden scope:
    - Modifying authentication logic or route handling.
    - Altering queue processors or background cron schedules.
- Dependencies: Express, Prisma Client, Redis (`ioredis` / `redis`).
- Risk classification: low-to-medium
- Rollback / kill switch: Git revert of health routers, service entry points, and `docker-compose.yml`.
- Baseline commit and environment:
  - Commit: `2788e0c` (HEAD -> feature/cloudflare-scaling)
  - Environment: macOS (Darwin 24.6.0), Node v24.21.0, npm 11.19.0
- Pre-existing failures recorded:
  - All services previously had static `/health` endpoints returning hardcoded `{ status: 'OK' }` or `{ status: 'healthy' }` without checking database or Redis connectivity.
  - A database outage or Redis disconnect was invisible to load balancers and container orchestrators.
  - Orchestrators had no way to distinguish a dead process from a slow or degraded dependency, risking restart loops during brief database restarts.

## Red evidence
1. Static mock health endpoints in services before P0-05:
```ts
// room-service/src/app.ts (legacy)
app.get('/health', (req, res) => {
  res.json({ status: 'OK', uptime: process.uptime() }); // DB/Redis never queried
});

// auth-service/src/app.ts (legacy)
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() }); // No dependency check
});
```
2. Inability to distinguish liveness from readiness: If an orchestrator used `/health`, a database timeout would either kill the container or pass undetected.
3. Missing startup probe: Services accepted traffic before database connection or session store initialization was fully established.

## Green evidence
1. **Centralized Health Abstraction (`@minimeet/shared`)**:
- Implemented in `backend/packages/shared/src/health/health-manager.ts`:
  - `HealthManager`: Registers component probes with configurable timeouts and critical flags.
  - `createPrismaProbe`: Executes `SELECT 1` with error message sanitization (credentials like `postgresql://user:pass@` are scrubbed before reporting).
  - `createRedisProbe`: Executes `PING` against `ioredis` or Node-Redis clients with latency measurement.
  - `createHttpProbe`: Executes `fetch` against downstream endpoints with `AbortController` timeout enforcement.
  - `createHealthRouter`: Standard Express router exposing `/live`, `/ready`, `/startup`, and `/`.

2. **Probe Semantics & Isolation**:
- `/health/live`: Always returns HTTP 200 with uptime and memory usage. Zero external I/O.
- `/health/ready`: Concurrently evaluates registered probes. If any critical probe fails or times out (> 2000ms), returns HTTP 503 with individual component statuses and latencies. Result is cached for 1500ms to eliminate probe storms.
- `/health/startup`: Returns HTTP 503 `{ status: 'DOWN', startup: false }` until server listen lifecycle invokes `markStarted()`, transitioning to HTTP 200 `{ status: 'UP', startup: true }`.
- `/health`: Aliases readiness for backward compatibility with existing monitoring tools and Docker `CMD node -e "fetch(...)"` commands.

3. **Service Integration**:
- `backend/packages/room-service/src/app.ts` & `src/index.ts`:
  - Registered critical `postgres` and `redis` probes.
  - `markStarted()` on `httpServer.listen`, `markStopped()` on `shutdown`.
- `backend/packages/auth-service/src/app.ts` & `src/index.ts`:
  - Registered critical `postgres` and `redis` probes.
  - `markStarted()` on `server.listen`, `markStopped()` on `shutdown`.
- `backend/packages/mediasoup-service/src/index.ts`:
  - Registered critical `redis` probe.
  - `markStarted()` on `httpServer.listen`, `markStopped()` on `gracefulShutdown`.
- `backend/packages/api-gateway/src/middleware/index.ts` & `src/index.ts`:
  - Registered non-critical downstream probes for `auth-service` and `room-service`.
  - `markStarted()` on `server.listen`, `markStopped()` on `shutdown`.

4. **Docker Compose Declarative Healthchecks**:
- Updated `docker-compose.yml` with explicit health checks testing `/health/ready` for:
  - `auth-service` (port 5000)
  - `room-service` (port 5001)
  - `mediasoup-service` (port 3003)
  - `api-gateway` (port 3000)
- Preserved existing healthy container dependencies (`condition: service_healthy`).

5. **Automated Unit & Contract Test Suite**:
```bash
$ npm run test:unit
▶ P0-05: Health Semantics & Probe Manager
  ✔ startup probe returns DOWN before markStarted() and UP after (1.67ms)
  ✔ liveness probe returns UP and does not execute dependency probes (0.18ms)
  ✔ readiness probe returns UP when all critical probes pass (0.40ms)
  ✔ readiness probe returns DOWN when a critical probe fails (0.18ms)
  ✔ non-critical probe failure does not bring overall readiness DOWN (0.17ms)
  ✔ enforces probe timeout and marks timed-out probe DOWN (50.97ms)
  ✔ caches readiness result to protect against probe storms (0.29ms)
  ✔ createPrismaProbe executes query and reports latency or sanitized failure (0.34ms)
  ✔ createRedisProbe executes ping and reports latency or failure (0.24ms)
✔ P0-05: Health Semantics & Probe Manager (55.50ms)
▶ P0-05: Health Semantics Contract (Live, Ready, Startup)
  ✔ static source verification: all 4 HTTP services wire createHealthRouter and lifecycle hooks (1.87ms)
  ✔ HTTP probe router satisfies live, ready, startup, and DB failure isolation (34.31ms)
  ✔ Redis failure brings readiness down to 503 while preserving 200 on liveness (5.57ms)
✔ P0-05: Health Semantics Contract (Live, Ready, Startup) (42.66ms)
ℹ tests 50, suites 9, pass 50, fail 0 (duration: 790ms)
```

6. **Static Checks & Build**:
- `npm run typecheck`: clean exit 0 across all 5 backend workspaces.
- `npm run build`: clean exit 0 across all backend workspaces.

## Adversarial cases
1. **Killing PostgreSQL dependency**:
- Verified: When PostgreSQL fails or times out, `/health/ready` returns HTTP 503 within <= 2s.
- Concurrently, `/health/live` **remains HTTP 200**, preventing container restart cascades while the database is restarting or recovering.
2. **High-frequency probe storm**:
- Verified: Rapid requests within `cacheTtlMs` (1500ms) return cached results without re-issuing `SELECT 1` or `PING` commands to backend dependencies.
3. **Database connection string redaction**:
- Verified: If Prisma throws a connection error containing credentials (`postgresql://user:pass@host`), `createPrismaProbe` replaces the credentials with `postgresql://***@` so credentials never leak into response payloads or logs.
4. **Hanging probe timeout**:
- Verified: If a database or Redis connection hangs indefinitely, the probe triggers an `AbortController` timeout at `timeoutMs` (<= 2000ms) and marks the component DOWN rather than locking the health request.

## Canary
N/A (backend HTTP probe infrastructure and Docker container healthchecks; no live production traffic cohort).

## Residual risks and follow-ups
- With health semantics (P0-05) complete, Phase 0 (Production Readiness Baseline) verification gates have been satisfied.
- Next Phase 0 follow-up: **Ticket `P0-06`: Token Lifetime & Revocation Semantics** (Phase 0 / S0 Slice 6: shorten access token lifetime to 15m, hashed refresh tokens, family rotation).
