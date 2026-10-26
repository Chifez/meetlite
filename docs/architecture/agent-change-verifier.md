# MeetLite Agent Change Verifier

**Status:** proposed design; implementation is blocked on the real integration and browser-E2E harnesses identified below  
**Owner:** unassigned  
**Governing standard:** [MeetLite scaling and refactoring execution standard](execution/README.md)

## Purpose

The verifier is an independent, deterministic release gate for changes produced by humans or coding agents. It answers four separate questions:

1. Did the requested behavior become true?
2. Did behavior that previously passed remain true?
3. Did latency, reliability, resource use, bundle size, or media quality regress beyond an approved budget?
4. Is the evidence trustworthy, reproducible, and protected from being weakened by the same change it grades?

The verifier never asks an LLM to decide whether a change passes. Agents may select and run checks, explain failures, and propose fixes; only deterministic commands, machine-readable thresholds, protected policy, and required human approvals set the result.

## Verdicts

The overall verifier result is one of:

- `PASS`: every required check ran and passed against the candidate revision.
- `FAIL`: a required correctness, security, E2E, performance, policy, or hygiene gate failed.
- `INCONCLUSIVE`: required evidence ran but environmental variance or insufficient comparable samples prevented a defensible decision. It blocks certification and merge where that evidence is required.
- `NOT_IMPLEMENTED`: a required harness, fixture, baseline, environment, or service does not exist. It blocks certification and cannot be represented as green.

Each check additionally records `PASS`, `FLAKY`, `FAIL`, `INFRA_ERROR`, or `QUARANTINED_FAIL`. A retry success is `FLAKY`, not `PASS`; an environment/setup failure is `INFRA_ERROR`, not a product failure and never a green result. Overall `INCONCLUSIVE` and `NOT_IMPLEMENTED` replace the less precise term `BLOCKED` in machine-readable evidence.

There is no `CONDITIONAL PASS` at the merge gate. Accepted exceptions live in a separate, protected waiver file with an owner, reason, scope, expiry, and approving human.

## Trust boundary

The following files are verifier policy and must require Code Owner review:

- verifier runner and report schema;
- command/path mapping;
- thresholds and budgets;
- CI workflows and test-environment definitions;
- golden E2E fixtures;
- waiver records;
- `CODEOWNERS` itself.

The protected branch must require verifier status checks from the expected CI application, require Code Owner review for verifier-policy changes, dismiss stale approvals when policy changes, and prevent administrators or agents from bypassing the rule. Local execution is useful feedback but is not authoritative merge evidence.

The candidate process receives read-only access to baselines and policy. It may write only its isolated workspace and result directory. Staging credentials are short-lived, least-privilege, and unavailable to untrusted fork jobs.

## Change contract

Every non-documentation change supplies a machine-readable change manifest:

```json
{
  "ticket": "CAL-SEC-01",
  "invariant": "OAuth callback cannot select a user that did not initiate the flow",
  "risk": "high",
  "baseRevision": "<immutable commit SHA>",
  "changedSeams": ["calendar-oauth"],
  "expectedChecks": ["calendar-unit", "calendar-contract", "calendar-browser"],
  "performanceProfiles": [],
  "rollback": "disable calendar-connect flag and redeploy previous artifact",
  "evidencePath": "docs/architecture/execution/evidence-cal-sec-01.md"
}
```

The manifest declares intent; it cannot remove checks inferred from the diff. The verifier uses the union of declared checks and policy-inferred checks.

## Verification pipeline

### Gate 0 — policy integrity and reproducible environment

- Resolve the immutable base and candidate SHAs.
- Reject changes to protected verifier policy without the required approval signal.
- Pin Node/npm, browser, OS/container image, lockfiles, and test-service versions.
- Install from the lockfile in a clean environment.
- Reject placeholder/no-op scripts and required scripts that exit successfully without executing a test tool.
- Record pre-existing failures from the base revision; never silently reclassify them as candidate failures or accepted debt.

### Gate 1 — meaningful task evidence

- Confirm that the task invariant, scope, forbidden scope, risk, rollback, and exact acceptance checks are present.
- Run the task's fail-to-pass test on the base revision where safe and practical. It must fail for the intended behavioral reason.
- Run the protected pass-to-pass regression set on base and candidate.
- Flag tests that are materially narrower or wider than the declared behavior for human review; passing an unfair test is not sufficient evidence.

### Gate 2 — diff and repository hygiene

- `git diff --check` and generated-artifact policy.
- Secret, dependency, license, and vulnerable-package scanning.
- Changed-file rules for direct environment reads, unsafe TypeScript suppressions, debug logs, missing tenant scope, and forbidden dependency direction.
- Migration, environment-variable, API/event schema, and compatibility-impact detection.

### Gate 3 — changed-scope static and behavioral checks

Map changed files to owning workspaces and interface consumers. In order, run:

1. formatter check;
2. lint;
3. type-check/build;
4. focused unit tests;
5. focused integration/contract tests;
6. adversarial tests selected by risk tags.

A test command that does not discover any tests is a failure unless the policy explicitly permits zero tests for that named check.

### Gate 4 — repository regression set

- Run all canonical unit, integration, contract, type-check, lint, and build commands from a clean checkout.
- Require every protected pass-to-pass test to remain green.
- Compare warnings and suppressions with the base revision; new unexplained warnings fail.
- For schema/message changes, exercise mixed-version readers and writers before contraction.

### Gate 5 — end-to-end product flows

Run Playwright (or an equivalent real-browser harness) against an isolated production-shaped stack. The initial protected flow set is:

