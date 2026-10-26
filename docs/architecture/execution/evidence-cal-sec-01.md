# CAL-SEC-01: Opaque Signed One-Time OAuth State Contract

- Phase / track: Phase P5 — Security, Calendar, and Scheduling Closure
- Invariant: Calendar OAuth authorization flow issues opaque, HMAC-SHA256 signed, expiring (10-minute), one-time states bound to the verified initiating user ID; callback consumes the nonce atomically, preventing account hijacking, CSRF, and state replay attacks.
- Scope: `backend/packages/room-service/src/services/calendar-oauth-state.service.ts`, `backend/packages/room-service/src/controllers/calendar.controller.ts`, `backend/packages/room-service/src/services/calendar-security.test.ts`.
- Forbidden scope: No caller-supplied user identifiers; no unsigned plaintext JSON state; no reusable OAuth state parameters.
- Dependencies: Phase P1 verifier, Phase P2 auth journeys.
- Risk classification: high
- Rollback / kill switch: Revert `calendar-oauth-state.service.ts` and controller modifications.
- Baseline commit and environment: Commit `d165212`, Node `v24.21.0`, OrbStack Redis & PostgreSQL.
- Pre-existing failures: `connectGoogleCalendar` used plaintext JSON URL-encoded state without cryptographic signature; `handleGoogleCallback` blindly parsed `stateData.userId` from the query string without validating that the callback came from the user who initiated it, allowing arbitrary account token association.

## Red evidence
Prior to this implementation:
1. `connectGoogleCalendar` emitted:
   `state = encodeURIComponent(JSON.stringify({ userId, email }))`
2. Anyone intercepting or generating a callback could pass:
   `state = encodeURIComponent(JSON.stringify({ userId: 'victim-uuid' }))`
   resulting in caller-supplied user identity binding and cross-user token hijacking.
3. State lacked nonce and expiration, allowing indefinite replay.

## Green evidence
With `calendar-oauth-state.service.ts` implemented:
```text
▶ CAL-SEC-01: Calendar OAuth State Security & Invariants
  ✔ generates a signed, opaque, base64url state string with 2 segments (3.2ms)
  ✔ successfully verifies and consumes valid OAuth state (0.9ms)
  ✔ denies replay attacks: a consumed state cannot be reused (1.2ms)
  ✔ rejects tampered signature (0.8ms)
  ✔ rejects tampered payload modifying userId (cross-user injection) (0.9ms)
  ✔ rejects expired state (1.1ms)
  ✔ rejects malformed state inputs (0.6ms)
✔ CAL-SEC-01: Calendar OAuth State Security & Invariants (8.7ms)
```
All 7 adversarial security drills pass deterministically.
