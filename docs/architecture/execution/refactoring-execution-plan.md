# MeetLite Refactoring Execution Plan

This track improves code structure and safety without pretending that moving code alone creates scale. It follows the [execution standard](README.md) and supplies the tested module seams required by the [scaling track](scaling-execution-plan.md).

Unless a ticket explicitly changes product behavior, observable behavior MUST remain unchanged. Every extraction starts with characterization tests and ends with deletion of the superseded path—never a permanent second layer of indirection.

## R0 — Test harness, repository contract, and characterization

### Outcome

Make the current behavior observable and reproducible before altering large modules.

### Repository findings addressed

- TypeScript strict mode exists, but backend packages lack standard lint/test scripts.
- There are effectively no discoverable automated unit or integration tests.
- TypeScript and Node type versions differ across workspaces.
- Critical implementations exceed 500–1,000 lines, including `use-mediasoup.tsx`, recording, meeting, payment, media, and collaboration modules.

### Execution slices

1. Choose and pin one supported Node/npm toolchain and a compatible TypeScript policy across workspaces.
2. Configure formatter, ESLint, unit runner, coverage reporting, API integration harness, and real-browser E2E harness.
3. Add root scripts defined by the execution standard without hiding missing workspace scripts behind successful no-op commands.
4. Create deterministic fakes for clock, IDs, mail, payment, object storage, queue publication, and media room backend.
5. Add characterization tests around:
   - Authentication/refresh/revocation behavior.
   - Tenant and team authorization.
   - Meeting creation/admission/plan limits.
   - Recording authorization and lifecycle.
   - Existing Mediasoup join/publish/subscribe/reconnect behavior.
   - Queue job payloads and retry behavior.
6. Add contract fixtures for public HTTP responses, room events, queue jobs, and configuration validation.

### Rules specific to R0

- Do not chase a coverage percentage by testing framework glue.
- Cover security invariants, state transitions, and failure paths first.
- Snapshot tests may protect stable serialized contracts; they MUST NOT replace semantic assertions.
- Networked dependencies are forbidden in unit tests.

### Exit gate

- Canonical checks run locally and in CI.
- A deliberately introduced failure in each workspace makes CI fail.
- Critical legacy behavior has characterization coverage sufficient for safe extraction.
- Test runs are deterministic and do not depend on execution order.

## R1 — Composition roots, configuration, health, workers, and schedulers

### Outcome

Make process roles explicit and isolate startup wiring from business behavior.

### Target modules

- `backend/packages/*/src/index.ts`
- `backend/packages/*/src/config/`
- `backend/packages/auth-service/src/jobs/`
- `backend/packages/room-service/src/jobs/`
- `backend/packages/shared/src/queues/`

### Execution slices

1. Extract one typed configuration module per deployable process. Validate once; inject the result.
2. Split each entry point into:
   - composition root,
   - HTTP application factory,
   - server lifecycle,
   - worker entry point,
   - scheduler entry point.
3. Move health semantics into a small module with dependency probes and strict timeouts.
4. Replace import-time cron/worker side effects with explicit `start()`/`stop()` lifecycle controlled by the composition root.
5. Implement graceful shutdown ordering: stop admission, drain HTTP, stop schedules, pause/close workers, flush telemetry, close database/Redis.
6. Introduce durable job intent/outbox or reconciliation for database mutations that require eventual queue work.

### Forbidden shortcuts

- No global singleton created during module import.
- No `process.env` reads outside configuration modules.
- No HTTP replica that silently starts a worker or cron.
- No readiness check that reports healthy based only on process uptime.

### Exit gate

- Application factories start in tests without opening real sockets.
- Worker and scheduler processes can run independently and stop cleanly.
- Forced termination/redelivery does not duplicate logical side effects.
- S0 process-isolation checks pass.

## R2 — Identity, authorization, and tenant-safe data access

### Outcome

Provide one verified-principal model and make insecure data access difficult to express.

### Target modules

- Auth middleware/controllers/token utilities.
- API Gateway identity forwarding.
- Room-service and auth-service authorization modules.
- Prisma repository adapters for tenant-owned resources.

### Execution slices

