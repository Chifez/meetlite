# Meeting lifecycle, timezone, invitation, and recurrence implementation plan

**Status:** Proposed

**Date:** 2026-10-28

**Scope:** Meeting scheduling, recurrence, lifecycle capabilities, invitations, reminders, and meeting-list UX

**Research basis:** [Scheduling and meeting UX benchmarks](../research/scheduling-and-meeting-ux-benchmarks-2026-10-28.md)

## 1. Outcome

MeetLite will have one server-owned meeting model in which:

- a scheduled instant is stored in UTC and paired with the organizer-selected IANA timezone;
- a recurring series is a template, not a joinable meeting;
- each joinable occurrence has a stable identity, UTC instant, lifecycle state, and room relationship;
- recurrence expansion preserves local wall-clock intent across daylight-saving changes;
- start, join, leave, and end-for-all capabilities come from server policy rather than client-clock inference;
- meeting mutations and email, calendar, reminder, and materialization work are connected through a transactional outbox;
- creation, expansion, editing, cancellation, notification, and retry are idempotent;
- React views render a typed meeting state and dispatch intent without owning business policy.

This is a behavioral correction and a refactor. It should ship as tracer bullets with expand/migrate/contract database changes, not as one large rewrite.

## 2. Confirmed diagnosis

### 2.1 Reproduction evidence

Three deterministic probes against the current implementation fail:

1. **DST wall-clock drift:** a weekly 09:00 `America/New_York` series generated from `2026-03-01T14:00:00Z` produces 09:00, 10:00, 10:00 locally across the March DST transition.
2. **Schema drift:** `createRecurrenceInstances` queries `recurrenceId`, while the Prisma schema and initial migration define `parentRecurrenceId`.
3. **Duplicate first occurrence:** the parent meeting stores `DTSTART`, and expansion materializes that same `DTSTART` again as a child.

The UI preview also disagrees with the backend. Starting a monthly series on January 31, `date-fns/addMonths` previews January 31, February 28, March 28, while RFC-style `BYMONTHDAY=31` expansion produces January 31, March 31, May 31.

### 2.2 Critical findings

| Severity | Finding | Evidence | User-visible consequence |
| --- | --- | --- | --- |
| P0 | Persistence code uses `recurrenceId`; schema uses `parentRecurrenceId`. | `recurrence.service.ts:368-435`, `schema.prisma:195-228` | Instance lookup/create/cancel fails at runtime. |
| P0 | Initial expansion errors are swallowed after the parent row is committed. | `meeting.controller.ts:166-236` | API reports successful creation for a series with no valid occurrences. |
| P0 | Recurrence is defined against UTC rather than an event timezone. | `recurrence.service.ts:17-95` | Weekly local times shift at DST boundaries. |
| P0 | The series parent is also treated as an occurrence and `DTSTART` is expanded inclusively. | `meeting.controller.ts:166-236`, `recurrence.service.ts:380-440` | First occurrence can appear twice. |
| P0 | There is no uniqueness constraint for a series occurrence. | `schema.prisma:195-228` | Concurrent schedulers or retries can create duplicates. |
| P0 | Instance nested writes do not match Prisma relation-write shapes and can copy relation IDs/tokens. | `recurrence.service.ts:415-435` | Expansion fails or attempts invalid participant/invite records. |
| P0 | Deleting a series hard-deletes its parent even when cancellation fails. | `meeting.controller.ts:674-692` | Future instances may be orphaned and reminders may remain active. |
| P1 | The scheduler has no lease, claim, revision check, or durable materialization intent. | `recurrence.job.ts:10-75` | Multiple replicas race; failures retry only on the next cron run. |
| P1 | The 30-day materialization path does not create occurrence invitations or reminders. | `recurrence.job.ts:44-58` | Later occurrences silently lack delivery and reminder behavior. |
| P1 | Updating a recurring parent has no explicit `this`, `following`, or `series` scope. | `meeting.controller.ts:468-646` | Edits can mutate the wrong row without regenerating occurrences. |
| P1 | The exception table exists but is unused and identifies exceptions by a timestamp without a timezone-stable occurrence key. | `schema.prisma:257-266` | Moved/cancelled single occurrences are not reliably modeled. |
| P1 | List and calendar filters use the obsolete `recurrenceId` client property. | `meeting-list-section.tsx:67-80`, `meeting-calendar-section.tsx:13-18` | Parents and occurrences are hidden or duplicated inconsistently. |
| P1 | The recurrence preview implements a second recurrence engine. | `meeting-form-recurrence.tsx:65-117` | Preview dates differ from dates that the backend creates. |
| P1 | `generateOccurrences` calls `rule.all()` before applying its limit. | `recurrence.service.ts:105-116` | An unbounded rule can consume excessive CPU/memory. |
| P1 | Date matching and deduplication truncate UTC ISO dates. | `recurrence.service.ts:157-165`, `recurrence.service.ts:374-395` | Occurrences near midnight or in non-UTC zones collide or mismatch. |
| P2 | Validation accepts `custom` without requiring an RRULE and does not validate `endType` exhaustively. | `recurrence.service.ts:251-340` | Invalid recurrence input reaches runtime generation. |
| P2 | Count, interval, end-date, monthly-31, and leap-day policies are not consistent between UI and server. | Recurrence form and service | Users cannot predict the resulting series. |

### 2.3 Root cause

The code has no single recurrence or meeting-lifecycle owner:

```text
React recurrence preview ─┐
form payload conversion ──┼── each interprets date/time/recurrence independently
meeting controller ───────┤
recurrence service ───────┤
daily cron scheduler ─────┤
notification service ─────┤
meeting list CTA logic ───┘
```

