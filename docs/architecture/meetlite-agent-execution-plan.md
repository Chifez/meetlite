# MeetLite Agent Execution Plan

**Status:** agent-ready execution blueprint; phases remain gated by their entry criteria
**Prepared:** 2026-10-25
**Audience:** coding agents and human reviewers
**Governing documents:** [execution standard](execution/README.md), [product/performance roadmap](meetlite-product-and-performance-roadmap.md), [agent verifier](agent-change-verifier.md), [scaling track](execution/scaling-execution-plan.md), [refactoring track](execution/refactoring-execution-plan.md)

## How to use this plan

Execute phases in order. Tickets inside a phase may run in parallel only when their dependency column permits it. Do not start a later phase because an earlier phase is inconvenient or partially complete.

Every ticket must have one invariant, one owning module, one named reviewer, one immutable base commit, exact checks, rollback, and an evidence file. Every ticket runs Cages 0 through 7 from the execution standard; a cage may be marked not applicable only with a written reason.

The agent must:

1. inspect the current repository and record pre-existing failures;
2. write the change manifest before editing code;
3. create meaningful red evidence, or a characterization baseline for a mechanical refactor;
4. implement the smallest coherent slice through the owning seam;
5. run focused checks, adversarial checks, system checks, and the full applicable regression set;
6. report exact commands, results, artifacts, residual risk, and rollback;
7. stop immediately on a hard-stop condition.

The authoritative result is `PASS`, `FAIL`, `INCONCLUSIVE`, or `NOT_IMPLEMENTED`. A flaky retry, missing harness, infrastructure failure, or unmeasured capacity result is never a green pass.

## Mission and non-goals

This plan turns the completed audits into bounded implementation work. The intended result is:

1. a trustworthy verifier for human- and agent-authored changes;
2. measured—not estimated—control-plane, signalling, and media capacity;
3. complete, secure core meeting journeys with no misleading UI;
4. a staging-canary process that preserves Mediasoup as the rollback path while Cloudflare is proven;
5. differentiated product pilots only after the meeting core is reliable.

The following are not authorized by this plan:

- a production deployment or production load test without explicit human approval;
- a mass rename from `MeetLite` to `Korvia` or any other candidate before `BRAND-01` is approved;
- removal of Mediasoup, port `3003`, or the `VITE_MEDIA_ENGINE` rollback seam;
- destructive schema changes, production data mutation, or secret rotation;
- a claim of `200,000 CCU`, “production-ready,” “secure,” or “regression-free” without the required evidence;
- opportunistic cleanup outside the active ticket.

## Source-of-truth order

When documents or code appear to conflict, use this precedence and record the conflict in the evidence file:

1. current executable code, schemas, migrations, tests, and runtime configuration;
2. [execution standard](execution/README.md) for engineering and verification rules;
3. active scaling/refactoring phase gates;
4. this file for sequencing, scope, and defaults;
5. [product/performance roadmap](meetlite-product-and-performance-roadmap.md) for rationale;
6. research documents for market, naming, and verifier background.

Do not silently change a product decision merely because code and documentation disagree. Preserve current behavior, document the mismatch, and escalate only when resolving it changes user-visible behavior, authority, retained data, billing, or rollout risk.

## Research and audit context already established

Agents must read only the material relevant to the active ticket; they must not repeat the research as a substitute for implementation.

| Source | Established conclusion | How it constrains execution |
| --- | --- | --- |
| [Product/performance roadmap](meetlite-product-and-performance-roadmap.md) | Capacity is not currently certified; k6, dashboard/admin, calendar, and room paths have concrete gaps | Follow the priority order and do not publish a CCU number early |
| [Verifier research](../research/agent-verifier-loops-and-regression-gates-2026-10-25.md) | The eight cages are sound policy but not an independent executable verifier | P1 must precede autonomous merge or regression-free claims |
| [Agent verifier design](agent-change-verifier.md) | Required verdicts, trust boundary, flow set, performance budgets, and V0–V4 design are defined | Implement this contract; do not invent a competing verifier model |
| [Market differentiator research](../research/video-collaboration-market-differentiators-2026-10-25.md) | Calendar, recap, replay, accessibility, and collaboration opportunities exist, but foundations are incomplete | Treat P9 features as hypotheses, not committed backlog |
| [Name-risk research](../research/meetlite-name-trademark-risk-2026-10-25.md) | `MeetLite` has medium-high screening risk and low ownability; candidate names are not cleared | Keep current name until a human approves rename/clearance work |

## Current architecture the agent must preserve

### Runtime topology