1. Define `VerifiedPrincipal` and request context as the only accepted authenticated identity interface.
2. Centralize token verification, algorithm/issuer/audience checks, expiry, session version, and stable error mapping.
3. Implement hashed rotating refresh-token families with reuse detection and transactional rotation.
4. Replace controller-local JWT decoding and `any` claims with the verified-principal module.
5. Express authorization as domain operations such as `authorizeMeetingAction` and `authorizeRecordingAction`, returning a decision or typed denial.
6. Move Prisma access behind tenant-aware repository methods whose required input includes trusted tenant scope.
7. Add request-bound internal assertion verification for the origin without trusting `x-user-*` headers.
8. Add a security matrix covering anonymous, member, guest, admin, system admin, cross-tenant, removed member, expired entitlement, and stale session.

### Required patterns

- Route middleware authenticates; the application operation authorizes the concrete resource action.
- Not-found and forbidden behavior MUST not leak inaccessible tenant resource existence.
- Billing and plan entitlement checks are server-side and fresh where stale decisions create loss.
- Cache keys include tenant and authorization-relevant versioning.

### Exit gate

- No direct `jwt.verify` remains in controllers or feature modules.
- No new authenticated operation accepts caller identity/role as authority.
- Every tenant-owned repository operation has cross-tenant negative tests.
- S2/S4 identity and ingress prerequisites pass.

## R3 — Room coordination and media endpoint deep modules

### Outcome

Separate room authority, WebRTC negotiation, and React rendering so Cloudflare can be added without spreading provider logic across the codebase.

### Target modules

- Legacy Mediasoup controllers and implementations.
- `client/src/hooks/use-mediasoup.tsx` and related WebRTC hooks.
- New edge room-coordinator package.

### Required seams

1. **RoomCoordinator module**
   - Owns admission, membership generations, revisions, moderator commands, publication catalog, and cleanup intent.
   - Accepts only a verified connection context.
2. **MediaEndpoint module**
   - Owns publisher/subscriber PeerConnections, negotiation queues, track binding, generation replacement, and cleanup.
   - Exposes intents/results; hides SDP ordering and provider locators from React views.
3. **Room client state machine**
   - Uses explicit states such as `idle`, `joining`, `connected`, `reconnecting`, `leaving`, `failed` with substates for publisher/subscriber readiness.
   - Defines allowed transitions and terminal cleanup.

### Execution slices

1. Characterize existing join/publish/subscribe/screen-share/reconnect/leave behavior.
2. Extract provider-neutral domain values only where they are genuinely shared: publication ID, media kind, membership generation, room revision, and typed errors.
3. Wrap legacy Mediasoup behind the new browser-facing module first; behavior remains unchanged.
4. Add an in-memory fake adapter for deterministic state-machine tests.
5. Add the Cloudflare adapter with separate publisher/subscriber queues.
6. Move track/device cleanup and event listener lifecycle into the module.
7. Reduce React hooks/views to state selection and intent dispatch.

### Forbidden shortcuts

- Do not create a generic `IMediaProvider` exposing every provider operation.
- Do not expose Cloudflare session IDs, Mediasoup transport objects, raw provider errors, or App Secrets through the interface.
- Do not make React effects the authoritative negotiation state machine.
- Do not migrate an active room between adapters.

### Exit gate

- Both legacy and Cloudflare adapters satisfy the same behavioral contract where behavior is intentionally shared.
- Fake-adapter tests cover race, stale generation, duplicate event, reconnect, and cleanup.
- Real-browser tests cover behavior that mocks cannot prove.
- `use-mediasoup.tsx` is either a thin compatibility adapter or removed after rollout, not a second implementation.

## R4 — Recording, object storage, and asynchronous processing

### Outcome

Replace large controller-centered recording logic with an authorized lifecycle and idempotent processing workflow.

### Target modules

- `room-service/src/controllers/recording.controller.ts`
- `room-service/src/services/cloudflare-r2.service.ts`
- Mediasoup recording controller/implementation.
- Video processing queue and worker.

### Recording state machine

```text
REQUESTED → CAPTURING → UPLOADING → UPLOADED → PROCESSING → READY
      ↘ CANCELLED       ↘ ABORTED       ↘ FAILED ↗
```

Every transition MUST define actor, authorization, precondition, idempotency key, durable mutation, emitted job/event, and retry behavior.

### Execution slices