The missing seam causes schema names, time semantics, recurrence behavior, and lifecycle rules to drift independently.

## 3. Product decisions and invariants

### 3.1 Terms

- **Series:** the reusable recurrence definition and shared meeting metadata. It is not joinable and never owns a room.
- **Occurrence:** one concrete, joinable meeting produced by a series. A non-recurring meeting is also an occurrence, with no series ID.
- **Occurrence key:** immutable series-local identity derived from the intended original local start, for example `2026-03-08T09:00:00` within `America/New_York`.
- **Scheduled instant:** the occurrence start as an absolute UTC timestamp.
- **Event timezone:** the organizer-selected IANA timezone used to interpret local date/time and expand future occurrences.
- **Exception:** a cancellation or override targeting one immutable occurrence key.
- **Lifecycle state:** server-owned state such as `scheduled`, `live`, `ended`, or `cancelled`.
- **Capability:** a server decision that tells one principal whether an action is currently allowed and why.

### 3.2 Primary invariants

1. A series template cannot be started, joined, ended, recorded, or assigned a room.
2. Every joinable occurrence has exactly one public meeting ID.
3. For a series, `(seriesId, occurrenceKey)` is unique.
4. Moving an occurrence changes its scheduled instant but not its occurrence key.
5. UTC instants are used for ordering and delays; the IANA zone and local recurrence intent are retained for expansion and display.
6. DST expansion preserves local wall-clock time. A weekly 09:00 meeting remains 09:00 in its event timezone.
7. Invalid or ambiguous local times follow an explicit policy and are never silently interpreted by the browser timezone.
8. A meeting lifecycle transition is authorized and validated by the server operation that performs it.
9. A durable database mutation and its required asynchronous side effects are committed together through an outbox record.
10. Materialization and side-effect workers tolerate retries and concurrent execution.
11. Existing occurrences are never identified or deduplicated by title or UTC calendar date.
12. Historical ended occurrences remain attached to their series after the series is cancelled.

### 3.3 Recurrence policies

Adopt these explicit behaviors:

- `COUNT` includes the first occurrence.
- `UNTIL` is inclusive when the occurrence start is on or before the resolved end-of-day in the event timezone.
- Monthly day 29, 30, or 31 follows RFC behavior: skip months that do not contain that date. The UI must say this and preview the exact results.
- February 29 yearly recurrence skips non-leap years.
- A nonexistent spring-forward local time is rejected at creation/edit time with a suggested next valid time.
- An ambiguous fall-back local time requires an explicit earlier/later offset selection; defaulting silently is forbidden.
- “Never ends” is allowed, but only a bounded rolling horizon is materialized.
- Supported initial patterns are daily, weekdays, weekly, monthly-by-date, and yearly-by-date. Unsupported arbitrary RRULE parts are rejected at ingress until the UI and engine support them.

## 4. Target architecture

### 4.1 Modules and dependency direction

```text
HTTP handler
  → MeetingApplication
      → MeetingPolicy
      → RecurrenceEngine
      → MeetingRepository
      → TransactionalOutbox

recurrence scheduler
  → OccurrenceMaterializer
      → RecurrenceEngine
      → MeetingRepository
      → TransactionalOutbox

outbox publisher
  → versioned queue jobs
      → InvitationWorker / ReminderWorker / CalendarWorker

React view
  → meeting controller hook
      → meeting view-state reducer
      → HTTP adapter
```

The deep modules are:

| Module | Small interface | Owns | Does not own |
| --- | --- | --- | --- |
| `MeetingApplication` | `create`, `update`, `cancel`, `start`, `end`, `getView` | Orchestration, transaction boundaries, typed errors | Prisma queries, RRULE mechanics, React state |
| `RecurrenceEngine` | `validate`, `preview`, `expand` | Zoned recurrence semantics and occurrence keys | Persistence, email, authorization |
| `OccurrenceMaterializer` | `materialize(seriesId, window)` | Idempotent rolling expansion | Cron lifecycle, UI formatting |
| `MeetingPolicy` | `capabilities`, `authorizeMutation` | Role/access/lifecycle rules | Database queries and HTTP responses |
| `InvitationApplication` | `planDelivery(event)` | Invite/update/cancel/RSVP semantics | SMTP/provider mechanics |
| `MeetingRepository` | Tenant-scoped aggregate operations | Prisma mechanics and tenant predicates | Business policy |

### 4.2 Chosen patterns

- **Deep module:** timezone, recurrence, materialization, and lifecycle policy stay behind small typed interfaces.
- **Transactional job:** meeting/series mutations write versioned outbox events in the same transaction; retriable workers perform email, calendar, reminder, and materialization side effects.
- **Compatibility pattern:** old meeting rows and fields remain readable while new series/occurrence fields are added and backfilled.
- **Strangler migration:** new series creation is routed through a typed feature flag by stable workspace cohort; old one-off meetings continue to work during rollout.

### 4.3 Rejected alternatives

**Keep the recurring parent as a meeting.** Rejected because it remains accidentally joinable, duplicates `DTSTART`, confuses list filtering, and couples series metadata to occurrence lifecycle.

**Generate occurrences virtually on every list request.** Rejected because rooms, reminders, recordings, RSVP state, exceptions, and audit history require stable occurrence IDs.

**Store only UTC.** Rejected because UTC alone cannot preserve organizer wall-clock intent across DST or reconstruct correct recurring behavior.

