# MeetLite Product and Performance Roadmap

**Status:** proposed plan  
**Prepared:** 2026-10-25  
**Goal:** make MeetLite measurably reliable at its current deployment scale, complete the product paths exposed in the UI, and build differentiated collaboration value without claiming an unmeasured CCU figure.

The agent-ready execution order is in [MeetLite Agent Execution Plan](meetlite-agent-execution-plan.md). This roadmap explains the rationale; the execution plan is the sequencing and handoff authority.

## Executive decision

Do not publish a concurrent-user capacity figure yet. The current suite exercises a small amount of HTTP traffic, but it does not reproduce the present room-admission, signalling, or media paths accurately enough to certify API CCU, connected-room CCU, or WebRTC media CCU.

Capacity will be reported as three separately measured numbers:

| Metric | Meaning | Certification workload |
| --- | --- | --- |
| Control-plane CCU | Authenticated users completing dashboard, scheduling, admission, and notification operations | Protocol-level k6 traffic against the gateway and services |
| Signalling CCU | Simultaneously connected users exchanging the actual coordinator or legacy signalling messages | Native WebSocket test for the Durable Object coordinator; browser/socket-specific test for legacy Socket.IO |
| Media CCU | Simultaneously connected publishers/subscribers with defined audio/video/screen-share bitrate profiles | Browser-based WebRTC test plus Cloudflare Calls or Mediasoup server telemetry |

The certified application capacity is the lowest sustainable result of the applicable three values, at the agreed traffic mix and service-level objectives (SLOs). A number from a single local Docker laptop test is a **development baseline**, not a production-capacity claim.

## Execution-readiness assessment

This document is a sound strategy, but the workstreams remain `PROPOSED`, not `READY`, under the repository execution standard. Calendar-week estimates are planning ranges, not delivery commitments. Before implementation begins, each slice must become a separate ticket/evidence record with:

- one invariant and one owning module;
- a named human owner and reviewer;
- immutable baseline commit and environment fingerprint;
- dependencies and forbidden scope;
- exact fail-to-pass and pass-to-pass checks;
- measurable correctness, performance, cost, and UX acceptance criteria;
- rollback/kill switch and hard-stop conditions;
- applicable security, privacy, retention, migration, and provider-limit decisions.

Cross-cutting product features must be delivered as vertical tracer bullets. “Finish Analytics” or “improve scheduling” is too broad for one ticket. A slice is ready only when it produces one demonstrable user outcome through UI, API policy, storage/provider behavior, telemetry, and tests.

### Blocking decisions

The first execution tranche cannot enter `READY` until these decisions have owners:

1. Certification environments and who may authorize/load-test each one.
2. Initial workload mix and SLO/error/cost budgets for control-plane, signalling, and media capacity.
3. Git hosting/CI authority, required checks, Code Owners, and artifact retention.
4. Browser/WebRTC harness choice and controlled Google OAuth/calendar test boundary.
5. Product policy for recording/AI consent, retention, deletion, and participant notification.
6. Whether incomplete navigation is hidden immediately or retained behind an explicitly labelled preview flag.
7. Whether to rename before public launch or commission counsel-led clearance for `MeetLite` in every intended market.

### First execution tranche

