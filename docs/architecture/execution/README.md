# MeetLite Scaling and Refactoring Execution Standard

This directory converts the [architecture blueprint](../phased-scaling-execution-plan.md) into two independently gated execution tracks:

- [Scaling execution plan](scaling-execution-plan.md): infrastructure, capacity, rollout, resilience, and cost controls.
- [Refactoring execution plan](refactoring-execution-plan.md): code structure, module seams, tests, security, and legacy removal.

The word **MUST** is a release requirement. **SHOULD** requires a written reason when omitted. **MAY** is optional. No agent may reinterpret an unmet gate as complete.

## Agent skills

Agents executing this plan use two project-local, model-invoked skills:

- [`meetlite-engineering-standards`](../../../.agents/skills/meetlite-engineering-standards/SKILL.md) loads and applies the coding rules and production patterns when code, configuration, schema, messages, infrastructure, or runtime behavior changes.
- [`meetlite-verification-cage`](../../../.agents/skills/meetlite-verification-cage/SKILL.md) enforces the phase state machine, evidence record, seven verification cages, hard stops, canary, and closure rules.

This document remains the single source of truth. The skills deliberately route agents here instead of maintaining a second copy of the detailed standards.

## 1. Execution contract

### 1.1 Governing principles

1. Preserve behavior before changing structure. A refactor MUST have characterization tests or an explicitly approved behavior change.
2. Make one independently reversible change at a time. Infrastructure provisioning, data migration, behavior changes, and deletion MUST NOT be bundled into one irreversible step.
3. Use expand, migrate, verify, contract for schemas, messages, configuration, and interfaces.
4. Treat authentication, authorization, tenant isolation, billing, recording access, and moderator operations as server-side invariants.
5. Treat every network call and queue delivery as fallible, delayed, duplicated, and potentially out of order.
6. Optimize from measurements. A claimed latency, capacity, cost, or memory improvement MUST include before-and-after evidence.
7. Prefer deep modules: a small interface hides provider negotiation, retry, persistence, ordering, and cleanup details.
8. Do not add speculative provider abstractions. A seam is justified by a real fake/test adapter or a second production adapter.
9. Keep the old production path available until the replacement passes its canary exit gate.
10. A successful build is necessary but never sufficient verification.

### 1.2 Phase and ticket state machine

Every phase and every implementation ticket uses this state machine:

```text
PROPOSED → READY → IMPLEMENTING → VERIFYING → CANARY → COMPLETE
              ↘ BLOCKED          ↘ FAILED ──→ ROLLED_BACK
```

- **PROPOSED:** outcome is known, but dependencies or acceptance evidence are incomplete.
- **READY:** scope, owner, risks, tests, rollback, and dependencies are written down.
- **IMPLEMENTING:** only the approved scope is being changed.
- **VERIFYING:** implementation is frozen except for fixes discovered by the verification loop.
- **CANARY:** production-facing behavior is enabled only for the declared cohort.
- **COMPLETE:** every gate has objective evidence and rollback remains documented.
- **BLOCKED:** an external dependency or decision prevents safe progress.
- **FAILED:** a gate failed; do not expand scope to conceal the failure.
- **ROLLED_BACK:** runtime exposure is reverted while evidence is retained for diagnosis.

No phase may enter `READY` until the preceding hard dependencies are `COMPLETE`. Documentation, local scaffolding, and isolated proofs of concept MAY run earlier, but MUST NOT be presented as production completion.

## 2. Strict coding rules

### 2.1 Scope and change discipline

- Every change MUST name one primary invariant and one rollback method.
- A pull request SHOULD implement one tracer bullet or one mechanical refactor, not an entire phase.
- Unrelated formatting, dependency upgrades, renames, and cleanup are forbidden in a behavior-changing change.
- Generated artifacts, build outputs, recordings, secrets, and local databases MUST NOT be committed.
- Existing user changes MUST be preserved. An agent MUST inspect `git status` before editing and before handoff.
- No destructive command, schema operation, or production mutation may be run without explicit authorization and a verified target.
- New dependencies MUST include purpose, maintenance/security assessment, bundle/runtime impact, and why the standard library or an existing dependency is insufficient.
- Provider-specific types MUST stop at their adapter. They MUST NOT leak into domain interfaces, React views, database models, or public events.

### 2.2 TypeScript rules