**Store only local time.** Rejected because ordering, reminders, concurrency, and cross-timezone display require an absolute instant.

## 5. Target data model

The exact migration syntax should be generated and reviewed through Prisma, but the target shape is:

```prisma
enum MeetingSeriesStatus {
  ACTIVE
  CANCELLED
  ENDED
}

enum MeetingStatus {
  SCHEDULED
  LIVE
  ENDED
  CANCELLED
}

model MeetingSeries {
  id                  String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  seriesId            String              @unique @map("series_id")
  organizationId      String?             @map("organization_id") @db.Uuid
  teamId              String?             @map("team_id") @db.Uuid
  createdBy           String              @map("created_by") @db.Uuid
  title               String
  description         String?
  durationMinutes     Int                 @map("duration_minutes")
  privacy             String
  timeZone            String              @map("time_zone")
  localStartDate      String              @map("local_start_date") // YYYY-MM-DD
  localStartTime      String              @map("local_start_time") // HH:mm:ss
  recurrenceRule      String              @map("recurrence_rule")
  status              MeetingSeriesStatus @default(ACTIVE)
  revision            Int                 @default(1)
  materializedThrough DateTime?           @map("materialized_through") @db.Timestamptz(3)
  createdAt           DateTime            @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt           DateTime            @updatedAt @map("updated_at") @db.Timestamptz(3)

  occurrences Meeting[]
  exceptions  MeetingRecurrenceException[]

  @@index([organizationId, status])
  @@index([teamId, status])
  @@map("meeting_series")
}

model Meeting {
  id                String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  meetingId         String        @unique @map("meeting_id")
  organizationId    String?       @map("organization_id") @db.Uuid
  teamId            String?       @map("team_id") @db.Uuid
  createdBy         String        @map("created_by") @db.Uuid
  title             String
  description       String?
  privacy           String
  seriesId          String?       @map("series_id") @db.Uuid
  occurrenceKey     String?       @map("occurrence_key")
  scheduledAt       DateTime      @map("scheduled_at") @db.Timestamptz(3)
  eventTimeZone     String        @map("event_time_zone")
  durationMinutes   Int           @map("duration_minutes")
  status            MeetingStatus @default(SCHEDULED)
  lifecycleRevision Int           @default(1) @map("lifecycle_revision")
  roomId            String?       @map("room_id")
  // Existing tenant, creator, title, privacy, participant relations remain.

  series MeetingSeries? @relation(fields: [seriesId], references: [id], onDelete: Restrict)

  @@unique([seriesId, occurrenceKey])
  @@index([organizationId, scheduledAt])
  @@index([seriesId, scheduledAt])
  @@map("meetings")
}

model MeetingRecurrenceException {
  id                String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  seriesId          String   @map("series_id") @db.Uuid
  occurrenceKey     String   @map("occurrence_key")
  kind              String   // CANCELLED | OVERRIDDEN
  overrideMeetingId String?  @map("override_meeting_id") @db.Uuid
  seriesRevision    Int      @map("series_revision")
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  series MeetingSeries @relation(fields: [seriesId], references: [id], onDelete: Restrict)

  @@unique([seriesId, occurrenceKey])
  @@map("meeting_recurrence_exceptions")
}

model OutboxEvent {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  eventId       String    @unique @map("event_id")
  aggregateType String    @map("aggregate_type")
  aggregateId   String    @map("aggregate_id")
  eventType     String    @map("event_type")
  schemaVersion Int       @map("schema_version")
  payload       Json
  occurredAt    DateTime  @map("occurred_at") @db.Timestamptz(3)
  publishedAt   DateTime? @map("published_at") @db.Timestamptz(3)
  attempts      Int       @default(0)
  lastErrorCode String?   @map("last_error_code")

  @@index([publishedAt, occurredAt])
  @@map("outbox_events")
}
```

The migration adds database check constraints for `local_start_date`, `local_start_time`, valid status values during compatibility, positive duration/revision, and the requirement that `occurrenceKey` is non-null whenever `seriesId` is non-null. Prisma validation alone is not the data-integrity boundary.

Use `onDelete: Restrict` for series history. Cancelling is a state transition, not a hard delete. Retention cleanup, if needed, is a separate policy-controlled job.

## 6. Typed interfaces and code examples

These samples define direction and interface shape. Ticket implementation must use repository types and validation conventions current at that time.

### 6.1 Ingress command

```ts
type LocalDate = string & { readonly __brand: 'LocalDate' };
type LocalTime = string & { readonly __brand: 'LocalTime' };
type IanaTimeZone = string & { readonly __brand: 'IanaTimeZone' };
type MeetingId = string & { readonly __brand: 'MeetingId' };
type MeetingSeriesId = string & { readonly __brand: 'MeetingSeriesId' };

type EndCondition =
  | { type: 'never' }
  | { type: 'count'; count: number }
  | { type: 'until'; localDate: LocalDate };

type RecurrenceSpec =
  | { frequency: 'daily'; interval: number; end: EndCondition }
  | { frequency: 'weekdays'; end: EndCondition }
  | {
      frequency: 'weekly';
      interval: number;
      weekdays: readonly number[];
      end: EndCondition;
    }
  | {
      frequency: 'monthlyByDate';
      interval: number;
      dayOfMonth: number;
      end: EndCondition;
    }
  | { frequency: 'yearlyByDate'; interval: number; end: EndCondition };

interface CreateMeetingCommand {
  title: string;
  description?: string;
  localDate: LocalDate;
  localTime: LocalTime;
  timeZone: IanaTimeZone;
  durationMinutes: number;
  privacy: 'public' | 'private';
  attendeeEmails: readonly string[];
  recurrence?: RecurrenceSpec;
  teamId?: string;
  idempotencyKey: string;
}
```

