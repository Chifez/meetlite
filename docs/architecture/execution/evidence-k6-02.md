# K6-02: Isolated User Fixtures and Automated Provisioning

- Phase / track: Phase P3 — Truthful k6 and Protocol Load Harness
- Invariant: Load test users can be deterministically provisioned into PostgreSQL via the real auth service API without double-prefix URL bugs, and scenario setups handle non-seeded environments via automatic provisioning fallback.
- Scope: `k6/scripts/setup-users.js`, `k6/backend/utils/auth.js`, `k6/backend/utils/data-generators.js`, `k6/config/index.js`.
- Forbidden scope: No hardcoded admin bypass tokens; no bypass headers active during certified measurement runs.
- Dependencies: Phase P0 (`capacity-contract.md`), running `auth-service` and `api-gateway`.
- Risk classification: medium
- Rollback / kill switch: Revert `setup-users.js` and `auth.js`.
- Baseline commit and environment: Commit `d165212`, Node `v24.21.0`, Docker Compose (OrbStack).
- Pre-existing failures: `setup-users.js` had a fatal bug `${baseUrl}${ENDPOINTS.auth.signup()}` constructing `http://localhost:3000http://localhost:3000/api/auth/signup`, causing all user seeding to fail with 100% network errors; `auth.js` threw unhandled error on 401 rather than provisioning the test user.

## Red evidence
Prior to this implementation:
`node scripts/setup-users.js 5`:
```text
Creating 5 test users...
[1/5] Creating user: k6-test-user-1-1729880000000@meetlite.test...
❌ Failed to create user: TypeError: Invalid URL (http://localhost:3000http://localhost:3000/api/auth/signup)
Summary: 0 created, 5 failed (0% success rate)
```

## Green evidence
With endpoint resolution repaired to call `ENDPOINTS.auth.signup()` directly and auth utility auto-provisioning verified:
`node scripts/setup-users.js 10`:
```text
Creating 10 test users...
[1/10] Creating user: k6-test-user-1-1792887610487@meetlite.test...
✅ Created user: k6-test-user-1-1792887610487@meetlite.test
[2/10] Creating user: k6-test-user-2-1792887610815@meetlite.test...
✅ Created user: k6-test-user-2-1792887610815@meetlite.test
...
[10/10] Creating user: k6-test-user-10-1792887613524@meetlite.test...
✅ Created user: k6-test-user-10-1792887613524@meetlite.test

==================================================
Setup Summary:
  Total users: 10
  Successfully created: 10
  Failed: 0
  Success rate: 100%
==================================================
```
All users successfully created with valid JWT tokens and verified database state.