- `strict` mode MUST remain enabled.
- New code MUST NOT use `any`, unchecked type assertions, `@ts-ignore`, or non-null assertions to silence uncertainty.
- Unknown external data MUST enter as `unknown` and be validated once at the ingress seam.
- Environment variables MUST be parsed into one immutable typed configuration object during startup. Feature code MUST NOT read `process.env` directly.
- Domain identifiers SHOULD use distinct branded types where confusing two IDs could cross a security or data-ownership boundary.
- Public unions MUST be exhaustively handled with a `never` check.
- Errors MUST be typed by stable machine code; clients MUST NOT branch on human-readable messages.
- Functions SHOULD return results and keep side effects in adapters. Time, randomness, storage, queues, and provider clients MUST be injected where deterministic tests need control.
- Export only the intended module interface. Internal helpers and provider response types remain private.

### 2.3 Module and dependency rules

The default server-side dependency direction is:

```text
transport handler → application module → domain policy
                                   ↘ repository/provider adapter
```

The default client-side dependency direction is:

```text
React view → hook/controller → domain state machine → browser/network adapter
```

- Transport handlers parse, authenticate, invoke one application operation, and map the result. They MUST NOT contain business policy or direct Prisma/provider calls.
- Domain policy MUST NOT import Express, Prisma, Cloudflare SDK types, Redis, BullMQ, React, or browser globals.
- Repository adapters own query construction and tenant predicates. Callers MUST NOT append tenant filtering as an optional afterthought.
- Cross-module imports MUST use the declared interface; reaching into another module's internal directory is forbidden.
- Circular package dependencies are forbidden.
- Shared code MUST represent genuinely shared stable concepts. `shared` MUST NOT become a dumping ground for unrelated helpers.
- A new interface MUST have a demonstrated seam: a production adapter plus a fake/test adapter, or two real adapters.

### 2.4 Security and privacy rules

- Authorization MUST run at the operation that touches the resource, not only at routing or UI level.
- Every tenant-owned query MUST derive tenant scope from the verified principal. Caller-supplied `userId`, `orgId`, role, room membership, object key, track name, or recording ID is only a locator.
- Default outcome for missing or ambiguous authorization data is deny.
- Cloudflare App Secrets, signing keys, database URLs, R2 credentials, refresh tokens, and internal assertions MUST never be logged or returned to the browser.
- Public errors MUST not expose stack traces, SQL, provider payloads, tokens, object keys, or existence of inaccessible tenant resources.
- Refresh tokens MUST be hashed at rest, rotated by family, and reuse MUST revoke the family.
- Internal assertions MUST be short-lived and bound to issuer, audience, method, normalized path, request ID, expiry, and key ID.
- Uploads MUST have trusted object-key allocation, content-type/size constraints, checksums where supported, tenant authorization, expiry, and orphan cleanup.
- Logs and traces MUST classify or redact email addresses, access tokens, SDP, ICE candidates, chat/document content, and recording metadata according to the data policy.
- Dependency and secret scanning MUST run in CI. Critical findings block merge unless formally accepted with an expiry date.

### 2.5 Data and migration rules

- `prisma db push --accept-data-loss` is forbidden outside disposable local databases.
- Production schema changes MUST use reviewed migrations and the expand/migrate/contract sequence.
- A migration MUST state lock risk, expected duration, index strategy, rollback/forward-fix strategy, and backup/restore prerequisite.
- Adding a required column uses nullable/default expansion, backfill in bounded batches, verification, then enforcement.
- Renames use dual-read/dual-write or compatibility views; never rename and deploy all callers simultaneously.
- Destructive contraction occurs in a later release after telemetry proves old readers/writers are gone.
- Queue publication following a database mutation MUST either use a transactional outbox or an explicitly documented reconciliation mechanism.
- Persistent records and externally visible operations MUST have idempotency keys where clients or workers can retry.

### 2.6 HTTP, event, queue, and realtime rules

- Inputs are schema-validated at ingress; outputs use stable documented shapes.
- Mutation endpoints MUST define retry semantics and use idempotency keys when duplicate execution is unsafe.
- Timeouts, retry count, backoff, jitter, and retryable error classes MUST be explicit for every outbound dependency.
- Retries are allowed only for idempotent operations or operations protected by an idempotency key.
- Queue jobs MUST be versioned, idempotent, bounded in attempts, observable, and routed to a dead-letter/reconciliation path after exhaustion.
- Event/message envelopes MUST include schema version, command/event ID, room or aggregate ID, actor derived from trusted context, timestamp, and correlation ID.
- WebSocket identity MUST be bound during upgrade and recovered from the socket attachment; message bodies MUST NOT select the sender.
- Room commands MUST carry a generation and expected revision where stale execution could corrupt state.
- Replaceable awareness/cursor events MAY be dropped or coalesced. Durable chat/document operations MUST be ordered and acknowledged.
- Each SFU session has exactly one mutation queue. Overlapping negotiation on the same session is forbidden.
- Explicit leave and abandoned-session cleanup are different flows and MUST have separate tests and SLOs.

