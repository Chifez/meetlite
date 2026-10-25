# MeetLite Scaling Execution Plan

This track changes the platform's deployment, capacity, runtime isolation, and operational controls. It is governed by the [execution standard](README.md) and the [architecture blueprint](../phased-scaling-execution-plan.md).

Scaling work MUST preserve product behavior unless the ticket explicitly declares a product policy change. Refactoring necessary to create a safe scaling seam is executed under the corresponding phase of the [refactoring track](refactoring-execution-plan.md).

## S0 — Baseline, safety, and measurable operations

### Outcome

Create a trustworthy baseline before moving traffic or state. The current system can be built, tested, observed, backed up, and restored without relying on undocumented operator knowledge.

### Entry gate

- Current local deployment starts from documented commands.
- Existing failures and dirty worktree state are recorded.
- Owners exist for database, identity, room/media, storage, and queue operations.

### Execution slices

1. **CI and verification foundation**
   - Pin and document the supported Node/npm versions.
   - Add canonical root scripts for format check, lint, type-check, unit, integration, contract, build, and E2E tests.
   - Cache dependencies without caching generated secrets or environment-specific artifacts.
   - Require all touched workspaces plus interface consumers to pass.
2. **Safe database delivery**
   - Back up the current database and restore it into an isolated environment.
   - Create a reviewed Prisma baseline migration and mark it applied on databases that already contain the schema.
   - Replace destructive startup `db push` with a one-shot `prisma migrate deploy` job.
   - Ensure application replicas wait for migration completion but never run migrations independently.
3. **Process-role isolation**
   - Run HTTP, queue worker, and scheduler as separate entry points and containers.
   - Ensure scaling an HTTP process cannot multiply cron or worker execution.
   - Give every scheduled job a lease/idempotency strategy and reconciliation path.
4. **Configuration and secrets**
   - Remove fallback passwords and JWT secrets.
   - Validate required configuration before binding a port or accepting a queue job.
   - Separate development, test, staging, and production credentials.
5. **Operational baseline**
   - Implement liveness, readiness, and startup semantics.
   - Propagate correlation IDs across gateway, modules, database, queue, and media operations.
   - Record baseline request latency, error rate, queue age, database connections, room join success, media quality, memory, and current cost.
   - Define initial SLOs, alerts, log retention, backup retention, RPO, and RTO.

### Required verification

- Clean checkout installs reproducibly and passes the canonical checks.
- Three HTTP replicas process no cron or queue work; dedicated processes process each idempotent test job once logically under forced redelivery.
- PostgreSQL failure makes readiness fail within the timeout while liveness remains healthy.
- A production-like backup restores and passes row-count, constraint, and application smoke checks.
- Missing required secrets cause deterministic startup failure without revealing values.

### Exit gate

- Global CI is green or every accepted pre-existing failure has an owner and deadline.
- Restore drill meets the initial RPO/RTO.
- Dashboards can compare every later canary with this baseline.
- Rollback and incident contacts are documented.

## S1 — Static delivery, private object storage, and database connection control

### Outcome

Remove static assets and large media transfer from the origin request path while bounding database connections.

### Dependencies

- S0 complete.
- R0 and R1 complete.
- The private object-storage interface and its authorization invariants are approved before implementation; the broader recording lifecycle remains R4 work.

### Execution slices

1. Deploy immutable frontend assets to Cloudflare Pages with hashed caching and revalidated HTML.
2. Establish a staging Cloudflare Tunnel route; retain current ingress as an explicit rollback until Phase S4.
3. Implement private R2 multipart upload with trusted key allocation, part limits, checksums, completion validation, abort, retention, and orphan cleanup.
4. Authorize playback independently from upload. Do not expose the bucket publicly.
5. Move origin Prisma traffic to Neon's pooled endpoint; reserve direct connections for migrations.
6. Set per-process pool limits from an explicit connection budget:

```text
database connection budget ≥ replicas × pool per replica + workers + migration/admin reserve
```

### Required verification

- A 500 MB upload bypasses Node request-body buffering and does not cause an origin-memory spike.
- Cross-tenant allocate, upload, complete, read, and delete attempts are denied without revealing object existence.
- Expired parts can be refreshed; incomplete uploads are aborted; mismatched parts/checksums do not finalize.
- Static assets remain available during a controlled origin outage.
- 1,000 concurrent representative origin requests produce no connection-pool exhaustion.
- Page caching does not cache authenticated HTML/API responses.

### Rollout

Internal users → staging recordings → 1% production uploads → 10% → 50% → 100%. Hold each stage long enough to include slow/interrupted uploads.

