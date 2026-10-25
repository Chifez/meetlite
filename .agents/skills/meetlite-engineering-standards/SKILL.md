---
name: meetlite-engineering-standards
description: Apply MeetLite's coding rules and production patterns when implementing, refactoring, or reviewing application, edge, realtime, storage, queue, database, or infrastructure code in this repository.
---

# MeetLite Engineering Standards

Use the execution standard as the single source of truth. This skill turns that reference into a mandatory decision process for code changes.

## Load the governing reference

Before editing code, read these sections completely in [`docs/architecture/execution/README.md`](../../../docs/architecture/execution/README.md):

- `2. Strict coding rules`
- `3. Required implementation patterns`

Then read the phase that owns the change:

- Scaling work: [`docs/architecture/execution/scaling-execution-plan.md`](../../../docs/architecture/execution/scaling-execution-plan.md)
- Refactoring work: [`docs/architecture/execution/refactoring-execution-plan.md`](../../../docs/architecture/execution/refactoring-execution-plan.md)

If a task crosses both tracks, read both applicable phases and obey every dependency edge. The stricter rule wins when requirements overlap.

## Establish the change contract

Before implementation, identify:

1. The owning module and its interface.
2. The invariant being preserved or introduced.
3. The trusted principal and tenant source, when data or authorization is involved.
4. State ownership and the system of record.
5. Ordering, concurrency, retry, and idempotency requirements.
6. Provider-specific details that must remain inside an adapter.
7. Compatibility and rollback requirements.

If these cannot be stated from the ticket and repository evidence, keep investigating. Ask the user only when the missing decision materially changes product behavior, authority, or risk.

**Completion criterion:** every item that applies is explicit enough that a reviewer can identify an incorrect dependency direction, trust decision, or state owner before reading the implementation.

## Select the production pattern

Use the pattern whose failure mode matches the change:

- **Deep module:** complex behavior needs a small stable interface and one ownership seam.
- **Strangler migration:** a production path is being replaced while rollback must remain available.
- **Transactional job:** a durable mutation triggers retriable asynchronous side effects.
- **Compatibility pattern:** old and new schemas, messages, claims, clients, or processes coexist during rollout.

Use multiple patterns only when the change genuinely has multiple failure modes. Do not introduce an interface for hypothetical provider portability; a production adapter plus a fake/test adapter, or two real adapters, proves the seam.

**Completion criterion:** the selected pattern accounts for creation, normal use, failure, retry/reconnect, and cleanup or deletion.

## Implement through the declared seam

- Keep transport handlers and React views thin.
- Put business and authorization policy in the owning module.
- Keep database/provider/browser mechanics inside adapters.
- Validate external input once at ingress and carry typed values internally.
- Derive identity and tenant scope from verified context.
- Make side effects explicit, bounded, observable, and safe to retry.
- Preserve mixed-version compatibility until telemetry proves contraction is safe.

Use `$meetlite-verification-cage` for the implementation and evidence loop.

**Completion criterion:** callers use the declared interface; provider types, unverified identity, and persistence mechanics do not leak past their seams.

## Standards review

Before handoff, review the complete diff against every applicable rule in sections 2 and 3 of the execution standard. Pay particular attention to:

- direct `process.env` reads outside configuration modules;
- `any`, unchecked assertions, and unvalidated external data;
- missing tenant predicates or caller-controlled authority;
- import-time workers, schedules, or network connections;
- unbounded messages, retries, collections, uploads, or log cardinality;
- provider types crossing module seams;
- database mutation plus queue publication without reconciliation;
- React effects owning negotiation or durable business state;
- compatibility code without an owner and removal condition.

**Completion criterion:** every applicable rule is satisfied or the deviation is explicitly documented with owner, reason, risk, and expiry. An undocumented deviation is a failed review.
