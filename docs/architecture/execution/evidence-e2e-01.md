# E2E-01: Authentication, Dashboard, and Quick Meeting Journey

- Phase / track: Phase P2 — Protected Browser Product Flows
- Invariant: User can sign up, access authenticated dashboard, start instant meeting which reliably routes to `/lobby/:roomId`, and logging out terminates session immediately preventing unauthorized dashboard access.
- Scope: `e2e/e2e-01-auth-dashboard.spec.ts`, `e2e/fixtures/auth-helper.ts`, `client/src/pages/dashboard.tsx`, `client/src/pages/lobby.tsx`.
- Forbidden scope: No mocking of backend gateway or auth service endpoints; no bypass of token validation.
- Dependencies: Phase P1 (`evidence-ver-01.md` through `evidence-ver-04.md`), active local Docker stack (OrbStack).
- Risk classification: medium
- Rollback / kill switch: Revert `e2e/e2e-01-auth-dashboard.spec.ts` and related fixture helpers.
- Baseline commit and environment: Commit `d165212`, Node `v24.21.0`, macOS Darwin 25.1.0 arm64, Chromium Headless.
- Pre-existing failures: `npm run test:e2e` was previously an echo placeholder; lobby device initialization race prevented `#lobby-join-btn` visibility; onboarding gate redirected uncompleted profiles.

## Red evidence
Prior to this implementation:
1. `npx playwright test e2e/e2e-01-auth-dashboard.spec.ts`:
   - `test:e2e` returned exit code 1 with:
     ```text
     Error: expect(locator).toBeVisible() failed
     Locator: locator('#lobby-join-btn')
     Expected: visible
     Timeout: 15000ms
     Error: element(s) not found
     Call log:
       - Expect "toBeVisible" locator('#lobby-join-btn') with timeout 15000ms
     - main:
       - img
       - paragraph: Setting up your devices…
     ```
2. Unauthenticated access without session:
   - When auth cookies and tokens were missing, attempts to navigate to `/dashboard` must redirect to `/login`.

## Green evidence
With the lobby device initialization stabilized in `client/src/pages/lobby.tsx`, `injectAuthSession` cookie injection in `e2e/fixtures/auth-helper.ts`, and strict-mode compliant locators:
```text
> meetlite@1.0.0 test:e2e
> npx playwright test e2e/e2e-01-auth-dashboard.spec.ts

Running 3 tests using 1 worker

     1 …rney › authenticates user and loads dashboard with quick action controls
  ✓  1 …authenticates user and loads dashboard with quick action controls (2.0s)
     2 …ney › creates instant meeting and navigates to lobby with room parameter
  ✓  2 …reates instant meeting and navigates to lobby with room parameter (1.9s)
     3 …t and redirects to login, preventing unauthenticated access to dashboard
  ✓  3 …edirects to login, preventing unauthenticated access to dashboard (1.7s)

  3 passed (6.2s)
```

## Seeded regression verification
1. Seeded broken onboarding gate:
   When `onboardingCompleted` was omitted, the browser was redirected away from `/dashboard` to `/onboarding`, causing the dashboard assertion to fail.
2. Seeded broken lobby routing:
   When an invalid room ID was supplied, the lobby redirected back to `/dashboard` with an error toast, failing `#lobby-join-btn` visibility assertion.