| Component | Current responsibility | Local/Docker endpoint | Authority and constraints |
| --- | --- | --- | --- |
| React client | Dashboard, lobby, room, meetings, recordings, settings, admin | `http://localhost:5175` | Views dispatch intent; they must not own authorization, negotiation, or provider policy |
| API gateway | Public HTTP ingress, CORS, rate limiting, correlation, service routing, legacy WebSocket proxy | `http://localhost:3000` | Strip caller identity headers and propagate verified correlation/identity only |
| Auth service | Authentication, principals, organizations, plans, admin/account policy | host `5002`, container `5000` | PostgreSQL is the durable source; Redis supports sessions/jobs/cache |
| Room service | Meetings, admission/capabilities, calendar, recordings, analytics, notifications | host `5003`, container `5001` | Resource authorization belongs at the operation touching the resource |
| Mediasoup service | Legacy signalling/SFU, collaboration socket paths, local recording integration | `http://localhost:3003`; RTC `10000–10100` | Zero-regression rollback target; do not delete or bypass it |
| Edge room coordinator | Durable Object room lifecycle, Cloudflare Calls adapter, collaboration persistence, quotas/spend | `http://localhost:8787` locally | Local standalone mode/mocks do not certify Cloudflare-managed behavior |
| PostgreSQL | Durable users, organizations, meetings, plans, recordings, integrations | host `5433`, container `5432` | Schema changes use reviewed migrations and expand/migrate/contract |
| Redis | Cache, queues, ephemeral coordination | host `6380`, container `6379` | Do not use unbounded `KEYS` invalidation or treat cache as durable truth |
| Cloudflare Tunnel/Calls/R2 | Staging edge ingress, managed media, object storage | credentialed staging only | Secrets stay server-side; live behavior requires staging evidence |

### Critical control and media paths

```text
Browser HTTP → API gateway :3000 → auth-service / room-service

Legacy room media:
Browser lobby → /room/:roomId → MediaEndpoint(mediasoup)
  → Socket.IO / Mediasoup :3003 → UDP/TCP RTC ports

Cloudflare canary room media:
Browser lobby → room admission + capability token
  → MediaEndpoint(cloudflare) → edge coordinator WebSocket
  → Durable Object → Cloudflare Calls publisher/subscriber sessions

Durable collaboration:
room UI → collaboration seam → Durable Object memory batching
  → SQLite deltas/snapshots; awareness remains memory-only
```

The current engine choice is the build-time `VITE_MEDIA_ENGINE`; Docker defaults it to `mediasoup`. `client/src/hooks/use-media-endpoint.ts` and `client/src/lib/media-endpoint/` own provider selection. `client/src/pages/room.tsx` may coordinate UI state but must not absorb provider negotiation. A build-time flag alone does not prove stable per-room canary assignment; P7/P8 must either document whole-build cohorts or add a typed, server-authoritative assignment seam before claiming a percentage rollout.

### Security and state invariants already implemented or required

- Verified identity comes from gateway/service authentication, never public `x-user-id`, `x-user-role`, `x-org-id`, request bodies, query parameters, or socket messages.
- Room capability tokens remain asymmetric, room-scoped, short-lived, and replay-protected.
- Internal request assertions remain bound to uppercase method, normalized path, audience, correlation/request ID, expiry, and key ID.
- Tenant-owned queries derive tenant scope from the verified principal.
- A reconnecting participant must not consume a second seat.
- Room generations supersede stale sessions without deleting durable room state.
- Each SFU session has one mutation queue; overlapping negotiation is forbidden.
- Mediasoup and Cloudflare are separate sessions/rooms; an active call is never migrated between providers.
- Durable collaboration updates may be persisted; ephemeral cursor/awareness data must never be persisted.
- Recording completion, multipart cleanup, authorization, and host-departure continuity are server responsibilities.
- Secrets and sensitive payloads must not enter browser bundles, Docker build arguments, logs, traces, or evidence files.

## Known baseline gaps: do not rediscover or reinterpret