The HTTP schema validates date/time formats, IANA zone existence, bounds, attendee limits, end conditions, and mutually exclusive recurrence shapes once. Internal modules never accept `any` or raw request bodies.

### 6.2 Recurrence engine

Suggested files:

```text
backend/packages/room-service/src/meeting-domain/
  recurrence/recurrence-engine.ts
  recurrence/rrule-recurrence-engine.ts
  recurrence/recurrence-types.ts
  time/zoned-date-time.ts
```

```ts
interface OccurrenceSeed {
  occurrenceKey: string;
  localStart: string;
  scheduledAt: Date;
  offset: string;
}

interface ExpansionWindow {
  fromInclusive: Date;
  toExclusive: Date;
  limit: number;
}

interface RecurrenceEngine {
  validate(input: RecurrenceDefinition): Result<ValidatedRecurrence, RecurrenceError>;
  preview(input: ValidatedRecurrence, limit: number): readonly OccurrenceSeed[];
  expand(
    input: ValidatedRecurrence,
    window: ExpansionWindow,
  ): readonly OccurrenceSeed[];
}
```

`preview` and `expand` must call the same internal expansion implementation. The client must not implement recurrence arithmetic independently.

The initial adapter may use the existing `rrule` dependency plus a reviewed, direct timezone dependency. Luxon is already present transitively through `rrule`; if selected, declare it directly, record bundle/runtime impact, and round-trip local fields to detect nonexistent times. The adapter must prove ambiguous-time behavior in tests. Provider types remain private to the adapter.

Never call `rule.all()` for an unbounded rule. Always use a bounded window and limit:

```ts
const dates = rule.between(window.fromInclusive, window.toExclusive, true);
if (dates.length > window.limit) {
  return err({ code: 'RECURRENCE_EXPANSION_LIMIT' });
}
```

### 6.3 Materializer

```ts
interface MaterializeOccurrencesCommand {
  seriesId: MeetingSeriesId;
  expectedRevision: number;
  throughExclusive: Date;
  commandId: string;
}

interface MaterializationResult {
  created: number;
  existing: number;
  skippedExceptions: number;
  materializedThrough: Date;
}

interface OccurrenceMaterializer {
  materialize(command: MaterializeOccurrencesCommand): Promise<MaterializationResult>;
}
```

Pseudo-implementation:

```ts
await repository.inTransaction(async (tx) => {
  const series = await tx.lockSeries(command.seriesId);
  if (series.revision !== command.expectedRevision) {
    throw new DomainError('SERIES_REVISION_CONFLICT');
  }

  const seeds = recurrence.expand(series.definition, {
    fromInclusive: series.materializedThrough ?? series.firstInstant,
    toExclusive: command.throughExclusive,
    limit: 500,
  });

  for (const seed of seeds) {
    const occurrence = await tx.upsertOccurrenceByKey(series, seed);
    if (occurrence.created) {
      await tx.appendOutbox(occurrenceCreatedEvent(occurrence, series));
    }
  }

  await tx.advanceMaterializedThrough(series.id, command.throughExclusive);
});
```

The unique `(seriesId, occurrenceKey)` constraint is the final concurrency guard. `upsert` makes retries harmless. A stale series revision is rejected rather than materializing an obsolete rule.

### 6.4 Meeting capabilities

```ts
type CapabilityReason =
  | 'ALLOWED'
  | 'TOO_EARLY'
  | 'WAITING_FOR_HOST'
  | 'NOT_ORGANIZER'
  | 'NOT_INVITED'
  | 'ENDED'
  | 'CANCELLED'
  | 'ROOM_NOT_READY';

interface ActionCapability {
  allowed: boolean;
  reason: CapabilityReason;
  availableAt?: string;
}

interface MeetingCapabilities {
  start: ActionCapability;
  join: ActionCapability;
  leave: ActionCapability;
  endForAll: ActionCapability;
  update: ActionCapability;
  cancel: ActionCapability;
}

interface MeetingView {
  meeting: MeetingOccurrenceDto;
  viewerLocal: { startsAt: string; timeZone: string };
  eventLocal: { startsAt: string; timeZone: string };
  capabilities: MeetingCapabilities;
}
```

The list endpoint returns `MeetingView[]`, or a compact list projection with the same lifecycle and capability contract. Client clocks may update countdown labels, but they cannot change an action from denied to allowed without refreshing server state.

### 6.5 Explicit mutation scope

```ts
type RecurrenceMutationScope = 'occurrence' | 'following' | 'series';

interface UpdateMeetingCommand {
  targetMeetingId: MeetingId;
  scope: RecurrenceMutationScope;
  expectedRevision: number;
  patch: MeetingPatch;
  commandId: string;
}
```

- `occurrence`: create/update an exception and mutate only the selected occurrence.
- `following`: end the old series immediately before the selected occurrence key and create a successor series starting at that key.
- `series`: update shared metadata/rule and reconcile only future, non-started occurrences; historical occurrences remain immutable.

Cancellation uses the same scopes. “Delete” in the UI becomes “Cancel occurrence” or “Cancel series”; hard deletion is not a normal meeting operation.

### 6.6 Thin controller

```ts
export async function createMeetingHandler(req: AuthenticatedRequest, res: Response) {
  const input = createMeetingSchema.parse(req.body);
  const result = await meetingApplication.create({
    principal: req.context.principal,
    correlationId: req.context.correlationId,
    input,
  });
  return ResponseHelpers.created(res, result);
}
```

