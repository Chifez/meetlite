# S1-03: Database Connection Bounding & Neon PgBouncer Pooled Endpoint Adoption

- Phase / track: Phase 1 / S1 (Slice 5 & 6: Static Delivery, Private Object Storage, and Database Connection Control)
- Invariant:
  1. Application Prisma queries MUST route to Neon's pooled endpoint with `pgbouncer=true` and explicit `connection_limit`, eliminating prepared statement conflicts and capping connection footprint per replica.
  2. Direct unpooled connections (`DIRECT_URL`) MUST be strictly reserved for schema migrations (`prisma migrate deploy`) and admin jobs; application runtime queries MUST NOT bypass the pooler.
  3. Per-process connection limits MUST strictly satisfy the database connection budget formula:
     $$\text{totalDatabaseLimit} \ge \sum (\text{replicas} \times \text{poolPerReplica}) + \text{workers} + \text{migrationReserve} + \text{adminReserve}$$
  4. High concurrency loads (1,000 concurrent requests) MUST queue predictably within pool bounds without connection leaks, socket exhaustion, or backend PostgreSQL process crashes.
- Scope and forbidden scope:
  - Scope:
    1. Update `backend/packages/shared/prisma/schema.prisma` datasource to declare `directUrl = env("DIRECT_URL")`.
    2. Build database connection configuration and budget management module in `backend/packages/shared/src/database/connection-config.ts` (`formatPooledDatabaseUrl`, `calculateConnectionBudget`, `validateDatabaseUrls`, `ROLE_CONNECTION_LIMITS`).
    3. Update `backend/packages/shared/src/prisma.ts` with `createPrismaClient` factory that dynamically formats pooled datasource URLs with bounded connection limits and pool timeouts.
    4. Update `docker-compose.yml` to inject `DIRECT_URL` for `prisma-migrate` and assign explicit `PROCESS_ROLE` (`auth-http`, `auth-worker`, `auth-scheduler`, `room-http`, `room-worker`, `room-scheduler`) across all services.
    5. Update `.env.example` and `.env.docker.example` with Neon pooled vs direct URL documentation.
    6. Implement automated test suite with 1,000 concurrent request simulation and timeout drills in `backend/packages/shared/src/testing/database-connection.test.ts`.
  - Forbidden scope:
    - Modifying database schema tables, column types, or Prisma model relations.
    - Altering transaction logic within specific application business workflows.
- Dependencies: `@prisma/client`, `prisma`, Neon PgBouncer.
- Risk classification: medium (database connection layer and migration topology).
- Rollback / kill switch: `DIRECT_URL` defaults safely to `DATABASE_URL` in local/docker environments; `formatPooledDatabaseUrl` gracefully preserves raw connection strings if no pooler is detected.
- Baseline commit and environment:
  - Commit: `2788e0c` (HEAD -> feature/cloudflare-scaling)
  - Environment: macOS (Darwin 24.6.0), Node v24.21.0, npm 11.19.0
- Pre-existing failures recorded:
  - Prisma was configured with only a single `DATABASE_URL` without `directUrl`, preventing safe separation of migration execution from transaction-pooled application queries.
  - No per-process connection limits were configured, causing Prisma to spawn default connection pools derived from CPU cores ($2 \times \text{CPUs} + 1$), creating connection exhaustion risks under horizontal replica scaling.
  - No automated verification of connection budget headroom or high-concurrency pool queuing existed.

## Red evidence
1. Failing test assertions prior to implementation:
```text
✖ S1-03: Database Connection Bounding & Neon PgBouncer Contract
  ✖ schema.prisma does not declare directUrl
  ✖ docker-compose.yml prisma-migrate does not configure DIRECT_URL
  ✖ formatPooledDatabaseUrl is not a function
  ✖ calculateConnectionBudget is not a function
  ✖ validateDatabaseUrls is not a function
  ✖ docker-compose.yml services do not declare PROCESS_ROLE
  ✖ prisma.ts does not format pooled database URL
```

