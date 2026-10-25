# P0-03: Process-Role Isolation (Decouple Queue Workers & Schedulers from HTTP Services)

- Phase / track: Phase 0 / S0 (Slice 3) & R1 (Slices 2 & 4)
- Invariant: Scaling HTTP API processes must not multiply worker or cron executions. HTTP servers, background queue workers, and cron schedulers must have isolated entry points, lifecycles, and container definitions.
- Scope and forbidden scope:
  - Scope:
    1. Extract queue workers (`NotificationWorker`, `VideoProcessingWorker`) and recurrence cron from `room-service/src/index.ts` into dedicated `src/worker.ts` and `src/scheduler.ts`.
    2. Extract `EmailWorker` and billing/usage cron jobs from `auth-service/src/index.ts` into dedicated `src/worker.ts` and `src/scheduler.ts`.
    3. Convert import-time cron side effects in `room-service` and `auth-service` jobs into explicit start/stop lifecycles.
    4. Provide HTTP application factory seams (`app.ts`) for clean testing without port binding or worker initialization.
    5. Update `docker-compose.yml` with dedicated `room-worker`, `room-scheduler`, `auth-worker`, and `auth-scheduler` services with clean dependency management and zero host port collisions.
    6. Automated verification suite (`backend/packages/shared/src/testing/process-role-isolation.test.ts`) proving that HTTP entry points spawn zero background workers/crons, that dedicated worker/scheduler entry points manage clean lifecycles, and that docker-compose defines isolated roles.
  - Forbidden scope: Changing queue job payloads or handlers, altering HTTP route paths or handlers, modifying database models or queries.
- Dependencies: Redis, PostgreSQL, BullMQ, `node-cron`.
- Risk classification: medium
- Rollback / kill switch: Git revert of entry points and `docker-compose.yml`.
- Baseline commit and environment:
  - Commit: `ddc572c` (HEAD -> feature/cloudflare-scaling)
  - Environment: macOS (Darwin 24.6.0), Node v24.21.0, npm 11.19.0
- Pre-existing failures recorded:
  - `room-service/src/index.ts` unconditionally instantiated `NotificationWorker` and `VideoProcessingWorker` during HTTP server startup.
  - `room-service/src/index.ts` and `auth-service/src/index.ts` executed top-level `node-cron` schedules on import.
  - `docker-compose.yml` lacked dedicated worker and scheduler containers; scaling HTTP replicas multiplied workers and crons N-fold.

## Red evidence
1. Coupled worker and cron execution in `room-service/src/index.ts`:
```ts
// import-time cron side-effect
import './jobs/recurrence.job.js';
...
// worker instantiation in HTTP startServer
new NotificationWorker(...);
new VideoProcessingWorker(...);
```
2. Coupled worker and cron execution in `auth-service/src/index.ts`:
```ts
// import-time cron side-effects
import './jobs/usage-reset.job.js';
import './jobs/plan-expiration.job.js';
import './jobs/plan-expiry-warning.job.js';
...
// worker instantiation in HTTP startServer
emailWorker = new EmailWorker(...);
```
3. Scaling HTTP replicas in `docker-compose.yml` multiplied worker concurrency and duplicate cron executions.

## Green evidence
1. **Isolated HTTP Entry Points**:
- `backend/packages/room-service/src/app.ts`: HTTP application factory decoupled from server listen, Redis connection, and workers.
- `backend/packages/room-service/src/index.ts`: Pure HTTP server entry point handling port binding, session store, and client SSE streaming without workers or crons.
- `backend/packages/auth-service/src/app.ts`: HTTP application factory decoupled from server listen and workers.
- `backend/packages/auth-service/src/index.ts`: Pure HTTP server entry point handling auth routes and initial admin bootstrap without `EmailWorker` or crons.