| Area | Confirmed gap | Evidence locations | Required phase |
| --- | --- | --- | --- |
| Root verification | `format:check`, `test:integration`, `test:contracts`, and `test:e2e` are successful `echo` placeholders | root `package.json` | P1 |
| CI trust | No checked-in protected CI workflow currently enforces the verifier | `.github/workflows` absent at audit time | P1 |
| Browser E2E | No real root flow launches the stack and verifies auth, lobby, media, recording, calendar, or admin | root `package.json`; verifier research | P2 |
| k6 | Stale paths, broken validation, misspelled thresholds, bad room variables, shared token, URL construction bug, and pseudo-WebSocket semantics | `k6/README.md`, `k6/run-tests.js`, `k6/scripts/setup-users.js`, `k6/backend/utils/websocket-client.js`, scenario/config files | P3 |
| Calendar security | Public OAuth flow lacks trusted one-time state binding; callback context can select the target user | `backend/packages/room-service/src/routes/v1/calendar.routes.ts`, `controllers/calendar.controller.ts` | P5 |
| Calendar correctness | Export uses sample/hard-coded event behavior; sync/availability lacks FreeBusy, incremental sync, and push reconciliation | calendar controller/services; `client/src/contexts/calendar-context.tsx` | P5 |
| Cache scaling | Calendar invalidation uses broad Redis key scanning | `backend/packages/room-service/src/services/calendar-cache.service.ts` | P5 |
| Misleading UI | Analytics and Organization Hub routes render `ComingSoon` | `client/src/App.tsx` | P6 |
| Admin truth | System/log and health surfaces include hard-coded rather than measured data | `client/src/pages/admin/system.tsx`; auth admin controller/service | P6 |
| Account/product closure | Account deletion and several recording/team/export actions are unfinished | `client/src/components/settings/profile-danger-zone.tsx`, recording/team hooks/components | P6 |
| Room quality | Connection quality, device capability, and user preference are hard-coded | `responsive-video-grid.tsx`, `shared-presentation.tsx` | P7 |
| Dual lifecycle risk | Cloudflare media coexists with legacy Socket.IO/Yjs plumbing in the room page | `client/src/pages/room.tsx`, room hooks, media endpoint adapters | P7 |
| Managed-edge proof | Local edge mode uses in-memory/mock components and cannot prove Calls, Durable Object eviction, Tunnel, or R2 | edge coordinator adapters/tests; Docker local mode | P7/P8 |

If a listed gap has already been fixed when a ticket starts, the agent must prove that with code and tests, update the baseline, and close or narrow the ticket. It must not reimplement the same behavior.

## Decisions and defaults: when the agent may proceed

Use these defaults unless a named human decision says otherwise:

- Preserve current branding in code. Brand candidates are research-only.
- Use `http://localhost:5175` as the canonical local client origin and keep explicitly supported compatibility origins documented rather than scattered.
- Keep `mediasoup` as the local/default media engine and Cloudflare as a credentialed staging canary.
- Hide an incomplete production action when a full backend implementation is outside the active ticket; do not fabricate data or success.
- Use fake/provider-sandbox boundaries for OAuth tests; never automate against a personal Google account.
- Use disposable local/staging tenants and synthetic media for tests; never copy production data into fixtures.
- Treat correctness, security, tenant isolation, recording integrity, and data loss as zero-tolerance.
- Treat performance thresholds in the verifier design as provisional until at least five comparable clean-baseline runs calibrate them.

The agent must stop and request a human decision for: production/staging credentials, paid-provider spending, public rename, legal clearance, billing semantics, deletion/retention policy, recording/AI consent, production rollout, or any destructive migration.

## Ticket packet required before editing

For every ticket, create `docs/architecture/execution/evidence-<ticket-lowercase>.md` from the execution-standard template and add:

```text
Problem evidence: exact current code/test/runtime behavior
Owning interface: public seam callers already use
Trusted principal/tenant source: or N/A with reason
System of record: PostgreSQL | DO SQLite | R2 | Redis-ephemeral | browser-local
Ordering/retry/idempotency: explicit contract
Files allowed to change: narrow list
Files forbidden to change: narrow list
Consumers that must remain compatible: list
Fail-to-pass check: exact command and expected reason
Pass-to-pass checks: exact commands
Rollback/kill switch: executable method
```

One ticket is one independently reviewable tracer bullet. Do not combine verifier infrastructure, calendar security, admin completion, room refactoring, and rebranding in one change.

## Current command contract

Run from the repository root unless a ticket says otherwise:

```bash
git status --short
git diff --check
npm run lint
npm run typecheck:all
npm run test:unit
npm run test --workspace=client
```

At the start of this plan, `format:check`, `test:integration`, `test:contracts`, and `test:e2e` are placeholders. Record them as `NOT_IMPLEMENTED` until P1 replaces them. Do not cite their zero exit code as evidence. Cloudflare, OAuth-provider, real-media, spike, soak, and canary checks are staging gates, not ordinary local checks.

## Dependency order

```text
P0 decisions and baseline
        │
        └── P1 truthful verifier and CI foundation
                ├── P2 real critical browser flows ──┐
                ├── P3 truthful k6/load harness ─────┴── P4 capacity measurement
                ├── P5 security/calendar and scheduling closure
                ├── P6 dashboard/admin and account completeness
                └── P7 room/media/recording/collaboration hardening
                              P4 + applicable P5–P7 completion
                                             │
                                             └── P8 staging certification and canary
                                                          │
                                                          └── P9 differentiated product pilots
```

P5–P7 may proceed after P1, but each must use the critical flows from P2 where applicable. P8 cannot begin until P2, P3, and the relevant P5–P7 work is complete.

## Phase P0 — decisions, evidence boundary, and baseline

**Goal:** make the work safe to execute and establish a reproducible baseline.