1. signup/login/token refresh/logout;
2. dashboard load and quick-meeting creation;
3. schedule, invite, list, start, and complete meeting;
4. Google Calendar connect, conflict check, schedule, and disconnect using a controlled provider test boundary;
5. lobby device preview, join, publish, subscribe, reconnect, and leave;
6. screen share, chat, code/whiteboard collaboration, host departure, and recording continuity;
7. recording processing, authorized replay/download, and denied cross-tenant access;
8. administrator overview, user action, audit event, and system-health view.

Media flows run separately for Mediasoup and Cloudflare Calls. A mock SFU run may validate state transitions but cannot satisfy the deployed-media gate.

### Gate 6 — regression budgets

Correctness and security have zero tolerance: no newly failing protected test, unauthorized access, data loss, recording loss, secret exposure, or invalid migration is allowed.

Initial performance budgets are conservative defaults and must be calibrated from at least five comparable clean-baseline runs before enforcement:

| Signal | Candidate fails when |
| --- | --- |
| API error rate | SLO is breached, or candidate increases by more than 0.5 percentage points and the increase is statistically/repeatedly observable |
| API p95/p99 | SLO is breached, or median-of-runs increases by more than 10% and at least 25 ms |
| Room join success | SLO is breached, or falls by more than 0.5 percentage points |
| Time to first remote media | SLO is breached, or median-of-runs increases by more than 10% and at least 100 ms |
| Reconnect recovery | SLO is breached, or p95 increases by more than 10% and at least 250 ms |
| Memory/connection/storage growth | declared soak bound is exceeded or growth does not return to the expected post-test level |
| Client route bundle | route budget is exceeded, or compressed transfer grows by more than 5% and at least 50 KiB without an approved budget change |
| Accessibility | any new serious/critical automated violation, keyboard-flow failure, or loss of required accessible name/state |

A single noisy run does not approve or reject a performance change. The same pinned environment runs base and candidate in alternating order, discards invalid runs using predeclared criteria, and compares the median plus relevant tail percentiles. Raw samples remain attached.

### Gate 7 — evidence, canary, and rollback

- Emit a versioned JSON report and human-readable Markdown summary containing SHAs, environment fingerprint, selected checks, commands, durations, results, baselines, deltas, artifacts, and first failure.
- Archive logs, JUnit, coverage, Playwright traces/screenshots/video-on-failure, load-test summaries, and relevant sanitized telemetry.
- For production-facing high-risk changes, require the existing MeetLite canary cage and rollback evidence. The local/CI verifier returns `NOT_IMPLEMENTED` when the required canary harness does not exist, or `INCONCLUSIVE` when canary evidence exists but cannot support a decision.

## Flaky-test policy

- The first failure is retained even if a diagnostic retry passes.
- A retry may classify a suspected flake; it may not convert failure into pass automatically.
- Quarantine requires a reproducible flake record, owner, repair ticket, expiry, and non-critical scope.
- Security, authorization, payment, migration, recording integrity, room admission, and core E2E flows cannot be quarantined.
- Track retry rate and quarantine age as verifier health metrics.

## Required command interface

The intended stable interface is:

```bash
npm run verify:change -- --base <commit> --profile local
npm run verify:change -- --base <commit> --profile pr
npm run verify:change -- --base <commit> --profile staging
npm run verify:policy
```

- `local`: changed-scope feedback; reports unavailable staging evidence as `NOT_IMPLEMENTED` without pretending to certify it.
- `pr`: clean-install static, changed-scope, full regression, and applicable local E2E gates.
- `staging`: deployed integrations, browser media, load/performance, fault injection, and canary evidence.

## Implementation slices

### VER-01 — make the repository contract real

Replace the current successful `echo` placeholders for format, integration, contract, and E2E checks with tools that execute tests. Add a CI clean-checkout job and deliberately prove that each workspace failure makes it fail.

**Exit:** no required command can pass without discovering/running its intended checks.

### VER-02 — deterministic verifier core

Implement diff classification, manifest validation, workspace/consumer mapping, command execution with timeouts, zero-test detection, protected-policy detection, and the versioned JSON/Markdown report. Unit-test path selection, failures, timeouts, signals, and malformed output.

**Exit:** fixture repositories prove `PASS`, `FAIL`, `INCONCLUSIVE`, and `NOT_IMPLEMENTED` behavior deterministically, while check fixtures prove `FLAKY`, `INFRA_ERROR`, and `QUARANTINED_FAIL` classification.

### VER-03 — real browser product journeys

Build deterministic seed/reset adapters and the protected E2E flow set. Capture browser console errors, failed requests, traces, screenshots, and videos on failure. Run with synthetic media for both adapters in the appropriate environment.

**Exit:** deliberately breaking each core flow produces a failed required check.

### VER-04 — comparable performance budgets

Integrate corrected k6 and browser/WebRTC summaries, environment fingerprints, base-versus-candidate alternating runs, budget evaluation, and historical trend output.

**Exit:** injected latency/error/bundle/media regressions above each threshold fail, while controlled noise below both relative and absolute bounds does not.

### VER-05 — merge and policy protection

Add CI workflows, required status checks, `CODEOWNERS`, protected waiver handling, artifact retention, and branch/ruleset configuration documentation.

**Exit:** an agent-authored change cannot weaken verifier code, policy, expected tests, or thresholds and merge without the designated human review.

## Current blockers

The repository cannot honestly implement the full verifier today because root `format:check`, `test:integration`, `test:contracts`, and `test:e2e` scripts are successful placeholders; no `.github` workflow exists; and no protected real-browser E2E suite exists. VER-01 and VER-03 therefore precede claims that end-to-end regression verification is active.

The primary-source rationale, threat model, risk levels, CI boundary, and Cage 0 through Cage 7 mapping are documented in [Agent verifier loops and regression gates](../research/agent-verifier-loops-and-regression-gates-2026-10-25.md).