### 2.7 React and browser rules

- React views render state and dispatch intent. They MUST NOT implement SDP negotiation, authorization, retry policy, or provider-specific logic.
- Hooks with lifecycle state MUST expose an explicit state machine rather than multiple contradictory booleans.
- Effects MUST be abortable and safe under React Strict Mode remounting.
- Event listeners, tracks, PeerConnections, sockets, timers, object URLs, and subscriptions MUST be released deterministically.
- Server state belongs in React Query; durable local UI state belongs in the chosen store; the same fact MUST NOT have competing authorities.
- Feature flags are evaluated through one typed module and MUST define default, owner, expiry/removal condition, and telemetry dimensions.
- Accessibility and reduced-motion behavior MUST not regress during refactors.

### 2.8 Observability and operations rules

- Every request, room connection, SFU negotiation, upload, and queue job MUST propagate a correlation ID.
- Structured logs MUST use stable event names and fields. Free-form log strings are supplementary, not the metric interface.
- Metrics MUST distinguish success, expected rejection, dependency failure, timeout, cancellation, and programmer error.
- Health endpoints follow strict semantics: liveness is process health, readiness is ability to serve required traffic, startup is initialization completion.
- No unbounded in-memory collection, retry loop, queue, message, upload, or log cardinality is allowed.
- Every production-facing feature flag MUST have a kill switch that does not require a redeploy.
- Alerts MUST be tied to user-visible symptoms, SLO burn, data risk, or spend—not arbitrary CPU thresholds alone.

## 3. Required implementation patterns

### 3.1 Deep module pattern

Each module documents:

1. Its small interface.
2. Invariants and authorization rules.
3. Ordering and concurrency guarantees.
4. Error modes and retry contract.
5. Performance characteristics and limits.
6. What it owns and explicitly does not own.

Tests exercise the same interface used by callers. Tests MUST NOT reach past the interface merely to assert implementation details.

### 3.2 Strangler migration pattern

For Mediasoup, recording, identity, or storage replacement:

1. Characterize the legacy behavior.
2. Put routing behind a typed flag at one seam.
3. Implement the new adapter without modifying legacy internals.
4. Shadow safe read-only decisions where useful; never duplicate side effects blindly.
5. Canary new rooms or requests by stable cohort.
6. Compare success, latency, media quality, error, and cost metrics.
7. Expand only after the observation window.
8. Stop new legacy work, drain old work, then delete the legacy adapter and flag.

An active call MUST NOT be migrated between media providers.

### 3.3 Transactional job pattern

```text
validate + authorize
        ↓
database transaction: domain mutation + outbox record
        ↓
publisher sends versioned job
        ↓
idempotent worker claims job
        ↓
side effect + durable result
        ↓
mark complete / reconcile / dead-letter
```

Workers MUST tolerate redelivery and process termination at any line.

### 3.4 Compatibility pattern

- Readers become tolerant before writers emit a new format.
- New writers emit the compatible format while old readers still exist.
- Telemetry proves the old format is unused.
- Only then remove compatibility code.

This applies to database columns, WebSocket events, queue jobs, JWT/internal claims, environment variables, and client/server response shapes.

## 4. The caged verification loop

An agent MUST complete this loop for every ticket. It may not skip forward because a later command happened to pass.

### Cage 0 — Establish the evidence boundary

- Read the ticket, relevant phase file, module interface, and nearby tests.
- Inspect `git status`; record pre-existing modifications.
- State the invariant, touched files, forbidden files, dependencies, failure risks, rollback, and exact acceptance commands.
- Capture the current behavior and relevant baseline metrics.
- If the baseline is already red, record the exact failure. Do not silently broaden the ticket to repair unrelated failures.

**Exit:** a short execution note exists and the change is small enough to review and reverse.

### Cage 1 — Prove the test can fail

- Add the narrowest characterization or acceptance test first.
- Run it and observe failure for the expected reason.
- For pure mechanical refactors, run existing tests before editing and capture their output instead of inventing a meaningless failing test.
- A test that fails because of syntax, fixture, network, or environment setup does not prove behavior.