**Tickets:** `GOV-01` capacity contract; `GOV-02` CI/Code Owners decision; `GOV-03` browser and OAuth test boundary; `GOV-04` recording/AI privacy policy; `GOV-05` incomplete-UI policy; `BRAND-01` rename-or-clearance decision.

**Read first:** this plan through P1; `meetlite-product-and-performance-roadmap.md`; `agent-change-verifier.md`; `docker-compose.yml`; root/client/backend/k6 package manifests; name-risk report for `BRAND-01` only.

**Actions:**

- Assign a human owner and reviewer for each workstream.
- Choose local, CI, and staging environments and record versions, service images, regions, and credentials policy.
- Define control-plane, signalling, and media workloads; SLOs; cost ceilings; sample sizes; abort conditions; and retention rules.
- Decide whether incomplete dashboard/admin actions are hidden or explicitly labelled preview functionality.
- Decide whether `MeetLite` is held behind counsel-led clearance or replaced with a cleared distinctive name before public launch.
- Record root baseline failures, including placeholder verification scripts and stale k6 commands.

**Required outputs:**

- `docs/performance/capacity-contract.md`: workload personas, room sizes, media profiles, regions, SLOs, cost/abort limits, test-data policy, and result schema.
- `docs/architecture/execution/ownership-and-environments.md`: owners, reviewers, environment purposes, credential authority, and protected paths.
- `docs/architecture/decisions/` records for OAuth boundary, incomplete UI, recording/AI consent/retention, and branding. If the directory convention does not exist, establish it in a documentation-only ticket.
- A baseline evidence record containing current commit, dirty files, tool versions, exact command results, placeholder commands, and known failures.

An agent may draft these decisions and identify missing inputs. It may not invent the legal, privacy, billing, production-credential, or spend decision and mark it approved.

**Exit evidence:** approved capacity contract, decision record, owner matrix, baseline manifest, and a ticket/evidence record for every following phase.

**Hard stops:** no owner; no rollback; production credentials in test scope; ambiguous tenant/consent policy; or a capacity claim based only on local Docker.

## Phase P1 — truthful verifier and CI foundation

**Goal:** prevent an agent change from passing through missing, weakened, or fake checks.

**Dependencies:** P0.

**Tickets:** `VER-01` truthful commands; `VER-02` verifier CLI; `VER-03` evidence schema; `VER-04` CI and protected ownership.

**Primary code map:** root `package.json`; every workspace `package.json`; `tools/verifier/` to be introduced; `verification/` policy/waiver data to be introduced; `.github/workflows/`; `.github/CODEOWNERS`; `docs/architecture/agent-change-verifier.md`. Do not change product behavior in this phase.

**Ticket order and boundaries:**

| Ticket | Deliverable | Must not include | Done when |
| --- | --- | --- | --- |
| `VER-01` | Real formatter/integration/contract command wiring; explicit `NOT_IMPLEMENTED` for absent E2E until P2 | New product tests disguised as command wiring | Each required command discovers intended checks and seeded failure returns non-zero |
| `VER-02` | `plan`, baseline resolution, risk/path selection, command runner, timeout/zero-test handling | GitHub policy or browser journeys | Deterministic fixture repositories prove every verdict/check state |
| `VER-03` | Versioned schemas and generated JSON/Markdown evidence bound to SHAs/artifact digests | Hand-authored pass status | Malformed, incomplete, dirty, or mismatched evidence fails closed |
| `VER-04` | Protected CI, Code Owners, least privilege, immutable action references, artifact retention | Production secrets or privileged fork execution | A candidate cannot weaken its own mandatory policy/status source |

**Implementation:**

- Replace root echo-only `format:check`, integration, contract, and E2E scripts with real commands, or fail explicitly as `NOT_IMPLEMENTED`.
- Add clean-checkout execution, zero-test detection, timeout handling, structured JSON/JUnit output, and base/head SHA binding.
- Add changed-scope risk levels and protected policy files.
- Add `CODEOWNERS`, required status checks, pinned actions, least-privilege permissions, and ephemeral workers.
- Ensure candidate code cannot change the policy that grades the same run.

**Required seeded failures:** deleted test, skipped suite, zero-test run, weakened threshold, malformed report, timeout, changed verifier policy, and placeholder command.

**Exit evidence:** known-good fixture passes; every seeded regression fails; verifier policy changes require human review; reports are schema-valid and commit-bound.

**Hard stops:** successful command with no discovered tests; candidate-controlled required status; production secret exposure; or a verifier result with no immutable base/head.

## Phase P2 — protected browser product flows

**Goal:** prove the critical user journey in real browsers and authoritative backend state.

**Dependencies:** P1.