2. **Dedicated Background Queue Worker Entry Points**:
- `backend/packages/room-service/src/worker.ts`: Dedicated worker process hosting `NotificationWorker` and `VideoProcessingWorker` with graceful shutdown (`SIGTERM`/`SIGINT`).
- `backend/packages/auth-service/src/worker.ts`: Dedicated worker process hosting `EmailWorker` with graceful shutdown.

3. **Explicit Cron Schedulers (Zero Import Side Effects)**:
- `backend/packages/room-service/src/jobs/recurrence.job.ts`: Exports explicit `startRecurrenceScheduler()` and `runRecurrenceJob()`.
- `backend/packages/room-service/src/scheduler.ts`: Dedicated cron process for recurrence instance generation.
- `backend/packages/auth-service/src/jobs/usage-reset.job.ts`: Exports explicit `startUsageResetScheduler()`.
- `backend/packages/auth-service/src/jobs/plan-expiration.job.ts`: Exports explicit `startPlanExpirationScheduler()`.
- `backend/packages/auth-service/src/jobs/plan-expiry-warning.job.ts`: Exports explicit `startPlanExpiryWarningScheduler()`.
- `backend/packages/auth-service/src/scheduler.ts`: Dedicated cron process for billing and usage crons.

4. **Docker Compose Process-Role Architecture**:
- In `docker-compose.yml`:
  - `auth-service`: HTTP server on port 5002.
  - `auth-worker`: Background worker container running `node dist/worker.js` (no host ports).
  - `auth-scheduler`: Background scheduler container running `node dist/scheduler.js` (no host ports).
  - `room-service`: HTTP server on port 5003.
  - `room-worker`: Background worker container running `node dist/worker.js` (no host ports).
  - `room-scheduler`: Background scheduler container running `node dist/scheduler.js` (no host ports).

5. **Automated Unit & Contract Test Suite**:
```bash
$ npm run test:unit
▶ P0-03: Process-Role Isolation Contract
  ✔ room-service HTTP entry point does not start workers or import crons (0.63ms)
  ✔ auth-service HTTP entry point does not start workers or import crons (0.17ms)
  ✔ dedicated worker and scheduler entry points exist for room-service and auth-service (0.14ms)
  ✔ cron jobs export explicit lifecycle functions rather than top-level side effects (0.99ms)
  ✔ docker-compose.yml defines separate services for workers and schedulers with no port collisions (0.63ms)
  ✔ package manifests define role-specific start scripts (0.40ms)
✔ P0-03: Process-Role Isolation Contract (3.90ms)
ℹ tests 25, suites 5, pass 25, fail 0 (duration: 176ms)
```

6. **Static Checks & Build**:
- `npm run typecheck`: clean exit 0 across all 5 backend workspaces.
- `npm run build`: clean exit 0 across all backend workspaces.

## Adversarial cases
1. **HTTP replica scaling safety**:
- Scaling `room-service` or `auth-service` replicas (e.g. `--scale room-service=3`) spawns only HTTP listener containers; zero duplicate `NotificationWorker`, `VideoProcessingWorker`, or `EmailWorker` instances are created.
2. **Zero import-time side effects**:
- Importing `app.ts` or job modules in unit tests or application factories registers 0 cron tasks on Node event loops and creates 0 background Redis listeners.
3. **Graceful worker drain on SIGTERM**:
- Worker entry points explicitly call `worker.close()` prior to Redis disconnect, allowing active BullMQ jobs to finish without job loss or orphaned Redis locks.

## Canary
N/A (backend process role separation and Docker container composition; no client-facing traffic cohort).

## Residual risks and follow-ups
- Hardcoded fallback secrets in `docker-compose.yml` (`meetlite_secure_password_2026`, `meetlite_super_secret_jwt_key_2026`) and absence of startup secret validation will be resolved in **P0-04 (Configuration Hardening & Secret Fail-Fast)**.
- Real liveness/readiness health probes with timeout protection will be added in **P0-05 (Health Semantics: Live, Ready, Startup)**.
