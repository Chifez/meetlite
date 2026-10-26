# E2E-05: System Admin Authorization and Access Control

> **Status: PARTIAL.** Negative non-admin browser/API checks pass. No positive
> system-administrator browser journey currently proves the authorized admin
> surface and its measured data contract.

- Phase / track: Phase P2 — Protected Browser Product Flows
- Invariant: Non-admin users cannot access `/admin` in the browser (automatically redirected to `/dashboard`) and receive HTTP 403 Forbidden on administrative endpoints (`/api/admin/metrics`), preventing horizontal and vertical privilege escalation.
- Scope: `e2e/e2e-05-admin-authorization.spec.ts`, `client/src/components/protected-route.tsx`, `backend/packages/auth-service/src/routes/v1/admin.routes.ts`.
- Forbidden scope: No client-only guards; API gateway and backend service authorization must enforce 403.
- Dependencies: Auth service, API gateway, Client.
- Risk classification: high
- Rollback / kill switch: Revert `e2e/e2e-05-admin-authorization.spec.ts`.
- Baseline commit and environment: Commit `d165212`, Node `v24.21.0`, macOS Darwin 25.1.0 arm64.

## Red evidence

Prior to this implementation:

1. No automated Playwright E2E assertion tested non-admin UI access and API privilege boundaries together in the browser.
2. An attempt to navigate to `/admin` as a non-admin previously lacked a regression test ensuring `not.toHaveURL(/\/admin/)`.

## Green evidence

With protected route admin checks and API authorization:

```text
> meetlite@1.0.0 test:e2e
> npx playwright test e2e/e2e-05-admin-authorization.spec.ts

Running 2 tests using 1 worker

     1 …enies non-admin browser navigation to /admin and redirects to /dashboard
  ✓  1 …on-admin browser navigation to /admin and redirects to /dashboard (1.6s)
     2 …l › denies non-admin API access to /api/admin/metrics with 403 Forbidden
  ✓  2 …es non-admin API access to /api/admin/metrics with 403 Forbidden (137ms)

  2 passed (2.1s)
```

## Seeded regression verification

1. Seeded elevation vulnerability:
   If `/api/admin/metrics` returned HTTP 200 to an ordinary non-admin JWT, `expect(res.status).toBe(403)` fails immediately with exit code 1.
