# MeetLite Ownership & Environment Topology Contract

**Status:** Approved Operational Contract (`GOV-02`)  
**Target Milestone:** Phase P0 through Launch  
**Governing Documents:** [MeetLite Agent Execution Plan](../meetlite-agent-execution-plan.md), [Execution Standard](README.md), [Agent Change Verifier](../agent-change-verifier.md)

---

## 1. Workstream Ownership & Review Matrix

To prevent unreviewed security, architectural, or performance drift, every repository component has an assigned domain owner and designated reviewer:

| Workstream | Scope / Paths | Domain Owner | Designated Reviewer | Required Review Gates |
| :--- | :--- | :--- | :--- | :--- |
| **Control Plane & Ingress** | `backend/packages/api-gateway/`, `backend/packages/auth-service/`, security middleware | Platform Lead (`emmanuel`) | Security Reviewer | Header stripping, verified principals, rate limits, token lifecycle |
| **Realtime Signalling & SFU** | `backend/packages/mediasoup-service/`, `backend/packages/edge-room-coordinator/`, `client/src/hooks/use-media*` | Realtime Lead (`emmanuel`) | Media Systems Reviewer | Reconnects, zero duplicate seats, SFU transport queues, rollback safety |
| **Room Core & Persistence** | `backend/packages/room-service/`, `backend/packages/shared/prisma/`, migrations | Backend Lead (`emmanuel`) | Database Administrator | Tenant isolation, zero cross-tenant leaks, idempotent mutations |
| **Web Frontend & UI Polish** | `client/src/`, responsive layouts, theme tokens, lobby/room UX | Frontend Lead (`emmanuel`) | Design Systems Reviewer | No fake features, strict accessible fallbacks, memory leak checks |
| **Storage & Recordings** | `Cloudflare R2`, S1-02 presigned multipart pipeline, recorder participant | Storage Lead (`emmanuel`) | Security & Compliance Reviewer | Presigned token expiration, tenant prefix enforcement, $0.15/hr cap |
| **Verification & CI Quality** | `tools/verifier/`, `.github/workflows/`, `k6/`, benchmark harness | Quality Lead (`emmanuel`) | CI/CD Administrator | Protected policy, zero-test detection, immutable commit binding |

---

## 2. Environment Topologies & Purposes

| Environment | Host / Execution Surface | Media Engine | External Integrations | Purpose & Testing Constraints |
| :--- | :--- | :--- | :--- | :--- |
| **Local Development** | Developer workstation (OrbStack / Docker Desktop) | `mediasoup` (RTC `10000-10100`) | Mock OAuth, FakeObjectStorage, local Redis & Postgres | Fast feedback, unit tests, local browser smoke. Mocks cannot certify managed edge. |
| **CI Automation** | GitHub Actions clean-checkout runner | Synthetic headless test harness | In-memory Redis & Postgres; ephemeral containers | Deterministic unit, contract, static, and package verification. Secret exposure forbidden. |
| **Staging Canary** | Cloudflare Tunnel + Dedicated staging cluster | Dual Engine: Mediasoup (Control) & Cloudflare Calls (Canary) | Real Cloudflare Calls, Cloudflare R2, Google Calendar Sandbox | Production-parity certification, real protocol benchmarks, soak tests, canary verification. |
| **Production** | Geo-distributed edge + high-availability cluster | Cloudflare Calls (Primary), Mediasoup (Failover Rollback) | Production Stripe, Cloudflare Calls, Cloudflare R2 | Customer traffic. Automated agent direct modification strictly prohibited. |

---

## 3. Credential Authority & Least-Privilege Policy

1. **Zero Client Secrets**: No API keys, JWT secrets, database connection strings, or cloud access tokens may be baked into client bundles, passed as Docker client build arguments, or committed to git.
2. **Server-Side Ingress Isolation**: All credentials stay inside container environment variables or server process runtime contexts.
3. **Short-Lived Ephemeral Tokens**: Room capability tokens use asymmetric Ed25519 signing with a maximum 10-minute lifetime. Access tokens are capped at 15 minutes with rotating refresh tokens.
4. **CI Fork Isolation**: Workflows triggered by external forks execute with zero read access to staging or production secrets.

---

## 4. Protected Paths & Policy Invariants

Changes touching the following critical paths strictly require domain owner approval before merge:

- `backend/packages/shared/prisma/schema.prisma` & migrations (data preservation and expand/contract safety).
- `backend/packages/shared/src/auth/` & `capability-token.ts` (identity assertion & room authority).
- `.github/workflows/` & `.github/CODEOWNERS` (CI verifier pipeline protection).
- `docs/performance/capacity-contract.md` (SLO and capacity budget preservation).
- `tools/verifier/` (grading engine integrity).