**Tickets:** `E2E-01` auth/dashboard/quick meeting; `E2E-02` lobby and two-party media; `E2E-03` reconnect/seat cleanup; `E2E-04` recording continuity; `E2E-05` admin authorization.

**Primary code map:** `client/src/App.tsx`; auth/public/protected route components; `client/src/pages/dashboard.tsx`, `lobby.tsx`, `room.tsx`; `client/src/hooks/use-media-endpoint.ts`; `client/src/lib/media-endpoint/`; gateway routing/CORS; room admission/capability services; Mediasoup socket/media services; edge coordinator server/room coordinator; recording services. Put browser tests and fixture adapters in one documented E2E root selected during P0.

**Canonical journey state:** authenticated dashboard → create/start quick meeting → `/lobby/:roomId` with local preview → `/room/:roomId` → local publish → second independent participant subscribes → reconnect preserves one logical seat → leave releases browser/media/socket state → dashboard. Redirecting to the dashboard before an explicit leave or unrecoverable, user-visible admission failure is a regression.

**Test identities:** at minimum, organizer, same-tenant participant, different-tenant user, and system administrator. Each test gets unique organization, meeting, room, storage prefix, and browser context. Cleanup is part of the assertion.

**Protected journeys:** signup/login/logout; dashboard and quick meeting; lobby device preview; join/publish/subscribe; reconnect without duplicate seat; leave cleanup; host departure; recording completion and authorized replay; cross-tenant denial; admin access control.

**Implementation rules:**

- Use isolated users, organizations, rooms, storage prefixes, and browser contexts.
- Assert browser-visible state plus API/database/storage/socket outcomes.
- Run Mediasoup and Cloudflare media adapters separately; mocks cannot certify deployed media.
- Preserve console errors, failed requests, traces, screenshots, video, and correlated service logs.

**Exit evidence:** deliberate breaks in routing, CORS, auth, room admission, media join, seat accounting, and recording continuity each fail the expected gate.

**Hard stops:** HTTP success without authoritative outcome; a critical test passing only after retry; cross-tenant data visibility; media flow certified only with mocks.

## Phase P3 — truthful k6 and protocol load harness

**Goal:** make load tests represent current contracts and real protocol paths.

**Dependencies:** P0 and P1; P2 for browser smoke.

**Tickets:** `K6-01` runner/validation; `K6-02` isolated user fixtures; `K6-03` API journeys; `K6-04` native coordinator WebSocket; `K6-05` browser smoke and reporting.

**Primary code map:** `k6/run-tests.js`; `k6/config/`; `k6/backend/utils/`; `k6/scripts/setup-users.js`; current scenario files found by the runner; gateway service routing; room capability/admission contracts; edge coordinator WebSocket protocol. Do not change production APIs merely to make stale k6 calls pass unless the product contract is independently wrong and approved.

**Ticket order:** repair runner/config first; then unique users and cleanup; then HTTP journeys; then coordinator WebSocket; finally small browser smoke/report integration. Legacy Socket.IO and Cloudflare coordinator traffic remain different protocols and must have different scenarios and metrics.

**Implementation:**

- Repair stale paths, validation, thresholds, endpoint construction, variable names, and setup/cleanup.
- Give each virtual user isolated identity and room data; remove bypass headers from certification workloads.
- Add auth, dashboard, meeting, schedule, admission, recording, and admin-read scenarios.
- Use native WebSocket tests for Durable Object signalling and a separate Socket.IO/browser harness for the legacy path.
- Produce JSON/HTML summaries with revision, workload, environment, SLOs, percentiles, and first failure.

**Exit evidence:** smoke tests intentionally fail on contract violations; no scenario resolves to zero tests; cleanup is proven; protocol tests assert acknowledgements rather than polling success.

**Hard stops:** shared setup token; rate-limit bypass in certification; pseudo-WebSocket traffic labelled as media capacity; missing thresholds; or stale endpoint paths.

## Phase P4 — capacity measurement and diagnosis

**Goal:** measure sustainable control-plane, signalling, and media capacity without guessing.

**Dependencies:** P2 and P3; approved P0 capacity contract.

**Run order:** smoke → baseline → step capacity → spike → soak → failure recovery.

**Required profiles:**

| Profile | What it measures | Minimum model disclosure |
| --- | --- | --- |
| Control plane | Login/refresh, dashboard reads, meeting creation/listing, admission, notifications, recording/admin reads | request mix, arrival rate, identity distribution, DB/Redis/queue saturation |
| Signalling | Concurrent native coordinator or legacy Socket.IO connections and bounded messages | engine/protocol, room distribution, churn, reconnects, ack/error rate |
| Media | Real publishers/subscribers with audio/video/screen profiles | publishers/subscribers per room, codecs, simulcast layers, bitrates, region, SFU size/cost |

Do not combine these into one headline until each applicable profile passes. The certified application figure is the lowest sustainable figure for the declared workload, not the largest number reached during a spike.