| Ticket | Invariant / outcome | Dependencies | Required evidence | Rollback |
| --- | --- | --- | --- | --- |
| `VER-01` | Required repository checks cannot pass through `echo`, missing tests, or zero-test discovery | CI owner and Node/browser versions | Deliberately failing format, unit, integration, contract, build, and E2E fixtures each fail the gate | Revert command wiring; never waive missing evidence as green |
| `VER-02` | Every agent change gets a deterministic `PASS`, `FAIL`, `INCONCLUSIVE`, or `NOT_IMPLEMENTED` report selected from declared and diff-inferred risk | `VER-01`; protected policy owner | Verifier fixture tests plus tamper, timeout, zero-test, malformed-report, and policy-change cases | Keep current cage/manual evidence process while verifier is disabled |
| `PERF-01` | Capacity terms, traffic mix, SLOs, environment and cost stop conditions are approved before load generation | platform/product owners | Reviewed capacity contract with immutable environment fingerprint | Documentation-only revert |
| `K6-01` | k6 smoke auth/meeting/room scenarios match current APIs and fail on contract violations | `PERF-01` | Base/candidate smoke, isolated users, cleanup proof, runner self-tests | Retain old suite only as clearly non-certifying historical reference |
| `E2E-01` | Signup → dashboard → lobby → two-party room → leave works in a real browser with no console/network errors | `VER-01`; deterministic seed/reset | Playwright trace and deliberate-break proof for Mediasoup; Cloudflare remains staging-only | Disable new suite without weakening other required gates |
| `OBS-01` | A correlation ID and stable metrics connect gateway admission to first remote media and cleanup | metric owners and staging telemetry | Trace samples, bounded-cardinality review, dashboard and alert tests | Remove new emission behind telemetry flag; preserve existing logs |
| `CAL-SEC-01` | Google callback cannot select a user/redirect that did not initiate an unexpired one-time flow | controlled Google OAuth boundary | Red/green replay, tamper, expiry, wrong-user, callback and browser tests | Disable calendar connect flag and redeploy previous artifact |
| `UI-TRUTH-01` | No production navigation/action advertises a mock or unimplemented capability as available | product owner decision | Route/action inventory and browser checks for hidden/preview states | Restore prior navigation configuration |

The detailed verifier design is in [Agent Change Verifier](agent-change-verifier.md), supported by the primary-source review in [Agent verifier loops and regression gates](../research/agent-verifier-loops-and-regression-gates-2026-10-25.md). Every tranche ticket uses the evidence template in `docs/architecture/execution/README.md` and remains unstarted until its named dependencies are complete.

## Brand decision gate

Do not treat `MeetLite` as legally cleared or invest materially in public brand equity under that name until one of these paths is completed:

1. shortlist three distinctive, non-`Meet` candidates and run legal, marketplace, linguistic, domain, app-store, social-handle, and user-recall screening; or
2. obtain a written counsel-led clearance opinion for `MeetLite`, including Google-related confusion, exact-name/common-law use, and every intended launch territory.

The preliminary assessment recommends the rename path because the current name is descriptive, already used by another WebRTC meeting project, and can create the commercial impression of a lightweight Google Meet edition. This is a product-risk assessment, not legal advice. Evidence and the full screening funnel are in [MeetLite name and preliminary trademark-risk review](../research/meetlite-name-trademark-risk-2026-10-25.md).

## Findings that determine the order

### Performance test suite is not yet a trustworthy capacity harness

- The README and package identity still use `MiniMeet`, document paths that no longer exist, and default the frontend to port 5174 even though the current client uses 5175.
- The runner has only backend scenario files; `test:frontend:*` resolves to no scenarios. Its legacy convenience commands also name paths that do not exist.
- `npm run validate` in `k6/` currently fails because its glob paths refer to removed `scenarios/` and `utils/` directories.
- The stress scenario contains misspelled `threholds`, an undefined/self-referenced `roomId`, and mismatched variable names. Consequently it cannot establish a breaking point.
- `setup-users.js` concatenates a full endpoint URL onto the configured base URL, so it cannot reliably provision its promised user pool.
- The current pseudo-WebSocket client treats successful HTTP polling POSTs as successful room and message delivery. It does not prove a Socket.IO event acknowledgement, nor does it model the Durable Object's native WebSocket protocol.
- Every virtual user shares the setup token. That hides per-user admission, quota, and token-path contention; its `X-Bypass-Rate-Limit` header also makes it unsuitable as a production-like certification workload.

### Product paths visibly advertised but incomplete

- Navigation exposes Analytics and Organization Hub, but both routes are `ComingSoon`.
- Admin System & Logs displays a hard-coded activity log, while the corresponding backend health response is hard-coded values rather than measured service, database, queue, storage, or edge status.
- Plan settings use a mock plan summary and the limit alert has no upgrade flow.
- Recording edit, transcript download, export, team-recording edit, and team-role update actions announce that they are coming soon.
- Account deletion is not implemented.

