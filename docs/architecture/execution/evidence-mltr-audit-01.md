# Verification Cage Evidence: MLTR-AUDIT-01

- Ticket: post-implementation audit of MLTR-00 through MLTR-09
- Baseline: `8612169808e0846efe8aa2f85230afbeb6261e8e`
- Reviewed head: `b73eb2bf777ec0e4d77bf05122c27bfe08601df4`
- Risk: critical — authorization, scheduling correctness, recurrence persistence, and delivery durability
- Invariant: event wall-clock intent, occurrence lifecycle, invitation access, and delivery intent remain consistent across timezones, retries, replicas, and rolling migration.

## Failures reproduced

- Client creation submitted the legacy payload and browser timezone instead of the selected event timezone.
- Recurrence preview silently fell back to a second client-side recurrence engine.
- V2 attendee emails were not persisted, so invite authorization and delivery had no durable recipient source.
- Private live meetings granted `join` without checking participant/invite state.
- Creation idempotency was held in a process-local, cross-principal map.
- Domain creation and outbox insertion committed separately; publisher rows had no claim lease.
- The expand migration dropped legacy recurrence columns and added `series_id NOT NULL` before backfill.
- Email rendered a server-local time while labeling it UTC.
- Join links pointed at lobby routes before a room existed; cancellation sent revision `1` permanently.

## Implemented controls

- Client submits `localDate`, `localTime`, selected IANA `timeZone`, V2 recurrence spec, and an idempotency key.
- Preview is server-authoritative only.
- Series attendees, occurrence invites, occurrence creation, and creation outbox rows commit atomically.
- Materialized occurrences inherit series attendees.
- Private-meeting capabilities and V2 reads fail closed; team creation checks concrete membership.
- Creation idempotency is durable and scoped by creator.
- Outbox publisher uses row leases, `SKIP LOCKED`, bounded attempts, and dead-letter state; the scheduler dispatches invitation events every five seconds.
- Meeting start/end state and outbox intent commit in one transaction.
- Lifecycle writes use revision compare-and-swap; scheduled meetings cannot transition directly to completed.
- Migration is additive and retains the legacy exception shape during compatibility.
- Email shows event-local wall-clock time with the IANA zone and a separate UTC reference.
- Stable `/meeting/:meetingId/join` links are copied before room creation.

## Verification

| Cage | Result |
| --- | --- |
| Prisma schema validation | pass |
| Shared TypeScript typecheck | pass |
| Room-service TypeScript typecheck | pass |
| Room-service unit tests | 68/68 pass |
| Shared unit tests | 132/132 pass |
| Client production build | pass; existing bundle-size and `next-themes` warnings remain |
| `git diff --check` | pass |

## Residual scope

The audit does not claim the entire multi-phase plan is complete. RSVP/decline endpoints, recipient-bound guest-session exchange, reminder reconciliation, series update/cancel transactional outbox consolidation, and replacement of remaining legacy/client-clock compatibility paths remain follow-up release gates. They must not be represented as shipped capabilities until independently caged.