The controller does not import Prisma, construct RRULEs, send emails, or infer tenant ownership.

### 6.7 Transactional event flow

```ts
await prisma.$transaction(async (tx) => {
  const result = await meetingRepository.createSeriesWithFirstOccurrence(tx, aggregate);

  await outboxRepository.append(tx, {
    eventId: ids.event(),
    aggregateType: 'meeting-series',
    aggregateId: result.series.id,
    eventType: 'meeting.series.created.v1',
    schemaVersion: 1,
    occurredAt: clock.now(),
    payload: serializeSeriesCreated(result),
  });
});
```

The publisher claims unpublished rows in bounded batches, publishes with `eventId` as the queue idempotency key, and marks them published. Reconciliation alerts on old unpublished rows. Workers store durable delivery results and tolerate redelivery.

### 6.8 React view-state mapping

```ts
function primaryMeetingAction(view: MeetingView): PrimaryAction {
  if (view.capabilities.start.allowed) return { kind: 'start', label: 'Start' };
  if (view.capabilities.join.allowed) return { kind: 'join', label: 'Join' };
  if (view.meeting.status === 'ENDED') return { kind: 'recap', label: 'View recap' };
  if (view.meeting.status === 'CANCELLED') return { kind: 'none', label: 'Cancelled' };
  if (view.capabilities.join.reason === 'WAITING_FOR_HOST') {
    return { kind: 'disabled', label: 'Waiting for host' };
  }
  return {
    kind: 'details',
    label: view.capabilities.join.availableAt
      ? `Available ${formatRelative(view.capabilities.join.availableAt)}`
      : 'Details',
  };
}
```

Use this mapper in the dashboard, personal meetings page, team meetings page, details dialog, and calendar event popover. Delete the competing action derivations after all callers move to the shared controller.

Imported provider events must be a discriminated view type, not fabricated native meetings:

```ts
type ScheduleItemView =
  | { source: 'meetlite'; meeting: MeetingView }
  | {
      source: 'external-calendar';
      provider: 'google';
      externalEventId: string;
      startsAt: string;
      endsAt: string;
      joinUrl?: string;
      capabilities: { openExternal: boolean; joinExternal: boolean; deleteExternal: boolean };
    };
```

An external calendar event never calls MeetLite `start`, `end`, or room routes. Provider-specific fields stop at the calendar adapter and are mapped into this stable view.

## 7. HTTP contracts

### 7.1 Commands

```text
POST   /api/meetings
PATCH  /api/meetings/:meetingId
POST   /api/meetings/:meetingId/cancel
POST   /api/meetings/:meetingId/start
POST   /api/meetings/:meetingId/end
POST   /api/meetings/:meetingId/rsvp
POST   /api/meeting-series/:seriesId/materialize   # internal/admin only
POST   /api/meeting-recurrence/preview
```

Mutation requests include `Idempotency-Key`. Update/cancel requests include `expectedRevision` and, for recurring meetings, `scope`.

### 7.2 Queries

```text
GET /api/meetings?from=<instant>&to=<instant>&teamId=<id>
GET /api/meetings/:meetingId
GET /api/meeting-series/:seriesId
```

List queries are bounded and occurrence-based. Series details are fetched explicitly; series templates are never mixed into the joinable meeting list.

### 7.3 Stable errors

At minimum:

```text
INVALID_LOCAL_TIME
AMBIGUOUS_LOCAL_TIME
INVALID_TIME_ZONE
INVALID_RECURRENCE
RECURRENCE_EXPANSION_LIMIT
SERIES_REVISION_CONFLICT
MEETING_TOO_EARLY
MEETING_WAITING_FOR_HOST
MEETING_ALREADY_STARTED
MEETING_ALREADY_ENDED
MEETING_CANCELLED
MEETING_ACTION_FORBIDDEN
```

Clients branch on these codes, never human-readable messages.

## 8. Invitation, calendar, RSVP, and reminder design

### 8.1 Calendar identity

- Use one stable iCalendar `UID` for the series.
- Use `SEQUENCE` from the series revision.
- Emit `DTSTART;TZID=<event timezone>` and an RFC-compatible RRULE.
- Emit `RECURRENCE-ID` for occurrence updates/cancellations.
- Use `METHOD:REQUEST` for creates/updates and `METHOD:CANCEL` for cancellations.
- One-off meetings use their meeting public ID as UID.

### 8.2 Delivery events

Versioned outbox events:

```text
meeting.occurrence.created.v1
meeting.occurrence.updated.v1
meeting.occurrence.cancelled.v1
meeting.series.created.v1
meeting.series.updated.v1
meeting.series.cancelled.v1
meeting.started.v1
meeting.ended.v1
```

Workers derive recipient-specific jobs with stable keys such as:

```text
invite:{eventId}:{recipientHash}
reminder:{occurrenceId}:{recipientId}:{offsetMinutes}:{revision}
calendar:{seriesId}:{recipientHash}:{sequence}
```

Do not put raw email addresses in job IDs, logs, or metric labels.

### 8.3 Join links

Email and reminders link to `/meeting/:meetingId/join`, which can wait for room creation and apply invite policy. They must not build `/room/:meetingId`. Once started, the server-provided meeting view contains the real `roomId` or a join capability route.

For external invitees, exchange a valid recipient-bound invite token for a short-lived, meeting-scoped guest session. This permits invited guests to reach pre-join without creating a full account while still binding room admission to the intended meeting and recipient. The guest assertion includes meeting ID, invite ID, audience, expiry, and a nonce; it grants no dashboard or cross-meeting access. Public-meeting anonymous access remains a separate explicit access-policy choice.