### Calendar and scheduling need a reliability/security completion pass

- Google connection, cached imports, conflict detection, and direct event creation exist, so this is a strengthening project rather than a greenfield feature.
- The public Google authorisation route creates no state, while the callback accepts URL-decoded JSON containing the target `userId`; this must be replaced with opaque, signed, expiring, one-time OAuth state bound to the initiating user and redirect.
- `exportMeetingToCalendar` creates a hard-coded sample event instead of resolving an authorized MeetLite meeting.
- Availability only examines the organizer's connected Google calendar; it does not use attendee free/busy information, incremental sync, or provider push notifications. Cache invalidation uses Redis key scanning, which will not remain a safe scaling pattern.

### Room experience needs production evidence, not more hidden assumptions

- The media seam supports legacy Mediasoup and Cloudflare Calls, with a rollback flag. The Cloudflare path, however, needs live-browser/canary evidence with actual Calls credentials; local coordinator mode falls back to an in-memory storage and mock SFU adapter.
- The room UI still initializes legacy Socket.IO and Yjs plumbing around the Cloudflare media path. This should be intentionally tested and simplified so the active media engine has one authoritative lifecycle.
- Responsive layouts currently use fixed values for connection quality, device capability, and user preference rather than measured network/device state.

## Workstreams and sequence

## 0. Establish the performance contract (week 1)

**Decision to make before implementation:** define the first release target separately for each capacity metric above, its environment, and the acceptable cost envelope. Recommended initial certification targets are an SLO rather than a fixed CCU: 99% successful admission, 99% signalling connection success, API p95/p99 per endpoint class, zero failed room cleanup, and stable CPU/memory/database/DO metrics for a 30-minute hold.

Deliverables:

1. Write `docs/performance/capacity-contract.md`: workload mix, user personas, media profiles, test environment, target geography, SLOs, abort limits, data-retention policy, and cost guardrails.
2. Provision an isolated staging tenant, disposable test organizations/users, a dedicated test origin, and an explicit `LOAD_TEST_MODE` only for test-data cleanup. Do not use a rate-limit bypass header in capacity certification.
3. Instrument the path before load: gateway request rate/latency/error rate, auth and room-service DB-pool saturation, Redis, queue depth, Mediasoup worker/router/transport metrics, Durable Object request/connections/storage metrics, Calls metrics, and client join/publish/subscribe timing.
4. Add a run-result schema and comparison report containing source revision, environment configuration, test profile, percentiles, saturation signals, and the first failure mode.

Exit criteria: a reviewer can reproduce a smoke run from one command and determine whether a result is comparable with a prior run.

## 1. Replace k6 with a versioned, truthful load harness (weeks 1-3)

Restructure `k6/` around user journeys rather than stale service folders:

```text
k6/
  config/                 # checked-in non-secret profiles and SLOs
  scenarios/
    smoke/
    api/                  # auth, dashboard, schedule, room admission, recordings
    coordinator/          # native Durable Object WebSocket protocol
    browser/              # login → lobby → join; UX metrics at small scale
  fixtures/               # generated identities and meeting/room builders
  lib/                    # authenticated API, assertions, summary/reporting
  results/                # gitignored raw output; committed summaries only
```

Implementation order:

1. Repair the runner, validation command, environment validation/redaction, endpoint contract parsing, user-pool provisioning and cleanup. Fail fast on an incompatible API response.
2. Add smoke profiles for auth, dashboard/meetings, quick room, scheduled room, calendar conflict, recording list, and admin read-only views. Run on every relevant pull request.
3. Add API average-load, stress, spike, and soak scenarios using arrival-rate executors where request rate is the business question and per-VU isolated identities where admission is the question. Tag all requests by journey, endpoint, media engine, and result class.
4. Add a native `k6/websockets` coordinator scenario that authenticates with freshly issued room capabilities, joins/reconnects, publishes signalling messages, sends bounded Yjs updates, and asserts server acknowledgements/error codes. This is distinct from Socket.IO.
5. Use k6 browser for a small number of real browser journeys and Core Web Vitals. Use protocol load for the large share of HTTP traffic. For legacy Socket.IO and real audio/video tracks, run a separately maintained browser/WebRTC harness after a feasibility spike; do not label polling traffic as WebRTC capacity.
6. Add `handleSummary()` JSON/HTML output, baseline comparison, Prometheus/OTel-compatible outputs, and CI tiers: smoke on PR; average load nightly; spike/stress on isolated staging; soak weekly or before release.

