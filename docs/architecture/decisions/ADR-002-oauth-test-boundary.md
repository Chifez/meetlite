# ADR-002: Calendar OAuth State Binding & Test Boundary

- **Status**: **Accepted** (`GOV-03`)
- **Date**: 2026-10-25
- **Deciders**: MeetLite Core Engineering Team
- **Target Milestones**: Phase P0, Phase P5 (`CAL-SEC-01`, `CAL-05`)
- **Governing Standard**: [MeetLite Agent Execution Plan](../meetlite-agent-execution-plan.md)

---

## 1. Context and Problem Statement

MeetLite allows organizers to link Google Calendar accounts to sync availability and schedule meetings. The legacy calendar integration suffered from two critical architectural risks:

1. **Security Vulnerability**: The OAuth authorization URL generation lacked a cryptographically bound, one-time state parameter. The callback endpoint accepted caller-provided user context, which could allow CSRF state injection or association of an OAuth token with an arbitrary user account.
2. **Testing Hazard**: Tests previously attempted to reach real Google OAuth endpoints or assumed personal Google developer accounts, creating flakiness, secret leakage risks, and unrepeatable test runs.

---

## 2. Decision & Architecture Invariants

### 2.1 Cryptographically Bound One-Time State (`CAL-SEC-01`)
- When initiating calendar connection (`GET /api/calendar/auth-url`), the server generates an opaque, signed, expiring JWT state token.
- The state payload strictly binds:
  - `userId`: Verified principal initiating the flow.
  - `provider`: `google` | `microsoft`.
  - `redirectUrl`: Validated frontend return path.
  - `nonce`: Cryptographically random UUID.
  - `exp`: 10-minute expiry timestamp.
- The state is signed with the server's private `JWT_SECRET`.
- Upon callback (`GET /api/calendar/callback`), the state is verified, the nonce is atomically marked consumed in Redis to prevent replay attacks, and the resulting OAuth tokens are stored in PostgreSQL encrypted with tenant-scoped keys.

### 2.2 Test Boundary & Provider Sandboxing (`CAL-05`)
- **Zero Real Google Accounts in CI / Local Tests**: Automated test suites are strictly forbidden from hitting live Google authorization endpoints or using personal developer credentials.
- **Dedicated Provider Test Fake (`FakeCalendarProvider`)**: In unit, integration, and E2E browser runs, OAuth exchanges and FreeBusy queries are serviced by a deterministic mock calendar server that validates state binding, produces predictable slot conflicts, and simulates provider failure modes.

---

## 3. Consequences & Rollback

- **Positive**: Eliminates CSRF and unauthorized account linking vulnerabilities; enables 100% deterministic, offline automated E2E testing of the scheduling pipeline.
- **Negative**: Requires maintaining the `FakeCalendarProvider` contract test harness to ensure continued parity with Google Calendar API v3 response schemas.
- **Rollback**: If OAuth state verification blocks valid user connections, disable the calendar feature flag (`FEATURE_GOOGLE_CALENDAR=false`) in the API Gateway while preserving core room operations.