1. Characterize recording creation, upload, sharing, processing, playback, retention, and deletion.
2. Create a small recording lifecycle module independent of Express, Multer, R2 SDK, and the selected capture engine.
3. Create an object-storage adapter that allocates trusted keys and encapsulates multipart operations.
4. Replace memory/disk proxy uploads with direct private multipart transfer for supported paths.
5. Move processing to versioned idempotent jobs with durable status and reconciliation.
6. Separate playback authorization from object location.
7. Add capture adapters only after S2.5 chooses the production model.

### Required verification

- State transitions reject skips and conflicting duplicate commands.
- Processing can restart after every durable checkpoint.
- Delete/retention behavior handles database record, object bytes, derivatives, and queued work consistently.
- Large files never become a single origin `Buffer`.
- Share/playback grants cannot cross tenant, recording, permission, or expiry boundaries.

### Exit gate

- The 979-line controller is reduced to transport mapping plus calls into tested modules.
- Capture, storage, metadata, authorization, and processing have distinct ownership.
- S1 storage and S2.5 recording gates pass.

## R5 — Collaboration state, chat, and bounded persistence

### Outcome

Separate durable document operations from ephemeral awareness and make recovery deterministic.

### Target modules

- Yjs/Tldraw browser providers.
- Mediasoup collaboration/Yjs controllers and implementations.
- Durable Object collaboration implementation.

### Execution slices

1. Define the collaboration document interface and versioned message envelope.
2. Classify chat, document updates, awareness, cursors, reactions, and derived presence.
3. Bind every room message to socket membership; remove sender selection from payloads.
4. Add revision/sequence and deduplication for durable operations.
5. Coalesce/drop stale awareness under backpressure.
6. Batch and compact Yjs persistence; export/import versioned snapshots.
7. Add deterministic convergence tests with reordered, duplicated, delayed, and missing messages.
8. Bound document size, update size, batch size, retained deltas, awareness rate, and recovery work.

### Exit gate

- Multiple clients converge after reconnect and injected reordering/duplication.
- Committed updates survive hibernation/restart.
- Ephemeral state loss does not corrupt durable state.
- Snapshot compatibility and corrupt-snapshot fallback are tested.
- S5 durability gates pass.

## R6 — Simplification, legacy deletion, and architecture enforcement

### Outcome

Remove compatibility layers and make the intended architecture mechanically difficult to violate.

### Dependencies

- Scaling canary and observation windows complete.
- No active room or recording depends on legacy state.
- Rollback decision explicitly allows legacy removal.

### Execution slices

1. Stop new legacy room/recording allocation and drain existing work.
2. Query telemetry, logs, configuration, and data for remaining legacy consumers.
3. Remove Mediasoup code, dependencies, Docker services, ports, environment variables, client flags, generated assets, dashboards, and runbooks in reviewable slices.
4. Remove expired dual-read/write code, old event versions, deprecated routes, and migration shims.
5. Add dependency rules/lint checks that enforce module direction and prevent direct provider/config/database imports from forbidden layers.
6. Re-run security, license, dependency, dead-code, bundle-size, container-size, and full browser regression checks.
7. Update architecture decision records and ownership documentation to the surviving system.

### Deletion proof

Before deletion, provide evidence for:

- Zero new legacy allocations.
- Zero active legacy sessions/jobs.
- Required historical data migrated or intentionally retained with a reader.
- New path meets SLO/cost/error budgets for the full observation window.
- Rollback after deletion is either a tested artifact redeploy or explicitly accepted as forward-fix only.

### Exit gate

- Repository search finds no runtime Mediasoup imports, secrets, configuration, routes, images, or deployment resources.
- All canonical checks, staging E2E, and production smoke tests pass.
- No compatibility module exists without a named consumer and removal ticket.
- Module interfaces, dependency direction, and security rules are enforced by tests or linting rather than documentation alone.

## Refactoring completion definition

The refactoring track is complete only when:

1. Critical behavior is covered at the appropriate interface.
2. Large modules have been deepened or split by ownership, not merely divided into arbitrary files.
3. Transport, policy, persistence, provider, and UI concerns have explicit dependency direction.
4. Authentication and tenant authorization are consistent and deny by default.
5. Workers and schedulers are independent, idempotent processes.
6. Legacy paths and temporary flags are removed after safe rollout.
7. The repository-wide verification contract is green and reproducible from a clean checkout.