### 8.4 RSVP ownership

Store attendee state at the series level with optional occurrence overrides:

```text
NEEDS_ACTION | ACCEPTED | TENTATIVE | DECLINED
```

RSVP tokens are recipient-bound, expiring, hashed at rest where feasible, and cannot authorize a different email/account. Organizers can see per-recipient state and delivery status without exposing invite tokens.

All email template values are escaped by default. Rich descriptions pass through one allowlist sanitizer before entering email HTML. Delivery state records queued, provider-accepted, delivered where supported, bounced, complained, and permanently failed. External invitees remain email/calendar recipients even when they do not have a MeetLite user row.

## 9. UX specification

### 9.1 Meeting actions

| State and viewer | Primary action | Secondary information |
| --- | --- | --- |
| Host, before start window | Details | “Starts at 09:00” |
| Host, start allowed | Start | Optional “Open lobby” explanation |
| Invitee, before join window | Disabled/details | “Available in 12 min” |
| Invitee, host required and absent | Disabled | “Waiting for host” |
| Invitee, join allowed | Join | “Lobby” or “Live” state |
| Host while live | Join | Destructive menu: “End for everyone…” |
| Participant while live | Join | In-room action: Leave |
| Ended | View recap, if authorized | Ended time/duration |
| Cancelled | No join action | Cancellation status |

End-for-all always requires confirmation. Leave and end-for-all are distinct operations.

### 9.2 Scheduling

- Default timezone to `Intl.DateTimeFormat().resolvedOptions().timeZone`, not `Africa/Lagos`.
- Display the selected event timezone and the creator’s local equivalent when different.
- Validate the local date/time on the server before final submission.
- Show DST errors inline with a suggested valid time.
- For recurrence, show the next five results returned by `/meeting-recurrence/preview`.
- Explain monthly 29/30/31 and leap-day skipping before save.
- On recurring edit/cancel, require a scope choice: this occurrence, this and following, or entire series.

### 9.3 List and calendar

- Queries return occurrences only.
- Add a recurrence badge linked to series details.
- Grouping into Today/This week uses viewer-local time; server query bounds are submitted as UTC instants derived from the viewer zone.
- Status comes from persisted lifecycle plus capabilities, not `scheduledAt + duration` guesses.
- Never offer delete/cancel/update controls when the corresponding capability is denied.

## 10. Migration strategy

### 10.1 Expand

1. Add `meeting_series`, outbox, revision, timezone, new timestamp, occurrence key, and series link fields as nullable/compatible fields.
2. Add indexes concurrently where PostgreSQL and migration tooling permit.
3. Add unique `(series_id, occurrence_key)` only after duplicate audit/backfill.
4. Deploy readers that understand old and new rows.
5. Add a typed feature flag `meetingSeriesV2` with owner, expiry, cohort, and telemetry.

For existing `scheduled_time TIMESTAMP(3)`, add `scheduled_at TIMESTAMPTZ(3)` rather than changing meaning in place. Backfill with the explicitly verified assumption that existing values represent UTC:

```sql
UPDATE meetings
SET scheduled_at = scheduled_time AT TIME ZONE 'UTC'
WHERE scheduled_at IS NULL;
```

Before running this in production, sample known meetings and compare API payloads, database values, calendar exports, and email times. If the assumption is false, segment the backfill by known source.

### 10.2 Migrate

1. Inventory rows where `is_recurring = true`, child links, duplicate start instants, and orphaned recurrence metadata.
2. Classify each legacy recurring parent:
   - parent only, no instances;
   - parent plus duplicate first instance;
   - parent with valid children;
   - orphan child;
   - inconsistent/corrupt series.
3. Create one `MeetingSeries` per valid parent.
4. Convert the parent’s scheduled meeting into the first occurrence or link the existing first child; never keep both.
5. Generate stable occurrence keys in the chosen event timezone. Existing rows without a reliable zone use `UTC` and are tagged for audit.
6. Preserve historical room, recording, RSVP, and audit references on occurrence rows.
7. Backfill exceptions and attach children through `seriesId`.
8. Verify counts, first/last occurrence, duplicate constraints, and reminder ownership per tenant.

Backfill in bounded batches with restart checkpoints. Produce a dry-run report before mutation and a forward-fix script for every rejected row category.

### 10.3 Contract

After telemetry shows no legacy readers/writers:

1. Stop writing `isRecurring`, `recurrenceRrule`, `recurrenceEndDate`, and `parentRecurrenceId`.
2. Remove client `recurrenceId` compatibility reads.
3. Remove the legacy recurrence service and old cron path.
4. Enforce new non-null fields for v2 rows.
5. Remove legacy columns only in a later release with an approved backup/restore and rollback decision.

## 11. Delivery plan

Each ticket below is a tracer bullet with one primary invariant and one rollback method.

### MLTR-00 — Contain and characterize legacy recurrence

**Invariant:** the product must not report a recurring series as ready when no valid occurrence exists.

Changes:

- Add focused characterization tests for the three confirmed failures.
- Add structured recurrence failure metrics.
- Hide or disable new recurrence creation behind a typed kill switch if production confirms expansion failure.
- Change legacy creation to return a stable failure if required initial expansion fails; do not silently succeed.

Files:

- `backend/packages/room-service/src/services/recurrence.service.test.ts`
- `backend/packages/room-service/src/controllers/meeting.controller.test.ts`
- `client/src/config/features.ts`
- `client/src/components/meeting/meeting-form-recurrence.tsx`

