# E2E-02: Lobby Preview and Two-Party Media Join Journey

> **Audit update:** the browser test now requires a live lobby video track and
> a live remote video track in both independent contexts. This stronger check
> exposed RTC-port exhaustion caused by cleanup on Socket.IO `disconnect`; the
> service now cleans rooms/transports during `disconnecting`.

- Phase / track: Phase P2 — Protected Browser Product Flows
- Invariant: User loads camera/mic preview in lobby, clicks Join, transitions cleanly into `/room/:roomId` without false redirect back to `/dashboard`, and two independent browser contexts joining the same room establish real WebRTC/SFU connections with participant count updating to 2.
- Scope: `e2e/e2e-02-lobby-media.spec.ts`, `client/src/pages/lobby.tsx`, `client/src/pages/room.tsx`, `client/src/hooks/use-media-setup.tsx`.
- Forbidden scope: No mock peer connections; real Chromium instances with synthetic fake media streams (`--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream`).
- Dependencies: Mediasoup service running on port 3003, API Gateway on port 3000, Client on port 5175.
- Risk classification: high
- Rollback / kill switch: Revert `e2e/e2e-02-lobby-media.spec.ts` and client lobby changes.
- Baseline commit and environment: Commit `d165212`, Node `v24.21.0`, macOS Darwin 25.1.0 arm64.
- Pre-existing failures: User was getting prematurely redirected back to `/dashboard` upon clicking join due to race conditions during socket negotiation and authorization checks.

## Red evidence

Prior to this implementation:

1. False redirect on join:
   When user clicked `#lobby-join-btn`, room authentication socket handshake failed or unmounted prematurely, navigating back to `/dashboard`.
2. Strict mode / hidden element failure:
   `getByText(/2/)` resolved to 4 elements (including participant email strings containing "2") and the mobile participant counter (`md:hidden`), failing `toBeVisible()`.

## Green evidence

With the lobby lifecycle stabilized and specific visible participant count filtering:

```text
> meetlite@1.0.0 test:e2e
> npx playwright test e2e/e2e-02-lobby-media.spec.ts

Running 2 tests using 1 worker

     1 …es camera preview in lobby and joins meeting room without false redirect
  ✓  1 …ra preview in lobby and joins meeting room without false redirect (1.8s)
     2 …two independent participants join the same room and exchange media state
  ✓  2 …ependent participants join the same room and exchange media state (4.7s)

  2 passed (7.1s)
```

## Seeded regression verification

1. Seeded unauthenticated join:
   When a user joined an unauthorized room or expired session, the room caught HTTP 403 and redirected back to `/dashboard`, failing the invariant `expect(page).not.toHaveURL(/\/dashboard/)`.
2. Seeded single participant:
   When participant B failed to connect, participant counter remained at 1, timing out the assertion `expect(pageA.getByText('2', ...)).toBeVisible()`.
