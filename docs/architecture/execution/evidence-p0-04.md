# P0-04: Configuration Hardening & Secret Fail-Fast

- Phase / track: Phase 0 / S0 (Slice 4) & R1 (Slice 1)
- Invariant: A process MUST NOT bind a port or accept a queue job if required secrets or connection settings are absent, empty, shorter than 32 characters, or known insecure defaults. Error messages MUST name configuration keys only and NEVER echo secret values.
- Scope and forbidden scope:
  - Scope:
    1. Implement centralized `validateRequiredEnv(role, env)` in `@minimeet/shared` with role-specific specs (`PROCESS_ENV_SPECS`) for all 7 deployable process roles (`auth-http`, `auth-worker`, `auth-scheduler`, `room-http`, `room-worker`, `room-scheduler`, `mediasoup`).
    2. Strip hardcoded fallback secrets (`meetlite_secure_password_2026`, `meetlite_super_secret_jwt_key_2026`, `meetlite_session_secret_key_2026`, `admin123`) from `docker-compose.yml` and replace them with mandatory variable syntax (`${VAR:?VAR is required}`).
    3. Remove weak fallbacks (`|| 'secret'`) from `backend/packages/auth-service/src/config/session.ts` and `backend/packages/room-service/src/config/session.ts`.
    4. Clean example templates (`.env.docker.example`, `.env.example`) to remove default fallback secrets, providing clear guidance on setting strong random keys (minimum 32 characters).
    5. Wire fail-fast validation at the top of startup in all 7 entry points before connecting to PostgreSQL, Redis, or binding HTTP / WebRTC listener ports.
    6. Automated verification suite (`required-env.test.ts` and `config-hardening.test.ts`) guaranteeing 100% test coverage over configuration validation, secret length checks, known weak secret rejections, value-redaction, and template hygiene.
  - Forbidden scope:
    - Migrating all remaining non-critical application feature flags into typed config schemas (tracked as an R1 follow-up).
    - Modifying database schemas or queue job payloads.
- Dependencies: `@minimeet/shared`.
- Risk classification: low
- Rollback / kill switch: Git revert of entry points, session config files, and `docker-compose.yml`.
- Baseline commit and environment:
  - Commit: `2788e0c` (HEAD -> feature/cloudflare-scaling)
  - Environment: macOS (Darwin 24.6.0), Node v24.21.0, npm 11.19.0
- Pre-existing failures recorded:
  - `docker-compose.yml` hardcoded fallback credentials (`meetlite_secure_password_2026`, `meetlite_super_secret_jwt_key_2026`, `meetlite_session_secret_key_2026`, `admin123`), allowing containers to boot with publicly known credentials if variables were unset.
  - Express session configurations in `auth-service` and `room-service` fell back to `'secret'` if `SESSION_SECRET` was omitted.
  - Entry points attempted DB/Redis connections or port binding before validating whether required environment variables met security constraints.

## Red evidence
1. Hardcoded fallback secrets in `docker-compose.yml`:
```yaml
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-meetlite_secure_password_2026}
JWT_SECRET: ${JWT_SECRET:-meetlite_super_secret_jwt_key_2026}
SESSION_SECRET: ${SESSION_SECRET:-meetlite_session_secret_key_2026}
INITIAL_SYSTEM_ADMIN_PASSWORD: ${INITIAL_SYSTEM_ADMIN_PASSWORD:-admin123}
```
2. Hardcoded fallback secrets in session configurations:
```ts
// auth-service/src/config/session.ts & room-service/src/config/session.ts
secret: process.env.SESSION_SECRET || 'secret'
```
3. Missing startup verification: Any service could boot and bind network ports without `JWT_SECRET` or `SESSION_SECRET`, failing only much later during request handling or silently creating insecure sessions.

## Green evidence
1. **Centralized Fail-Fast Validation (`@minimeet/shared`)**:
- Implemented in `backend/packages/shared/src/config/required-env.ts`:
  - `PROCESS_ENV_SPECS`: Role-specific requirement maps:
    - `auth-http`: requires `DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET`, `REDIS_HOST` (or `REDIS_URL`).
    - `auth-worker`: requires `DATABASE_URL`, `REDIS_HOST` (or `REDIS_URL`).
    - `auth-scheduler`: requires `DATABASE_URL`, `REDIS_HOST` (or `REDIS_URL`).
    - `room-http`: requires `DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET`, `REDIS_HOST` (or `REDIS_URL`).
    - `room-worker`: requires `DATABASE_URL`, `REDIS_HOST` (or `REDIS_URL`).
    - `room-scheduler`: requires `DATABASE_URL`.
    - `mediasoup`: requires `JWT_SECRET`, `REDIS_HOST` (or `REDIS_URL`).
  - Strict minimum secret length constraint (`>= 32` characters).
  - Explicit blocklist of known weak/fallback secrets (`KNOWN_INSECURE_SECRETS`).
  - `ConfigValidationError` lists only missing/invalid variable names; secret values are never echoed in messages or logs.

