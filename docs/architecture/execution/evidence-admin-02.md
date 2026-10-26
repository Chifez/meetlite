# ADMIN-02: Admin Authorization & Pagination Boundaries

- Phase / track: Phase P6 — Dashboard, Admin, Account, and Billing Completeness
- Invariant: System admin routes and backend administrative APIs enforce strict role-based access control, denying non-admin callers both in client routing and API gateway routing, while supporting bounded pagination on all list endpoints.
- Scope: `client/src/components/protected-route.tsx`, `backend/packages/auth-service/src/middleware/admin.middleware.ts`, `backend/packages/auth-service/src/controllers/admin.controller.ts`, `e2e/e2e-05-admin-authorization.spec.ts`.
- Forbidden scope: No client-only admin protection; no endpoints returning unbounded collections without `limit` and `page`.
- Dependencies: Phase P1 verifier, Phase P2 Playwright harness.
- Risk classification: high
- Rollback / kill switch: Revert route protections.
- Baseline commit and environment: Commit `d165212`, Node `v24.21.0`.
- Pre-existing failures: Admin routes were previously accessible without server-side verification in early prototypes.

## Red evidence
Prior to this implementation:
1. Navigating to `/admin` as a standard user permitted viewing layout before API failure.
2. Direct API calls to `/api/admin/users` without admin credentials leaked error stack traces rather than clean 403 Forbidden.

## Green evidence
With dual client and server authorization enforced:
1. E2E browser verification (`e2e/e2e-05-admin-authorization.spec.ts`):
   ```text
   Running 2 tests using 1 worker
   ✓ rejects non-admin user from accessing /admin routes and redirects to dashboard (1.4s)
   ✓ admits system admin to /admin dashboard and displays management metrics (1.5s)
   2 passed (3.2s)
   ```
2. API pagination contract:
   - `/api/admin/users`: Enforces `page` and `limit` (max 100).
   - `/api/admin/organizations`: Enforces `page` and `limit`.
   - `/api/admin/meetings`: Enforces `page` and `limit`.
   - `/api/admin/system/audit-logs`: Enforces `page` and `limit`.
3. Server-side middleware `requireAdmin` checks `req.user.isSystemAdmin === true` on every administrative route, returning 403 Forbidden to unauthorized callers.
