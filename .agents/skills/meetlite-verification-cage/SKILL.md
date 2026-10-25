---
name: meetlite-verification-cage
description: Run MeetLite's caged verification loop when executing or validating a scaling/refactoring ticket, production behavior change, migration, security change, realtime change, or other repository implementation work that requires evidence before completion.
---

# MeetLite Verification Cage

The cage prevents a passing build or happy path from being mistaken for completion. Evidence, not confidence, advances a ticket.

## Load the governing reference

Read these sections completely in [`docs/architecture/execution/README.md`](../../../docs/architecture/execution/README.md):

- `1.2 Phase and ticket state machine`
- `4. The caged verification loop`
- `5. Verification evidence template`
- `6. Baseline command contract`
- `7. Hard stop conditions`

Read the applicable phase and its entry, dependency, verification, rollout, and exit gates:

- Scaling: [`docs/architecture/execution/scaling-execution-plan.md`](../../../docs/architecture/execution/scaling-execution-plan.md)
- Refactoring: [`docs/architecture/execution/refactoring-execution-plan.md`](../../../docs/architecture/execution/refactoring-execution-plan.md)

Apply `$meetlite-engineering-standards` when the ticket changes code, configuration, schema, messages, infrastructure, or runtime behavior.

## Run one cage at a time

### Cage 0 — Evidence boundary

Inspect repository state and establish the invariant, scope, forbidden scope, dependencies, baseline behavior, risks, exact checks, rollback, and pre-existing failures. Create the ticket evidence record from the template in the execution standard.

**Completion criterion:** the change is reviewable and reversible, and a reviewer can distinguish new failures from the baseline.

### Cage 1 — Meaningful red

Add the narrowest behavior test and observe it fail for the intended reason. For a purely mechanical refactor, capture the existing green characterization suite instead. Setup, syntax, fixture, or network failures are not red evidence.

**Completion criterion:** the evidence record contains the command, relevant failure, and why that failure proves the missing behavior.

### Cage 2 — Minimum coherent slice

Implement only enough behavior to satisfy the declared invariant through the chosen seam. Include error handling, telemetry, and required compatibility in the slice.

**Completion criterion:** the targeted test is green and no undeclared behavior or cleanup was added.

### Cage 3 — Focused static and test checks

Run the touched workspace's format check, lint, type-check/build, focused unit tests, and focused integration/contract tests in that order. Use the closest real command when the canonical root script does not yet exist, and record the missing-script gap.

**Completion criterion:** touched-scope checks are green with no new warnings or unexplained suppressions.

### Cage 4 — Adversarial checks

Exercise every applicable negative path from the governing reference: identity and tenant abuse; duplicate, stale, reordered, oversized, or concurrent commands; dependency failure and cancellation; browser lifecycle and reconnect; mixed-version migration; interrupted upload and cleanup.

**Completion criterion:** each applicable risk has automated evidence, or an explicit staging-only test with owner and execution point.

### Cage 5 — System checks

Run affected workspace and consumer checks, then repository-wide checks. Use deployed staging for Cloudflare-managed behavior and comparable environments for performance claims. Protocol load tests and real-browser media tests prove different things; use both when the phase requires both.

**Completion criterion:** all phase-required system evidence is attached and the change introduces no unexplained regression.

### Cage 6 — Diff, security, and operability review

Review the complete diff. Apply the standards audit, secret/dependency checks, migration and compatibility review, and verify telemetry, alerts, runbook, flag ownership, and rollback.

**Completion criterion:** a reviewer can explain the change, state owner, trust decisions, failure behavior, and rollback using the evidence package alone.

### Cage 7 — Canary and closure

Expose only the declared cohort, observe for the phase's minimum window and sample size, and compare with baseline SLO, correctness, resource, and cost signals. A hard stop triggers containment and rollback before diagnosis; exposure never increases while a gate is red.

**Completion criterion:** every exit gate is supported by archived evidence, rollback has remained available for the required window, and deletion/follow-up work has an owner.

## Stop rules

- Do not skip or combine cages in the evidence record.
- A later green result does not erase a failed earlier cage.
- Fixes discovered after Cage 2 return to the earliest cage whose evidence changed.
- A hard-stop condition ends rollout immediately; it never becomes an accepted warning inside the same run.
- `COMPLETE` is available only after Cage 7 or when the applicable phase explicitly proves that no production canary is needed.

## Handoff format

Report:

1. Ticket state and phase.
2. Invariant and changed seam.
3. Exact checks run and results.
4. Adversarial cases covered.
5. Canary or reason it is not applicable.
6. Rollback method.
7. Residual risks and owned follow-ups.

**Completion criterion:** the final report is traceable to the evidence record and contains no unsupported claims such as “production-ready,” “scalable,” or “secure.”