### Exit gate

- Origin upload bandwidth and memory reduction are measured.
- Storage lifecycle and restore/playback paths are documented.
- The old upload route is disabled for new uploads but retained behind the rollback flag until the observation window ends.

## S2 — Cloudflare room coordination and managed SFU vertical slice

### Outcome

Run one complete meeting-room path through edge identity, one Durable Object per room, and Cloudflare Realtime SFU without exposing provider credentials.

### Dependencies

- S1 complete.
- R2 identity/tenant hardening complete.
- R3 room and media module interfaces complete.
- Cloudflare staging app, account limits, and secret handling approved.

### Execution slices

1. Build a Worker that verifies asymmetric identity and exchanges it for a short-lived, single-use, room-bound capability.
2. Resolve a canonical room ID to exactly one Durable Object.
3. Persist membership generations, revisions, moderator state, publication locators, and cleanup intent in DO SQLite.
4. Bind WebSocket identity to the verified membership attachment.
5. Create separate publisher and subscriber SFU sessions per participant.
6. Serialize negotiation independently per session and reject stale generations/answers.
7. Commit publication discovery only after successful negotiation.
8. Implement explicit-leave cleanup and separately timed abandoned-session reconciliation.
9. Instrument join stages, negotiation, first remote frame, session replacement, cleanup backlog, and estimated egress.

### Required verification

- Automated real-browser tests cover two- and four-participant camera, microphone, screen share, subscribe/unsubscribe, role denial, explicit leave, abandonment, and reconnect.
- App Secret is absent from bundles, browser traffic, errors, and logs.
- Same-session concurrent mutations serialize; independent participant sessions make progress concurrently.
- Hibernation reconstructs identity and room state while sockets remain usable.
- Runtime restart/deploy reconnects clients without accepting stale generations.
- Provider timeout, partial cleanup, and duplicate commands converge without leaked publications or unauthorized state.

### Capacity ladder

Do not jump directly to the target. Pass each repeatable stage:

```text
1 room → 10 rooms → 100 rooms → 1,000 rooms → 5,000 rooms
```

Protocol generators certify signaling and room coordination. Real browsers certify WebRTC behavior. Both are required; neither substitutes for the other.

### Exit gate

- Regional p50/p95/p99 join and first-media targets are established from evidence.
- Four-person resource and egress measurements reconcile with provider reporting within the accepted error band.
- Required Cloudflare limits and support path are confirmed before production canary.
- Legacy Mediasoup remains untouched and available.

## S2.5 — Recording capture proof and production choice

### Outcome

Choose the capture engine that can satisfy the product promise. R2 remains storage, not capture.

### Dependencies

- S2 vertical slice stable.
- R4 recording interface and idempotent processing workflow available.

### Execution slices

1. Write the product guarantee: whether recording survives host/browser departure, supported layouts, consent, retention, residency, and maximum duration.
2. Prototype designated-browser composite, server recorder participant, and per-track capture only as far as needed to reject or select them.
3. Measure capture compute, subscribed SFU egress, upload, storage, post-processing, and transcription per recorded hour.
4. Validate synchronization, screen share, reconnect, part retry, finalization, and deletion.
5. Record the decision and rejected alternatives in an ADR.

### Required verification

- Sixty-minute four-person recording with screen share produces playable synchronized output.
- If continuity is promised, recording survives host departure and recorder replacement.
- Killing capture/upload/processing at controlled points resumes without duplicate records or orphaned multipart uploads.
- Unauthorized playback and cross-tenant identifiers are denied.

### Exit gate

- One model meets correctness and cost limits.
- Capacity and failure model are known.
- Mediasoup recording remains the production default until the selected adapter completes canary.

## S3 — Production canary and client migration

### Outcome

Move new rooms gradually to Cloudflare while preserving room-level rollback.

### Dependencies

- S2 and S2.5 complete.
- R3/R4 client modules and characterization tests complete.

### Execution slices

1. Route at room creation using a stable, auditable flag; pin the selected media engine for the room lifetime.
2. Start with staff and synthetic rooms, then 1%, 5%, 10%, 25%, 50%, and 100% of eligible new rooms.
3. Segment telemetry by engine, browser, device class, geography, network type, room size, and publication type.
4. Compare join success, first media, disconnect/reconnect, packet loss, jitter, CPU, memory, battery, support incidents, and cost.
5. Preserve Mediasoup capacity until the full observation window closes.

### Hard rollback conditions

- Any authorization or tenant-isolation failure.
- Meaningful recording loss/corruption.
- Join success or first-media SLO exceeds its error budget.
- Client crash, battery, or memory regression above the accepted threshold.
- Cost estimate exceeds its guardrail or cannot be reconciled.