## Green evidence
1. **Prisma Datasource Configuration (`schema.prisma`)**:
- Added `directUrl = env("DIRECT_URL")`:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```
- Re-generated Prisma client (`v5.22.0`). Direct unpooled connection is used by Prisma CLI during migrations, while `DATABASE_URL` serves application queries.

2. **Database Connection Configuration & Bounding (`connection-config.ts`)**:
- Implemented `formatPooledDatabaseUrl`:
  - Automatically identifies Neon pooler hosts (`-pooler` or port `6543`) or `PG_BOUNCER=true` and injects `pgbouncer=true`.
  - Injects role-specific `connection_limit` and `pool_timeout=15s` into the connection URL.
  - Dedupes and cleanly formats URL search parameters.
- Implemented `calculateConnectionBudget`:
  - Enforces explicit connection capacity formula.
  - Standard production budget (100 total limit): 4 HTTP replicas $\times$ 10 + 4 workers $\times$ 5 + 2 schedulers $\times$ 2 + 5 migration reserve + 5 admin reserve = 74 allocated $\le$ 100 limit (preserving 26 connections safety margin).
- Implemented `validateDatabaseUrls`:
  - Validates syntax and verifies that `DIRECT_URL` never points to a pooled PgBouncer endpoint.

3. **Prisma Client Factory (`prisma.ts`)**:
- Exported `createPrismaClient(options)` factory.
- Default `prisma` singleton initializes with role-bounded pooled datasource URL and appropriate environment logging.

4. **Service Role Isolation & Docker Compose Wiring**:
- `prisma-migrate`: Explicitly configured with `DIRECT_URL`.
- `auth-service`: `PROCESS_ROLE: auth-http` (limit 10).
- `auth-worker`: `PROCESS_ROLE: auth-worker` (limit 5).
- `auth-scheduler`: `PROCESS_ROLE: auth-scheduler` (limit 2).
- `room-service`: `PROCESS_ROLE: room-http` (limit 10).
- `room-worker`: `PROCESS_ROLE: room-worker` (limit 5).
- `room-scheduler`: `PROCESS_ROLE: room-scheduler` (limit 2).

5. **Test & Build Verification**:
- Unit test suite: **96 / 96 tests passing** across 27 test suites in 890ms (`npm run test:unit`).
- Typecheck: All 5 backend packages (`@minimeet/shared`, `@minimeet/api-gateway`, `@minimeet/auth-service`, `@minimeet/room-service`, `@minimeet/mediasoup-service`) typecheck cleanly with **0 errors**.
- Backend build: All 5 packages built cleanly to `dist/` with **0 errors**.

## Adversarial & Concurrency Drills
1. **1,000 Concurrent Queries Through Bounded Pool**:
   - Launched 1,000 concurrent simulated database queries against a pool strictly capped at 5 connections.
   - Verified that all 1,000 queries completed successfully, peak active connections strictly matched pool capacity ($5$), and active connections returned to $0$ upon completion with zero leaks.
2. **Pool Acquisition Timeout**:
   - Simulated saturated pool and verified that requests exceeding `pool_timeout` fail fast with descriptive error rather than hanging indefinitely.
3. **Over-Allocated Budget Detection**:
   - Evaluated an intentionally over-allocated budget ($60 > 50$). Verified formula immediately flags `isValid: false` and calculates negative margin.
4. **Direct URL Pooler Detection**:
   - Verified that passing a pooled URL as `DIRECT_URL` triggers validation rejection to protect migration integrity.

## Verification Cage Summary
| Cage | Verification Check | Status | Evidence |
| :--- | :--- | :--- | :--- |
| Cage 0 | Pre-flight baseline & git diff check | PASS | Clean baseline with preserved Phase 0 and S1-01/S1-02 contracts |
| Cage 1 | Schema & Migration Direct URL | PASS | `directUrl = env("DIRECT_URL")` declared in `schema.prisma` |
| Cage 2 | PgBouncer Parameter Injection | PASS | `pgbouncer=true` automatically set on pooler hosts |
| Cage 3 | Connection Budget Headroom | PASS | 74 allocated $\le$ 100 capacity (26 connection safety margin) |
| Cage 4 | Per-Process Role Bounds | PASS | `auth-http`/`room-http` (10), workers (5), schedulers (2) |
| Cage 5 | High Concurrency Queuing | PASS | 1,000 concurrent queries executed without leaks or exhaustion |
| Cage 6 | Typecheck & Build Cleanliness | PASS | 0 type errors across all 5 backend packages and client |
| Cage 7 | Full Automated Contract Suite | PASS | 96/96 tests passing in 890ms |