**Rules:**

- Run base and candidate in comparable pinned environments.
- Repeat measurements and retain raw summaries, environment fingerprints, and telemetry.
- Report the lowest sustainable applicable result of control-plane, signalling, and media workloads.
- Publish limiting component, room/user mix, bitrate profile, region, infrastructure size, p95/p99, errors, and cost.
- Use `INCONCLUSIVE` when variance prevents a defensible comparison.

**Exit evidence:** reproducible capacity report and dashboards for gateway, auth, database, Redis, queues, Durable Objects, Mediasoup, Calls, recorder, and client join timing.

**Hard stops:** SLO breach, failed cleanup, lost room state, recorder loss, uncontrolled memory/connection growth, or a result that cannot be reproduced.

## Phase P5 — security, calendar, and scheduling closure

**Goal:** make scheduling and Google Calendar integration safe, idempotent, and reliable.

**Dependencies:** P1; P2 auth/scheduling flow; P0 OAuth/privacy decisions.

**Tickets:** `CAL-SEC-01` opaque signed one-time OAuth state; `CAL-02` authorized meeting export; `CAL-03` FreeBusy-aware availability; `CAL-04` idempotency/sync; `CAL-05` browser/provider contract suite.

**Primary code map:** `backend/packages/room-service/src/routes/v1/calendar.routes.ts`; `controllers/calendar.controller.ts`; `services/calendar.service.ts`; `services/calendar-cache.service.ts`; Prisma calendar integration/event models; gateway routing/assertions; `client/src/contexts/calendar-context.tsx`; calendar hooks, meeting form, import modal, smart scheduling modal, meeting cards/deletion flow.

**Ticket order and state ownership:**

| Ticket | State/security contract | Compatibility requirement |
| --- | --- | --- |
| `CAL-SEC-01` | Server issues opaque, signed, expiring, one-time state bound to verified user, provider, redirect, and nonce; callback consumes it atomically | Existing connected accounts remain usable; no tokens move to browser state |
| `CAL-02` | Export accepts an authorized MeetLite meeting identifier and builds the provider event from durable meeting data | Existing provider event IDs and deletion behavior remain compatible |
| `CAL-03` | Availability is normalized behind the calendar module and uses provider FreeBusy for the authorized calendar set | UI consumes normalized slots, not Google response types |
| `CAL-04` | Create/update/cancel and sync are idempotent; push notifications are hints and scheduled reconciliation covers loss/expiry | Old imported events remain readable during migration |
| `CAL-05` | Fake/provider sandbox proves connect, callback, create, update, cancel, disconnect, replay denial, and provider failure | Personal accounts and production credentials are forbidden |

**Required invariants:** callback cannot select another user; state expires and cannot replay; redirects are bound to the initiating flow; event export resolves an authorized meeting; retries do not duplicate events; provider IDs and cancellation/update semantics are preserved.

**Exit evidence:** tamper, expiry, wrong-user, replay, duplicate, provider failure, and browser OAuth tests; audit logs without token leakage; rollback flag or previous artifact.

**Hard stops:** caller-supplied user identity; reusable OAuth state; hard-coded sample event; missing idempotency; token/secret in logs; or unbounded cache invalidation.

## Phase P6 — dashboard, admin, account, and billing completeness

**Goal:** remove misleading product surfaces and complete high-harm customer paths.

**Dependencies:** P1; P0 incomplete-UI policy.

**Tickets:** `UI-TRUTH-01` route inventory; `ADMIN-01` measured health/audit; `ADMIN-02` authorization/pagination; `BILL-01` plan/upgrade limits; `ACCOUNT-01` deletion/recovery; `RECORD-UI-01` metadata/edit/export closure.

**Primary code map:** `client/src/App.tsx`; dashboard components; `client/src/pages/admin/`; admin constants/service; plan pages/components/service; recordings pages/hooks/services/components; team settings/hooks; profile danger zone; auth-service admin/plan/organization controllers, routes, services; room-service analytics/recording controllers and services.

**Ticket boundaries:**

- `UI-TRUTH-01` inventories every route/button/menu item and either wires a real capability, hides it, disables it with an honest explanation, or marks it preview. It does not implement all missing features.
- `ADMIN-01/02` replace hard-coded values only with service-owned measurements and audit events. Liveness, readiness, dependency health, and historical logs are not interchangeable.
- `BILL-01` may wire existing plan enforcement and an owned upgrade route; it must not invent prices, payment-provider behavior, or entitlement policy.
- `ACCOUNT-01` cannot proceed beyond reversible local scaffolding until deletion, recovery, retention, organization ownership transfer, recordings, and audit policy are approved.
- `RECORD-UI-01` must preserve recording authorization and retention rules on every metadata, transcript, export, replay, and download operation.

