# P0-02: Safe Database Delivery, Prisma Baseline Migration & Container Startup Hardening

- Phase / track: Phase 0 / S0 (Slice 2)
- Invariant: Eliminate destructive schema operations (`prisma db push --accept-data-loss`) in favor of repeatable, versioned Prisma migrations; guarantee zero data loss on existing database instances and reproducible deployment on fresh instances.
- Scope and forbidden scope:
  - Scope:
    1. Baseline Prisma migration (`backend/packages/shared/prisma/migrations/0_init/migration.sql`) generated from canonical datamodel.
    2. Container migration runner in `docker-compose.yml` switched from `prisma db push --schema=... --accept-data-loss` to `prisma migrate deploy`.
    3. Migration scripts and automation in `backend/packages/shared/package.json`, `backend/package.json`, and root `package.json` (`prisma:generate`, `db:migrate:deploy`, `db:migrate:status`, `db:migrate:resolve`).
    4. Migration safety test suite (`backend/packages/shared/src/testing/migration-contract.test.ts`) verifying baseline DDL, docker-compose safety invariants, and package script contracts.
    5. Database backup and restore drill into an isolated environment.
  - Forbidden scope: Modifying models or columns in `backend/packages/shared/prisma/schema.prisma`; changing application business logic or endpoints; altering production table definitions.
- Dependencies: PostgreSQL 16 container, Prisma CLI 5.20+.
- Risk classification: medium
- Rollback / kill switch: Git revert of `docker-compose.yml`, package manifests, and migration files.
- Baseline commit and environment:
  - Commit: `ddc572c` (HEAD -> feature/cloudflare-scaling)
  - Environment: macOS (Darwin 24.6.0), Node v24.21.0, npm 11.19.0, PostgreSQL 16-alpine (Docker)
- Pre-existing failures recorded:
  - Absence of `migrations/` directory; `_prisma_migrations` table absent in PostgreSQL.
  - Destructive container startup command `prisma db push --accept-data-loss` in `docker-compose.yml:53`.

## Red evidence
Baseline status command before migration directory creation:
```bash
$ DATABASE_URL="..." ./backend/node_modules/.bin/prisma migrate status --schema=backend/packages/shared/prisma/schema.prisma
Datasource "db": PostgreSQL database "meetlite", schema "public" at "localhost:5433"

No migration found in prisma/migrations
The current database is not managed by Prisma Migrate.
```
And container was executing:
```yaml
command: npx prisma db push --schema=/app/packages/shared/prisma/schema.prisma --accept-data-loss
```

## Green evidence
1. **Baseline Migration Generated & Baselined**:
- Generated non-destructive baseline DDL: `backend/packages/shared/prisma/migrations/0_init/migration.sql` (680 lines of DDL covering all 25 tables, indices, and foreign keys).
- Verified zero schema drift between live database and datamodel:
```bash
$ prisma migrate diff --from-url="..." --to-schema-datamodel schema.prisma
-- This is an empty migration.
```
- Baselined live `meetlite` database without data loss:
```bash
$ prisma migrate resolve --applied 0_init
Migration 0_init marked as applied.
```

2. **Migration Status & Deploy Verification**:
```bash
$ npm run db:migrate:status
1 migration found in prisma/migrations
Database schema is up to date!

$ npm run db:migrate:deploy
1 migration found in prisma/migrations
No pending migrations to apply.
```

3. **Safe Container Startup Contract**:
- In `docker-compose.yml`:
```yaml
  prisma-migrate:
    image: meetlite-auth-service:latest
    container_name: meetlite-prisma-migrate
    command: npx prisma migrate deploy --schema=/app/packages/shared/prisma/schema.prisma
```
- Dependent services (`auth-service`, `room-service`) continue waiting with `condition: service_completed_successfully`.

4. **Automated Unit & Contract Test Suite**:
```bash
$ npm run test:unit
▶ P0-02: Safe Database Delivery & Migration Contract
  ✔ docker-compose.yml must not use destructive db push or --accept-data-loss (0.959375ms)
  ✔ dependent services must wait for prisma-migrate to complete successfully (0.184625ms)
  ✔ baseline migration 0_init exists and defines canonical tables (0.540875ms)
  ✔ package manifests define canonical migration script contracts (0.295208ms)
✔ P0-02: Safe Database Delivery & Migration Contract (2.866209ms)
ℹ tests 19, suites 4, pass 19, fail 0 (duration: 1643ms)
```

5. **Static Checks & Build**:
- `npm run typecheck`: clean exit 0 across `@minimeet/shared`, `@minimeet/api-gateway`, `@minimeet/auth-service`, `@minimeet/room-service`, `@minimeet/mediasoup-service`.
- `npm run build`: clean exit 0 across all backend workspaces.

## Adversarial cases
1. **Idempotency under repeated execution**:
- Executing `npm run db:migrate:deploy` repeatedly reports `No pending migrations to apply` and exits 0 with zero alterations.
2. **Fresh database deployment**:
- Created isolated fresh database `meetlite_fresh_empty` and executed `prisma migrate deploy`: successfully applied `0_init` creating 25 tables + 1 `_prisma_migrations` table without requiring interactive intervention.
3. **Database backup & restore drill**:
- Dumped live database via `pg_dump -U meetlite -d meetlite -F p -f /tmp/meetlite_baseline_backup.sql` (53,789 bytes).
- Restored dump into isolated database `meetlite_isolated_restore`.
- Verified table count parity: 25 tables before and after restore.
- Verified `prisma migrate resolve --applied 0_init` cleanly attached migration tracking to restored database.

## Canary
N/A (database delivery contract and migration baseline; no client-facing traffic cohort).

## Residual risks and follow-ups
- Application code currently still contains hardcoded fallback secrets in `docker-compose.yml` (`meetlite_secure_password_2026`, `meetlite_super_secret_jwt_key_2026`). These will be addressed in **P0-04 (Configuration Hardening & Secret Fail-Fast)**.
- Next immediate Phase 0 ticket: **P0-03 (Process-Role Isolation: Decoupling Queue Workers & Crons)**.