2. **Clean Session Configuration**:
- In `backend/packages/auth-service/src/config/session.ts` and `backend/packages/room-service/src/config/session.ts`:
  - Removed `|| 'secret'` fallbacks. Both now reference `process.env.SESSION_SECRET!`.

3. **Hardened Docker Compose & Templates**:
- In `docker-compose.yml`:
  - `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}`
  - `JWT_SECRET: ${JWT_SECRET:?JWT_SECRET is required}`
  - `SESSION_SECRET: ${SESSION_SECRET:?SESSION_SECRET is required}`
  - `INITIAL_SYSTEM_ADMIN_PASSWORD: ${INITIAL_SYSTEM_ADMIN_PASSWORD:?INITIAL_SYSTEM_ADMIN_PASSWORD is required}`
  - Removed redundant secrets from worker containers that do not issue or verify tokens.
- In `.env.docker.example` and `.env.example`:
  - Replaced hardcoded default passwords and secrets with explicit replacement instructions.

4. **Service Entry Point Wire-Ins**:
- All 7 entry points invoke `validateRequiredEnv(role, process.env)` before any socket, DB, or Redis connections:
  - `backend/packages/auth-service/src/index.ts` (`auth-http`)
  - `backend/packages/auth-service/src/worker.ts` (`auth-worker`)
  - `backend/packages/auth-service/src/scheduler.ts` (`auth-scheduler`)
  - `backend/packages/room-service/src/index.ts` (`room-http`)
  - `backend/packages/room-service/src/worker.ts` (`room-worker`)
  - `backend/packages/room-service/src/scheduler.ts` (`room-scheduler`)
  - `backend/packages/mediasoup-service/src/index.ts` (`mediasoup`)

5. **Automated Unit & Contract Test Suite**:
```bash
$ npm run test:unit
▶ P0-04: Required configuration fail-fast
  ✔ returns a frozen typed object when all required keys are present (0.65ms)
  ✔ throws listing every missing key for the process role (0.75ms)
  ✔ treats empty and whitespace-only values as missing (0.11ms)
  ✔ rejects known insecure fallback secrets (0.21ms)
  ✔ rejects secrets shorter than 32 characters (0.10ms)
  ✔ error message names keys but never echoes values (0.10ms)
  ✔ accepts REDIS_URL as an alternative to REDIS_HOST (0.07ms)
  ✔ workers and schedulers do not require HTTP-only secrets (0.07ms)
✔ P0-04: Required configuration fail-fast (2.98ms)
▶ P0-04: Configuration Hardening & Secret Fail-Fast Contract
  ✔ docker-compose.yml must not contain hardcoded fallback secrets (4.68ms)
  ✔ environment example templates must not contain hardcoded fallback secrets (1.31ms)
  ✔ session config files must not fall back to "secret" (0.42ms)
  ✔ all deployable roles have defined environment specs and fail fast if invalid (2.15ms)
  ✔ service entry points must invoke validateRequiredEnv before starting (3.40ms)
✔ P0-04: Configuration Hardening & Secret Fail-Fast Contract (13.02ms)
ℹ tests 38, suites 7, pass 38, fail 0 (duration: 192ms)
```

6. **Static Checks & Build**:
- `npm run typecheck`: clean exit 0 across all 5 backend workspaces.
- `npm run build`: clean exit 0 across all backend workspaces.

## Adversarial cases
1. **Empty string vs. absent variable**:
- Variables set to `""` or whitespace `"   "` are treated identically to missing variables, throwing `ConfigValidationError`.
2. **Short secret attempt**:
- A secret like `"short-key-1234"` throws `ConfigValidationError` citing invalid key length (< 32 chars).
3. **Leaked secret in error log**:
- Verified by unit test: An invalid secret (`"secret"` or `"meetlite_super_secret_jwt_key_2026"`) does NOT appear in `err.message` or the error string. Only the key name (`JWT_SECRET`) is cited.
4. **Unset compose variable**:
- Docker Compose fails immediately at command invocation if `POSTGRES_PASSWORD`, `JWT_SECRET`, or `SESSION_SECRET` are not set.

## Canary
N/A (startup validation and configuration hardening; no live deployment cohort).

## Residual risks and follow-ups
- Follow-up ticket **P0-05 (Health Semantics: Live, Ready, Startup)** will add distinct probe endpoints (`/health/live`, `/health/ready`, `/health/startup`) with timeout protection so orchestrators can differentiate running processes from healthy dependencies.
- Follow-up ticket **R1 Slice 1** will complete the broader configuration refactor by moving all non-essential environment flags across services into structured configuration objects.