**Implementation:** either implement each exposed action end-to-end or hide it behind an explicitly labelled preview state. Replace hard-coded health/activity/plan data with owned APIs, measured status, authorization, pagination, audit events, and destructive-action confirmation.

**Exit evidence:** route/action inventory; browser checks for every visible action; admin/non-admin authorization tests; deletion recovery and retention evidence; no “Coming Soon” action presented as available.

**Hard stops:** fabricated health data; unauthorized admin action; destructive operation without confirmation/recovery policy; or UI claiming a capability that has no backend implementation.

## Phase P7 — room, media, recording, and collaboration hardening

**Goal:** make the meeting core resilient across legacy and Cloudflare paths.

**Dependencies:** P1 and P2; P4 for performance-sensitive changes.

**Tickets:** `ROOM-01` device preflight; `ROOM-02` measured RTC quality; `ROOM-03` reconnect/host departure; `REC-01` recorder continuity and R2 completion; `COLLAB-01` batching/compaction/recovery; `MEDIA-01` canary rollback.

**Primary code map:** `client/src/pages/lobby.tsx`, `room.tsx`; room/media/collaboration hooks and components; media endpoint adapters/types/tests; Mediasoup controllers/services/socket routes; edge `room-coordinator.do.ts`, `storage.ts`, `collaboration-manager.ts`, `sfu-adapter.ts`, `spend-alarm.ts`, `hyperdrive-client.ts`; room capability/admission and recording/R2 services; recording ADR/tests.

**Provider boundary:** shared client/domain types describe tracks, participants, publish/subscribe, reconnect, and cleanup. Mediasoup device/transport types and Cloudflare session/track types stay inside their adapters. `room.tsx` must not fork the entire room experience by provider; provider-specific staged setup belongs behind the media endpoint/coordinator seams.

**Failure matrix:** camera/mic denial; device removed; Socket.IO/coordinator disconnect; stale generation; duplicate join; concurrent negotiation; host departure; recorder participant failure; multipart interruption; DO eviction/restart; duplicate/reordered Yjs delta; snapshot threshold; awareness inspection; explicit leave versus abandoned cleanup.

**Required invariants:** provider seam is isolated; legacy Mediasoup remains a rollback target; reconnect does not double-count seats; recorder survives host departure; awareness is never persisted; Yjs updates batch and recover after DO restart; Cloudflare can be disabled without corrupting room state.

**Exit evidence:** browser tests, restart/eviction recovery, interrupted upload tests, SQLite/storage inspection, memory/latency measurements, and rollback drill.

**Hard stops:** state loss, duplicate seat, persisted awareness, recording corruption, provider-specific types leaking across seams, or Cloudflare rollout without a tested Mediasoup rollback.

## Phase P8 — staging certification and controlled canary

**Goal:** expose an immutable artifact to a bounded cohort and prove rollback.

**Dependencies:** P4–P7 as applicable; all critical verifier flows green.

**Actions:**

- Deploy immutable artifact to isolated staging and then a declared canary cohort.
- Compare control and candidate on correctness, SLOs, resource use, cost, media quality, recording completion, and calendar failures.
- Observe the minimum duration and sample size from P0.
- Automatically contain and roll back on any hard-stop signal.

**Default rollout:** retain Mediasoup as control and send only newly created rooms in a declared stable cohort to Cloudflare. If the implementation still has only the build-time `VITE_MEDIA_ENGINE` flag, use separate immutable client deployments/cohorts or complete a server-authoritative stable assignment ticket first; do not pretend the build-time flag provides per-room percentage routing. Never move an active room between engines. Canary credentials are supplied by the protected staging environment, never committed or passed through client build arguments.

**Minimum comparison signals:** admission/join success; time to first local/remote media; reconnect success/time; duplicate seats; packet loss/jitter where available; recording start/completion/corruption; collaboration recovery; API/signalling errors; CPU/memory/connections/storage; Cloudflare egress/spend; rollback time.

**Exit evidence:** canary manifest, dashboard snapshots, artifact digests, rollback result, residual-risk owners, and follow-up tickets.

**Hard stops:** any critical-flow failure, tenant isolation issue, data loss, recording loss, SLO breach, uncontrolled cost, or inability to roll back.

## Phase P9 — differentiated product pilots

**Goal:** validate one market advantage at a time after reliability is credible.

**Dependencies:** P8 and customer evidence.

**Candidate pilots:** consent-based decisions/tasks, searchable replay, availability-first scheduling, breakouts, moderated Q&A, captions/translation, privacy-preserving coaching, or durable/ephemeral collaboration modes.

Select exactly one pilot. The default recommendation from the research is to start with a capability that deepens already-owned data and workflows—searchable replay or consent-based decisions/tasks—after recording integrity, permissions, and retention are complete. Calendar-first differentiation is acceptable only after P5.

