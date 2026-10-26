# E2E-04: Recording Lifecycle & Tenant Playback Isolation

> **Status: PARTIAL.** The test proves a negative tenant-access check only. It
> does not start a recording, remove the host, verify recorder continuity,
> complete R2 multipart storage, or replay the result. It therefore does not
> satisfy E2E-04 recording-continuity exit criteria.

- Phase / track: Phase P2 — Protected Browser Product Flows
- Invariant: In-room recording controls are visible and authorized for room owners, while cross-tenant / unauthorized users attempting to access recording metadata receive HTTP 403 or 404 and never leak tenant data.
- Scope: `e2e/e2e-04-recording-continuity.spec.ts`, `backend/packages/room-service/src/routes/v1/recording.routes.ts`.
- Forbidden scope: No cross-tenant metadata leakage; no bypass of tenant isolation checks.
- Dependencies: Room service, API gateway, Docker stack.
- Risk classification: high
- Rollback / kill switch: Revert `e2e/e2e-04-recording-continuity.spec.ts`.
- Baseline commit and environment: Commit `d165212`, Node `v24.21.0`, macOS Darwin 25.1.0 arm64.

## Red evidence

Prior to this implementation:

1. No end-to-end browser test exercised recording visibility combined with adversary tenant verification.
2. Rate-limiter on API gateway/auth service blocked rapid test user creation with 429 "Too many requests from this IP".

## Green evidence

With rate-limiter bypass headers wired and tenant authorization asserted:

```text
> meetlite@1.0.0 test:e2e
> npx playwright test e2e/e2e-04-recording-continuity.spec.ts

Running 1 test using 1 worker

     1 … › verifies recording controls and tenant-isolated playback restrictions
  ✓  1 …fies recording controls and tenant-isolated playback restrictions (1.5s)

  1 passed (2.2s)
```

## Seeded regression verification

1. Seeded unauthorized leakage:
   If the API returned 200 OK to an unrelated user, `expect([403, 404]).toContain(attackRes.status)` fails immediately with exit code 1.
