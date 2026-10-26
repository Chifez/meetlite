# K6-03: Authoritative Backend API Load Journeys

- Phase / track: Phase P3 — Truthful k6 and Protocol Load Harness
- Invariant: API load journeys for authentication, meeting lifecycles, room creation, and room stress match authoritative backend response envelopes (`ResponseHelpers` data wrappers) and assert real service outcomes.
- Scope: `k6/backend/scenarios/auth/load.js`, `k6/backend/scenarios/meetings/load.js`, `k6/backend/scenarios/rooms/load.js`, `k6/backend/scenarios/rooms/stress.js`.
- Forbidden scope: No mocking of gateway routing or database transactions; no weakening of assertions to ignore 500 status codes.
- Dependencies: Running `api-gateway`, `auth-service`, `room-service`, PostgreSQL, Redis.
- Risk classification: medium
- Rollback / kill switch: Revert scenario files.
- Baseline commit and environment: Commit `d165212`, Node `v24.21.0`, k6 v2.3.0, OrbStack containers.
- Pre-existing failures: `auth/load.js` had wrong response property check (`body.email` instead of `body.user.email`); `meetings/load.js` failed checks on `meeting.id` because room-service wraps records in `{ success: true, data: { id } }`; `rooms/load.js` checked top-level `roomId`; `rooms/stress.js` had undeclared variables and unhandled responses.

## Red evidence
Prior to this implementation:
1. `k6 run backend/scenarios/auth/load.js`:
   `✗ profile has user data` failed (0% pass) because `body.user.email` was not checked.
2. `k6 run backend/scenarios/meetings/load.js`:
   `✗ meeting created` failed check because `body.id` was undefined (`body.data.id` was present).
3. `k6 run backend/scenarios/rooms/stress.js`:
   Threw `ReferenceError: roomId is not defined` immediately on execution.

## Green evidence
With response envelopes normalized to support `{ data: { ... } }` and variables correctly initialized:
1. `backend/scenarios/auth/load.js`:
   - Checks: 252/252 passed (100.00%).
   - Thresholds: `auth_signup_success` 100%, `auth_login_success` 100%, `auth_profile_success` 100%, `auth_login_time` p95 = 398ms (<500ms).
2. `backend/scenarios/meetings/load.js`:
   - Checks: 1518/1518 passed (100.00%).
   - Thresholds: `meeting_lifecycle_success` 100%, `meeting_operation_success` 100%, `meeting_operation_time` p95 = 80.3ms (<1000ms).
3. `backend/scenarios/rooms/load.js`:
   - Checks: 3690/3690 passed (100.00%).
   - Thresholds: `room_operation_success` 100%, `room_create_time` p95 = 29ms (<1000ms), `room_join_time` p95 = 25ms (<1000ms).
4. `backend/scenarios/rooms/stress.js`:
   - Checks: 708/708 passed (100.00%).
   - Thresholds: `http_req_failed` 0.00% (<20%), `room_stress_success` 100% (>80%).