Rollback: re-enable the existing UI flag only after the old route behavior is restored. No schema change.

### MLTR-01 — Introduce zoned scheduling primitives

**Invariant:** a local date/time plus IANA zone resolves to one explicitly validated instant.

Changes:

- Add branded local date/time/zone types and ingress validation.
- Add the timezone adapter and DST ambiguity/nonexistence policies.
- Replace hard-coded `Africa/Lagos` defaults.
- Add the recurrence preview operation using the same engine planned for materialization.

Files:

- `backend/packages/room-service/src/meeting-domain/time/*`
- `backend/packages/room-service/src/meeting-domain/recurrence/*`
- `backend/packages/room-service/src/routes/v1/meeting-recurrence.routes.ts`
- `client/src/hooks/use-meeting-forms.tsx`
- `client/src/components/meeting/meeting-form-date-time.tsx`
- `client/src/components/meeting/meeting-form-recurrence.tsx`

Rollback: route creation through the legacy payload flag; new fields remain additive.

### MLTR-02 — Expand the persistence model

**Invariant:** series templates and joinable occurrences are distinguishable in storage.

Changes:

- Add `MeetingSeries`, new meeting occurrence fields, exception keys, revisions, and outbox.
- Add tenant-safe repository adapters and fakes.
- Add the staged timestamp/timezone migration.

Files:

- `backend/packages/shared/prisma/schema.prisma`
- new reviewed migration under `backend/packages/shared/prisma/migrations/`
- `backend/packages/room-service/src/meeting-domain/repositories/*`

Rollback: application stops writing v2 rows; additive schema remains until a later contraction.

### MLTR-03 — Create series with first occurrence atomically

**Invariant:** successful recurring creation yields a valid series and exactly one first occurrence.

Changes:

- Implement `MeetingApplication.create` through the new repository.
- Commit series, first occurrence, attendees, and outbox intent in one transaction.
- Require idempotency keys.
- Return occurrence view plus capabilities.

Files:

- `backend/packages/room-service/src/meeting-domain/meeting-application.ts`
- `backend/packages/room-service/src/meeting-domain/meeting-policy.ts`
- `backend/packages/room-service/src/controllers/meeting.controller.ts`
- `backend/packages/room-service/src/routes/v1/meetings.routes.ts`

Rollback: cohort routing sends creation back to v1; v2 rows remain readable.

### MLTR-04 — Idempotent rolling materialization

**Invariant:** retries and concurrent schedulers create at most one row per occurrence key.

Changes:

- Implement `OccurrenceMaterializer` with revision checks and upserts.
- Publish materialization commands through outbox/queue.
- Make scheduler only discover due series and append/claim bounded work.
- Add reconciliation for lagging or failed series.

Files:

- `backend/packages/room-service/src/meeting-domain/occurrence-materializer.ts`
- `backend/packages/room-service/src/jobs/recurrence.job.ts`
- `backend/packages/room-service/src/scheduler.ts`
- shared versioned job definitions and worker

Rollback: pause v2 materialization workers; existing materialized occurrences remain valid.

### MLTR-05 — Scoped recurrence edits and cancellations

**Invariant:** every recurring mutation declares `occurrence`, `following`, or `series` scope.

Changes:

- Add revisioned update/cancel commands.
- Implement occurrence exceptions, series reconciliation, and series splitting.
- Replace hard delete with cancellation state transitions.
- Preserve historical occurrences and recordings.

Files:

- `backend/packages/room-service/src/meeting-domain/meeting-application.ts`
- `backend/packages/room-service/src/meeting-domain/series-splitter.ts`
- controller/routes and repository tests
- recurring edit/cancel dialogs in `client/src/components/meeting/`

Rollback: disable v2 edit scopes while retaining read/join for already-created occurrences.

### MLTR-06 — Server-owned lifecycle and capabilities

**Invariant:** an action shown as enabled is accepted by the server at the same revision unless state changes concurrently.

Changes:

- Add lifecycle transition policy and capability projection.
- Guard start/end by status, role, access policy, and join window.
- Make start idempotent and return the existing room on retry.
- Separate leave from end-for-all.

Files:

- `backend/packages/room-service/src/meeting-domain/meeting-policy.ts`
- `backend/packages/room-service/src/meeting-domain/meeting-lifecycle.ts`
- `backend/packages/room-service/src/controllers/meeting.controller.ts`
- room admission module

Rollback: capability reads can be disabled, but server lifecycle guards must remain once deployed.

### MLTR-07 — Transactional invitations, reminders, and RSVP

**Invariant:** every committed meeting change has a durable, idempotent delivery intent.

Changes:

- Add outbox publisher and delivery reconciliation.
- Generate ICS request/update/cancel messages with timezone and recurrence metadata.
- Fix join URLs and recipient-local rendering.
- Add recipient-bound RSVP operations and organizer status UI.
- Make reminders occurrence-based and idempotent.

Files:

- `backend/packages/room-service/src/meeting-domain/invitations/*`
- `backend/packages/shared/src/templates/meeting/*`
- shared queue job contracts/workers
- notification service replacement adapters

Rollback: pause individual consumers; outbox retains pending intent for replay.

### MLTR-08 — Unify client meeting surfaces

**Invariant:** dashboard, list, calendar, and details use the same meeting view and action mapper.

Changes:

- Introduce the meeting controller hook and view-state reducer.
- Replace local time/status/action derivation.
- Remove obsolete `MeetingCard`/list logic after caller migration.
- Use server recurrence previews and explicit mutation-scope dialogs.