**Exit:** expected red evidence is recorded.

### Cage 2 — Implement the minimum coherent slice

- Change only the declared seam and its implementation.
- Keep compatibility adapters where callers have not migrated.
- Do not perform opportunistic cleanup.
- Add structured telemetry and failure handling with the behavior, not in a later cleanup ticket.

**Exit:** the targeted test becomes green.

### Cage 3 — Local static and focused verification

Run, in order:

1. Formatter/check for touched files, once configured.
2. Linter for the touched workspace.
3. Type-check/build for the touched workspace.
4. Focused unit tests.
5. Focused integration or contract tests.

No new warning is acceptable. A suppression requires an inline reason and follow-up expiry.

**Exit:** all touched-scope checks are green.

### Cage 4 — Adversarial verification

Select every applicable case:

- Missing, malformed, expired, replayed, or cross-tenant identity.
- Duplicate, stale, reordered, oversized, and concurrent commands.
- Timeout, partial response, dependency outage, process termination, and retry exhaustion.
- Browser reconnect, Strict Mode remount, device permission denial, and cleanup.
- Migration rollback/forward-fix and mixed old/new version compatibility.
- Upload interruption, checksum mismatch, expired URL, and orphan cleanup.

**Exit:** applicable negative paths have automated evidence.

### Cage 5 — System verification

- Run affected workspace tests and builds.
- Run consumer contract tests for every changed interface.
- Run repository-wide lint, type-check/build, and tests when the local gate is green.
- For Cloudflare behavior, run deployed staging integration tests; local mocks cannot certify managed SFU, hibernation, Tunnel, or R2 behavior.
- For performance changes, run the declared repeatable load scenario against comparable environments.

**Exit:** no regression is detected and evidence paths are attached.

### Cage 6 — Diff, security, and operability review

- Review the complete diff, not only files remembered by the author.
- Search for secrets, `any`, assertions, debug logs, unbounded structures, direct environment reads, missing tenant predicates, swallowed errors, and dead compatibility code.
- Confirm dashboards, alerts, runbook, rollback, flag ownership, and migration notes are updated.
- Confirm documentation describes actual behavior rather than intended future behavior.

**Exit:** reviewer can explain the change, failure mode, and rollback from the evidence package.

### Cage 7 — Canary and closure

- Deploy with the declared flag/cohort.
- Observe for the phase-defined minimum window and sample size.
- Compare against baseline SLOs, correctness signals, resource use, and cost.
- Roll back immediately on a hard stop condition; do not debug by increasing exposure.
- Remove temporary instrumentation only after permanent metrics cover the same risks.

**Exit:** acceptance evidence is archived, the ticket is `COMPLETE`, and follow-up/deletion work is recorded.

## 5. Verification evidence template

Each ticket MUST add or attach an evidence record using this structure:

```markdown
# <ticket>: <outcome>

- Phase / track:
- Invariant:
- Scope and forbidden scope:
- Dependencies:
- Risk classification: low | medium | high
- Rollback / kill switch:
- Baseline commit and environment:
- Pre-existing failures:

## Red evidence
<test and expected failure>

## Green evidence
<exact commands and summarized results>

## Adversarial cases
<automated negative-path evidence>

## Performance / cost evidence
<before, after, method, sample size>

## Canary
<cohort, start/end, dashboards, stop conditions, result>

## Residual risks and follow-ups
<explicit list>
```

Secrets, personal data, access tokens, SDP, and production payloads MUST NOT be copied into evidence.

## 6. Baseline command contract

Phase 0 will normalize scripts so the following commands become the repository contract:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
npm run test:e2e
npm run test:contracts
```

Until those scripts exist, agents MUST run the closest workspace-specific commands and record the gap. An absent script is not a passing check. Cloudflare-managed behavior and production-scale load tests remain explicit staging gates rather than default local commands.

## 7. Hard stop conditions

Stop the rollout or change immediately when any of these occurs:

- Cross-tenant or unauthorized access is possible.
- Data loss, duplicate billing, unrecoverable recording loss, or destructive migration behavior is observed.
- Secrets or private media/document data reach logs or client bundles.
- Error rate, join success, time-to-first-media, reconnect recovery, or spend breaches the phase threshold.
- Rollback is unavailable or untested for a high-risk change.
- Results cannot be reproduced or monitoring cannot distinguish old and new paths.

The response to a hard stop is containment and rollback first, diagnosis second, and renewed canary only after a new verification cycle.