**Each pilot requires:** target ICP and job-to-be-done; customer interviews; prototype; adoption/retention metric; willingness-to-pay signal; provider/AI/support cost estimate; consent/retention policy; rollback; and a stop condition.

**Exit evidence:** pilot result against its metric, cost and privacy review, support impact, and decision to scale, revise, or stop.

**Hard stops:** covert data collection, unclear consent, unbounded AI/provider cost, weak authorization, or feature adoption below the declared stop threshold.

## Phase ledger and advancement rule

Maintain this table in the plan or a linked execution ledger as work proceeds. A phase advances only when every hard dependency is `COMPLETE`; a later phase's proof of concept does not change that rule.

| Phase | Initial state | Required predecessor | Advancement authority |
| --- | --- | --- | --- |
| P0 | `PROPOSED` | none | Human accepts decisions/owners; agent records evidence |
| P1 | `PROPOSED` | P0 `COMPLETE` | Verifier owner accepts seeded-failure and CI trust evidence |
| P2 | `PROPOSED` | P1 `COMPLETE` | Product/platform reviewer accepts protected flow evidence |
| P3 | `PROPOSED` | P1 `COMPLETE`; P2 browser boundary selected | Performance owner accepts truthful harness evidence |
| P4 | `PROPOSED` | P2 and P3 `COMPLETE`; capacity contract approved | Performance/platform owners accept reproducibility |
| P5 | `PROPOSED` | P1; relevant P2 harness available | Security/product reviewers accept provider and browser evidence |
| P6 | `PROPOSED` | P1; P0 UI/product policies | Product/security reviewers accept truthful UI and authorization evidence |
| P7 | `PROPOSED` | P1 and P2; P4 for performance claims | Realtime/platform reviewers accept failure matrix and rollback |
| P8 | `PROPOSED` | Applicable P4–P7 tickets complete | Human release authority approves canary |
| P9 | `PROPOSED` | P8 complete plus customer evidence | Product owner approves exactly one pilot |

Agents may update a state to `IMPLEMENTING`, `VERIFYING`, `FAILED`, or `BLOCKED` with evidence. Only the named human authority may accept unresolved policy decisions, production canary exposure, legal/name risk, or paid-provider spending.

## Commit and review discipline

- Commit by ticket/cage milestone, not by arbitrary file count.
- Keep meaningful-red tests with the implementation ticket; do not hide the red-to-green history from evidence.
- Separate mechanical command/CI wiring from product behavior.
- Separate schema expansion, backfill/migration, behavior switch, and contraction.
- Do not combine generated artifacts, dependency upgrades, mass formatting, or branding changes with a functional ticket.
- Before handoff, review `git status --short`, `git diff --check`, the complete diff, and every newly untracked file. Existing unrelated user changes remain untouched.

## Copy-paste instruction for the executing agent

```text
Execute only ticket <TICKET> in phase <PHASE> from
docs/architecture/meetlite-agent-execution-plan.md.

Before editing:
1. Read the plan's Mission, Source-of-truth, Architecture, Known baseline gaps,
   Decisions/defaults, Ticket packet, Current command contract, and the full active phase.
2. Read docs/architecture/execution/README.md sections 1.2 and 2–7,
   plus the applicable scaling/refactoring phase.
3. Inspect git status and the named primary code map. Verify whether the recorded gap
   still exists; do not assume it does.
4. Create/update docs/architecture/execution/evidence-<ticket-lowercase>.md.
5. State invariant, owning seam, trusted principal, system of record, allowed/forbidden
   files, dependencies, exact red/pass-to-pass checks, rollback, and hard stops.

Then execute Cages 1 through 7 in order. Implement the smallest coherent tracer bullet.
Do not start another ticket or phase. Do not alter branding, billing/retention policy,
production data, production credentials, or the Mediasoup rollback path without the
explicit decision required by this plan.

At handoff, provide exact commands/results, adversarial cases, artifacts, diff summary,
rollback, residual risks, and the next dependency. Mark missing harnesses NOT_IMPLEMENTED,
unstable comparisons INCONCLUSIVE, environment failures INFRA_ERROR, and retry passes FLAKY.
Never represent any of those states as PASS.
```

## Agent handoff template

```text
Ticket/state:
Invariant:
Owning module and seam:
Base/candidate SHAs:
Forbidden scope:
Dependencies:
Meaningful red or characterization evidence:
Exact commands and results:
Adversarial cases:
System/browser/load evidence:
Canary or not-applicable reason:
Rollback:
Residual risks and owners:
Evidence file:
```

No ticket is complete until the handoff is filled from archived evidence. “Tests passed,” “production-ready,” “secure,” and “scalable” without commands, scope, and artifacts are not acceptable completion claims.