The test classes follow Grafana's current smoke, average-load, stress, spike, and soak guidance. Native WebSocket tests should use `k6/websockets`, which Grafana recommends for new WebSocket scripts; browser tests supply browser-only UX metrics. See the [official k6 guidance](https://grafana.com/docs/k6/latest/testing-guides/automated-performance-testing/), [WebSocket API](https://grafana.com/docs/k6/latest/using-k6/protocols/websockets/), and [browser testing guidance](https://grafana.com/docs/k6/latest/using-k6-browser/).

Exit criteria: all scripts execute, intentionally fail when their contract is violated, and produce a repeatable baseline for both `mediasoup` and `cloudflare` media-engine profiles.

## 2. Measure, diagnose, and certify capacity (weeks 3-5)

Run the following sequence against a production-shaped staging environment, twice per build candidate:

| Run | Question answered | Start condition | Stop condition |
| --- | --- | --- | --- |
| Smoke | Is the harness and deployment valid? | 1-5 users / one room | any functional check fails |
| Baseline | What is normal performance? | approved expected traffic mix | SLO breach or 30-minute stable hold complete |
| Step capacity | Where is the sustainable knee? | baseline result | first sustained SLO or saturation breach |
| Spike | Does the platform recover from burst admission? | idle/steady state | recovery exceeds the agreed window |
| Soak | Does state, memory, connection, or storage leak? | 50-70% of sustainable step result | trend/degradation breach over 4-8 hours |
| Failure recovery | Does the room survive reconnects and process/DO eviction? | active rooms with controlled churn | lost state, leaked seat, failed recorder, or failed reconnect |

For each engine, publish: maximum sustainable API/signalling/media CCU, rooms and users-per-room, traffic mix, media bitrate/layer assumptions, region, infrastructure size, p95/p99, error rates, cost estimate, and limiting component. Re-run after changes to media, storage, auth, schema, or deploy configuration.

## 3. Finish customer-visible completeness work (weeks 2-6, in parallel after Workstream 0)

Prioritize by customer harm and confidence:

1. **Truthful dashboard/admin:** either implement Analytics, Organization Hub, plan/billing, system health, and audit logs end-to-end or remove/hide their navigation until ready. Replace the mock admin health/log data with service-owned, paginated audit events and aggregate measured health. Add destructive-action confirmations, audit trails, and integration tests.
2. **Meeting and recording closure:** deliver real recording metadata editing, transcript/download/export, team-role management, account deletion with a verified recovery window, and an owned billing/upgrade journey. Define retention, authorization, and audit semantics first.
3. **Calendar and scheduling:** secure OAuth state; bind event export to a meeting ID and owner authorization; preserve provider event IDs; use idempotency keys; model recurring-event updates/cancellation; add Google FreeBusy for availability; then introduce incremental synchronization/webhook handling and targeted cache invalidation. Add contract tests against a provider sandbox/mock and browser OAuth tests.
4. **Room readiness:** add device preflight, network-quality adaptation from real RTC stats, join/reconnect states that distinguish authorization from transport failures, and accessibility/keyboard coverage. Exercise host departure, reconnect, recording continuity, screen sharing, and collaboration persistence in browser integration tests for both engines.

## 4. Strengthen the existing platform (weeks 5-8)

