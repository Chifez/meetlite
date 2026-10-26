# E2E-03: Reconnect, Single Seat Preservation, and Clean Leave Journey

> **Audit update:** the test now queries Mediasoup's authoritative participant
> state before and after reload, asserts one unique logical participant, and
> verifies the room is removed after explicit leave. The earlier URL-only run
> below is retained as historical evidence.

- Phase / track: Phase P2 — Protected Browser Product Flows
- Invariant: A page reload inside `/room/:roomId` cleanly re-establishes socket and media connections without duplicate seat consumption or orphaned producer/consumer state, and explicit Leave returns user to `/dashboard` releasing all media tracks.
- Scope: `e2e/e2e-03-reconnect-seat.spec.ts`, `client/src/pages/room.tsx`, `client/src/hooks/use-socket-setup.tsx`.
- Forbidden scope: No simulated fake reload; real `page.reload()` in Playwright.
- Dependencies: Mediasoup service, Room service, OrbStack Docker Compose stack.
- Risk classification: medium
- Rollback / kill switch: Revert `e2e/e2e-03-reconnect-seat.spec.ts`.
- Baseline commit and environment: Commit `d165212`, Node `v24.21.0`, macOS Darwin 25.1.0 arm64.

## Red evidence

Prior to this implementation:

1. Reloading the room caused duplicate socket connection instances or redirected to `/dashboard` before room metadata could be re-fetched.
2. Missing leave button strict locator:
   `getByTitle(/leave/i)` resolved to 2 elements, causing strict mode locator failure.

## Green evidence

With idempotent socket reconnect logic and `page.getByRole('button', { name: 'Leave' }).first()`:

```text
> meetlite@1.0.0 test:e2e
> npx playwright test e2e/e2e-03-reconnect-seat.spec.ts

Running 1 test using 1 worker

     1 …ney › browser reload reconnects to room without duplicating logical seat
  ✓  1 …rowser reload reconnects to room without duplicating logical seat (2.0s)

  1 passed (2.9s)
```

## Seeded regression verification

1. Seeded failed leave navigation:
   Simulated blocking of `navigate('/dashboard')` on leave causes `expect(page).toHaveURL(/\/dashboard/)` to fail with timeout.