Files:

- `client/src/features/meetings/meeting-controller.ts`
- `client/src/features/meetings/meeting-view-state.ts`
- `client/src/components/meeting/meeting-list-section.tsx`
- `client/src/components/dashboard/upcoming-meetings-section.tsx`
- `client/src/components/meeting/meeting-details-dialog.tsx`
- `client/src/components/meeting/meeting-calendar-section.tsx`

Rollback: per-surface typed flag routes back to legacy rendering during the cohort window.

### MLTR-09 — Backfill, canary, and contract

**Invariant:** every migrated series has a verified occurrence count and no duplicate occurrence keys.

Changes:

- Run dry-run inventory and audited bounded backfill.
- Shadow-compare v1 and v2 recurrence previews without duplicating writes.
- Canary creation by stable workspace cohort.
- Expand after error, lag, duplicate, delivery, and timezone metrics meet gates.
- Remove legacy paths only after the observation window.

Rollback: route new writes to v1 before contraction; forward-fix already-created v2 data.

## 12. Verification matrix

### 12.1 Recurrence engine

- Daily, weekdays, multi-day weekly, interval > 1.
- Monthly dates 28, 29, 30, and 31.
- February 29 yearly recurrence.
- Count includes first occurrence.
- Until-date inclusivity in event timezone.
- Spring-forward nonexistent local time.
- Fall-back ambiguous local time, both offsets.
- Zones with half-hour and quarter-hour offsets.
- Zone with no DST and zones whose DST rule changes in the test fixture.
- Bounded expansion of never-ending rules.
- Preview output equals materializer output for the same definition.

### 12.2 Materialization and persistence

- Two concurrent materializers produce one row per key.
- Redelivery after every transaction/worker line remains idempotent.
- Stale revision cannot materialize an old rule.
- First occurrence exists once, never as a template duplicate.
- Exceptions suppress or override the intended key.
- Tenant-scoped repository rejects cross-tenant IDs.
- Series cancellation preserves historical meetings and recordings.

### 12.3 Scoped mutations

- Edit one occurrence leaves siblings unchanged.
- Move one occurrence retains occurrence key.
- Edit following splits at the correct key.
- Edit series reconciles future scheduled occurrences only.
- Cancel one/following/all cancels the correct reminders and calendar events.
- Concurrent edit returns `SERIES_REVISION_CONFLICT`.

### 12.4 Lifecycle and authorization

- Host, invitee, public authenticated user, declined invitee, admin, cross-tenant user.
- Too early, join window, waiting for host, live, ended, cancelled.
- Start retry returns the same room.
- Non-host cannot start or end-for-all.
- A scheduled meeting cannot be completed without a valid lifecycle transition.
- UI action matrix matches server capabilities.
- Recipient-bound guest session can access only its invited meeting and expires as configured.
- An imported calendar event cannot invoke native MeetLite lifecycle operations.

### 12.5 Delivery

- Invite, update, cancellation, and RSVP sequence.
- ICS validates for one-off, recurring, moved occurrence, and cancelled occurrence.
- External invitee receives correct event-local time and calendar localization metadata.
- Outbox replay does not duplicate logical email/calendar delivery.
- Removed attendees receive cancellation; added attendees receive current sequence.
- Reminder links resolve through meeting join, not room-by-meeting-ID.
- Unregistered invitees receive invite/update/cancel delivery without requiring a user row.
- HTML-controlled meeting fields are escaped or allowlist-sanitized in every template.

### 12.6 Browser E2E

Run the same scenarios with browser timezone set to Lagos, New York, London, Kolkata, and Auckland. Assert stored instant, event-zone display, viewer-local display, preview, email fixture, CTA, and join route.

## 13. Observability and rollout gates

Structured metrics:

```text
meeting_series_create_total{result,error_code}
meeting_recurrence_expand_total{result,error_code}
meeting_recurrence_expand_duration_ms
meeting_recurrence_occurrences_created_total
meeting_recurrence_duplicate_conflict_total
meeting_recurrence_materialization_lag_seconds
meeting_series_revision_conflict_total
meeting_outbox_oldest_unpublished_seconds
meeting_delivery_total{kind,result,error_code}
meeting_capability_rejection_total{action,reason}
```

No series ID, meeting ID, email, title, or timezone appears as an unbounded metric label. Logs include correlation ID, command/event ID, aggregate ID, revision, stable event name, and redacted error code.

Canary promotion requires:

- zero duplicate occurrence keys;
- no unexplained v1/v2 preview differences;
- materialization lag below the defined SLO;
- no sustained outbox backlog;
- delivery retry/dead-letter rate within budget;
- DST and timezone E2E green;
- rollback drill completed before broad rollout.

## 14. Definition of done

This program is complete when:

1. New meeting creation always persists an event timezone and a timezone-safe UTC instant.
2. Recurring series use the dedicated series model and occurrence uniqueness constraint.
3. The recurrence engine is the only implementation used by preview and materialization.
4. All recurrence scope mutations are explicit, revisioned, authorized, and tested.
5. Scheduling, materialization, invites, reminders, updates, cancellations, and RSVP have durable idempotent intent.
6. Meeting list, dashboard, calendar, details, email, and join flows use one occurrence/lifecycle contract.
7. No production path reads or writes legacy `recurrenceId`/parent recurrence semantics.
8. Legacy compatibility code has an owner, removal evidence, and then is deleted.
9. The caged verification loop, security review, migration verification, and canary gates pass.