- Make API contracts explicit (OpenAPI or shared typed schemas) and test client/server route compatibility. The stale k6 endpoints and UI defaults are evidence that this boundary currently drifts.
- Add end-to-end tests for the seven highest-value journeys: signup/login, quick meeting, scheduled meeting/invites, Google connect/schedule, lobby-to-room, recording/replay, and administrator actions.
- Split heavy room/collaboration and recording views with route-level lazy loading; record bundle budgets and Core Web Vitals alongside load-test results.
- Replace Redis `KEYS` invalidation with indexed/versioned keys or a safe cursor-based deletion strategy.
- Establish observability ownership: a correlation ID spans client join, gateway, auth, room service, media/coordinator, recorder, and background processing; dashboards expose join success, time-to-first-media, reconnect rate, packet loss/jitter, recording completion, and calendar failures.
- Verify the Cloudflare Calls adapter only in an isolated staging canary with real credentials, a defined rollback trigger, and an automated legacy-Mediasoup rollback drill.

## 5. Build a differentiated product edge after reliability is credible (weeks 8+)

The items below are product hypotheses, not an approved backlog. Competitor presence proves market expectation, not customer demand or differentiation. Before funding one, name the initial customer profile and job-to-be-done, interview representative users, validate willingness to adopt/pay, test a low-cost prototype, estimate provider/AI/support cost, and define one adoption/retention success metric plus a stop condition.

| Opportunity | Why it fits MeetLite | First slice | Guardrail |
| --- | --- | --- | --- |
| Consent-based recap → decisions → tasks | Existing recordings, transcripts, and AI surfaces can turn a meeting into work rather than a video artifact | Capture decisions/action items with owners and approval before publishing to email/Slack/project tools | Explicit consent, retention, redaction, and source timestamps |
| Searchable replay with chapters | Recording and transcript UIs exist but export/download work is unfinished | Timestamped transcript search, chapter markers, and deep links into a recording | Permission checks on every artifact and share link |
| Availability-first scheduling | Google integration and smart-scheduling UI already exist | FreeBusy-aware suggested slots, timezone-safe invites, and idempotent event creation | Secure OAuth state and provider rate-limit/backoff handling first |
| Real breakout orchestration | Plan entitlements already mention breakouts but there is no proven orchestration journey | Host creates rooms, assigns/rebalances people, broadcasts, times out, and recalls | Capacity tests must cover fan-out and rejoin paths |
| Moderated Q&A, polls, and decisions | A lightweight layer works for all-hands and training without adding another collaboration product | Anonymous option, moderation queue, live result, export | Explicit host/participant permissions and auditability |
| Accessible live captions and translated recap | Valuable for global and inclusive teams | Caption transport, opt-in display, post-meeting translated recap | Consent, language quality disclosure, and data-processing controls |
| Privacy-preserving meeting coach | A differentiator versus generic AI summaries | Opt-in local/client-side speaking-time and pace feedback, then aggregate only consented metrics | Never covertly score people; make collection, retention, and deletion obvious |
| Durable versus ephemeral collaboration | The edge CRDT foundation is well suited to code/whiteboard sessions | Per-artifact persistence mode, export, and a clear expiry indicator | Never silently persist awareness/cursor data or sensitive drafts |

The supporting primary-source comparison is in [Video collaboration market differentiators](/Users/emmanuel/Dev/meetlite/docs/research/video-collaboration-market-differentiators-2026-10-25.md).

## Governance and release gates

No feature becomes generally available until it has: a named owner, a user-visible definition of done, authorization/retention review, telemetry, unit and contract coverage, browser coverage where user media or OAuth is involved, a measured performance budget, and a rollback path.

Recommended release order:

1. Performance contract and trustworthy harness.
2. OAuth/scheduling correctness and the UI paths currently carrying fake data or `Coming Soon` states.
3. Baseline/capacity certification and room lifecycle hardening.
4. Replay, recap/tasks, and FreeBusy scheduling.
5. Breakouts/Q&A/captions and carefully scoped differentiated pilots.

This ordering protects the meeting core first, creates reliable operating data, and then invests in product differentiation on foundations that can support it.