### Exit gate

- Cloudflare meets the declared SLO for a statistically useful sample and full observation window.
- New-room rollback has been exercised.
- Active rooms are never switched between engines.
- The legacy path is still available until S6 deletion.

## S4 — Edge ingress and request-bound trust

### Outcome

Make Cloudflare the only public ingress and ensure the origin trusts cryptographic assertions, not spoofable headers or network location.

### Dependencies

- S3 canary stable.
- R2 request-principal and authorization migration complete.

### Execution slices

1. Deploy at least the required number of Tunnel connectors across independent failure domains.
2. Strip all client identity/assertion headers at the edge.
3. Sign short-lived request assertions bound to method, normalized path, audience, request ID, and key ID.
4. Validate assertions at the origin with clock-skew bounds and overlapping key rotation.
5. Remove or protect alternate hostnames and direct origin access.
6. Apply rate limits and abuse controls by trusted subject/tenant plus network signals; do not use IP alone as identity.

### Required verification

- Forged headers, wrong audience/path/method, expired assertion, replay, and retired key are rejected.
- Key rotation has no outage during the overlap window and rejects the old key afterward.
- Direct origin and bypass hostnames are unreachable externally.
- Connector failure leaves traffic available when availability requirements demand redundancy.

### Exit gate

- External exposure scan and application tests find no bypass.
- Origin logs contain a verifiable edge request ID without containing credentials.
- Emergency access and assertion-key rollback are documented and audited.

## S5 — Collaboration durability and justified edge database access

### Outcome

Bound collaboration-state growth and recovery time without turning pointer movement into an unbounded durable write stream.

### Dependencies

- S2 room durability stable.
- R5 collaboration module complete.

### Execution slices

1. Classify events as durable operations, replaceable awareness, or derived state.
2. Batch durable Yjs updates by count/time, enforce message/document/write-rate limits, and compact into snapshots.
3. Restore from snapshot plus bounded deltas; export checkpoints and completion snapshots to private R2.
4. Reconcile abandoned rooms that never emit an orderly completion event.
5. Add Hyperdrive only for measured Worker database access. Separate cached stale-tolerant reads from fresh authorization/billing reads.

### Required verification

- Forced hibernation/restart/reconnect produces zero committed-operation loss.
- Awareness events may be dropped without corrupting the document.
- Long-running document recovery and storage stay within declared bounds after compaction.
- Corrupt/missing snapshot recovery follows a tested fallback.
- Fresh security decisions never use stale cached data.

### Exit gate

- Recovery latency, storage growth, and write amplification meet measured targets.
- Hyperdrive has evidence of benefit; otherwise it is not deployed.

## S6 — Viral-scale resilience, commercial controls, and legacy retirement

### Outcome

Prove bounded degradation under surge and failure, enforce spend/admission policy, and remove legacy capacity only after replacement evidence is complete.

### Dependencies

- S0–S5 complete.
- R6 deletion readiness complete.
- Vendor quota increases and test authorization secured.

### Execution slices

1. Enforce room, tenant, role/publisher, duration, message, upload, document, and reconnect limits at authoritative modules.
2. Maintain an application-side media usage estimate with conservative headroom; compare it with provider reports.
3. Configure commercial review alerts at $10k, $50k, and $250k projected monthly spend and a separately approved admission response.
4. Run distributed signaling load, reconnect storms, database cold start, Redis interruption, DO hibernation, provider timeout, and browser media tests.
5. Test hot rooms separately from many small rooms; webinar mode limits publishers explicitly.
6. Freeze new Mediasoup room creation, drain active rooms, archive required artifacts, then remove containers, code, dependencies, flags, secrets, ports, dashboards, and runbooks.

### Capacity acceptance

Target-scale acceptance requires evidence for both:

- **Horizontal distribution:** the intended concurrent rooms/users across distributed generators.
- **Hot partition:** the largest supported room with permitted publisher/subscriber topology.

The report MUST state duration, ramp, geography, client type, bitrate, failure injection, p50/p95/p99, sample size, provider limits, and cost. A brief protocol-only spike does not certify 200k WebRTC participants.

### Exit gate

- Admission and spend controls fail closed where required and have an audited override.
- Reconnect and dependency-failure tests stay within error budgets without data corruption.
- Provider and application usage estimates reconcile within the accepted tolerance.
- Legacy deletion passes build, dependency, deployment, security, and rollback-readiness checks.
- The blueprint and operational runbooks describe only the surviving production architecture.
