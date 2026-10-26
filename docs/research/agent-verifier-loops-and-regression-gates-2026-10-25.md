# Agent verifier loops and regression gates for MeetLite

**Date:** 2026-10-25  
**Status:** research and proposed architecture  
**Scope:** automated verification of agent-authored changes, regression budgets, end-to-end flow validation, evidence generation, and protection of the verifier itself

## Executive conclusion

MeetLite's existing Cage 0 through Cage 7 standard is a strong **verification policy**, but it is not yet an enforceable **verification system**. The repository currently has no checked-in CI workflow, no real root E2E command, placeholder integration and contract commands, and no independent mechanism that prevents an agent from weakening the tests or rules used to grade its own patch.

The recommended solution is a two-part system:

1. a repository-owned `meetlite-verifier` CLI that deterministically selects and runs checks, compares the candidate with a recorded baseline, and emits a machine-readable evidence bundle; and
2. a trusted CI control plane, protected by branch rules and human ownership, that runs the verifier in an ephemeral sandbox and is not replaceable by the candidate patch being evaluated.

This design should extend, not replace, the current eight cages. Functional and security correctness remain zero-tolerance gates. Performance, bundle size, and resource use use explicit absolute SLOs plus calibrated relative regression budgets. Browser journeys verify observable outcomes and durable backend state, not merely clicks or successful HTTP responses.

## What primary sources establish

### Solve the requested behavior and preserve existing behavior

SWE-bench separates tests into `FAIL_TO_PASS`, which prove the issue was solved, and `PASS_TO_PASS`, which prove unrelated working behavior was preserved. A patch is resolved only when both groups pass. OpenAI's human validation of SWE-bench also found that ambiguous tasks and overly narrow tests distort results, so task and grader quality must itself be reviewed ([OpenAI, Introducing SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/)).

For MeetLite this maps directly to:

- **change tests:** the meaningful red test from Cage 1 must become green;
- **preservation tests:** characterization, consumer-contract, high-value E2E, and repository regression suites that were green at the baseline must remain green;
- **grader validation:** a test failure caused by an invalid fixture, unavailable dependency, or unstated requirement is an infrastructure/specification failure, not proof that the patch is wrong.

### Grade end state with deterministic checks wherever possible

Anthropic recommends well-specified tasks, stable isolated environments, reference solutions, deterministic graders where possible, and evaluation of the final environment state rather than trusting an agent's claim. It distinguishes capability suites from regression suites: regression checks should remain near 100%, while capability suites may intentionally contain unsolved work. It also recommends multiple trials for stochastic agent behavior and retaining traces for diagnosing whether the agent or grader failed ([Anthropic, Demystifying evals for AI agents](https://www.anthropic.com/research/demystifying-evals-for-ai-agents)).

MeetLite's product verifier is mostly deterministic: type checks, tests, route contracts, database state, browser-visible state, Socket.IO/WebSocket acknowledgements, media state, and performance metrics. An LLM reviewer may add advisory code-quality observations, but an LLM score must not override a failed deterministic security, correctness, or data-integrity gate.

### Mechanical constraints matter more when agents produce code quickly

OpenAI reports that an agent-first codebase relies on repository knowledge as the system of record and mechanically enforced architecture and quality constraints, including custom linters and structural tests. The feedback loop and legibility of the environment are part of the engineering system, not optional documentation ([OpenAI, Harness engineering](https://openai.com/index/harness-engineering/)).

MeetLite should therefore convert its most important prose invariants into structural tests: package dependency direction, direct `process.env` access, public header trust, provider-type leakage, unbounded collections, forbidden migration commands, missing tenant predicates, and changes to protected verifier files.

### Isolate execution and keep privileged control outside model-directed compute

OpenAI's sandbox architecture separates the trusted harness/control plane from the execution environment and recommends narrow credentials and mounts for model-directed compute ([OpenAI, Sandbox agents](https://developers.openai.com/api/docs/guides/agents/sandboxes)). GitHub warns that executing untrusted pull-request code from `pull_request_target` or another privileged workflow can expose secrets, write tokens, or shared caches. GitHub recommends least-privilege tokens, ephemeral isolated runners, avoiding privileged execution of untrusted code, and pinning third-party actions by lockfile or full commit SHA ([GitHub, Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use), [GitHub, Securely using `pull_request_target`](https://docs.github.com/en/actions/reference/security/securely-using-pull-request-target)).

Therefore the verifier must run candidate code with:

- no production credentials;
- a read-only repository token unless an isolated evidence publisher needs narrowly scoped write access in a separate job;
- disposable databases, Redis, object storage, users, organizations, rooms, and browser profiles;
- network access denied by default, with an allowlist only for a declared staging gate;
- hard CPU, memory, process, storage, and wall-clock limits;
- no reusable self-hosted runner for untrusted contributions unless every run is rebuilt ephemerally.

### Protect the evaluator from the evaluated change

GitHub supports required status checks, review requirements, merge queues, non-bypass branch protection, expected check sources, CODEOWNERS approval, and ruleset file-path restrictions. GitHub explicitly recommends owning the `CODEOWNERS` file itself so its protection cannot be silently removed ([GitHub, About code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners), [GitHub, About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), [GitHub, Rules available for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)).

The candidate patch may add tests, but it must not be allowed to define the only verdict on itself. The mandatory workflow and policy should be loaded from the protected default branch or a separately owned reusable-workflow repository at a reviewed immutable revision. Any candidate change to verifier code, required test manifests, golden E2E outcomes, CI workflows, CODEOWNERS, security policies, performance budgets, or baseline metadata requires a human code-owner review and a verifier run using the **pre-change trusted policy**.

### Treat flaky as a distinct result, not a pass

Playwright classifies first-run success, retry success (`flaky`), and retry failure separately; its workers are replaced after failure, and it can retain traces, screenshots, and video on failures or retries ([Playwright, Retries](https://playwright.dev/docs/test-retries), [Playwright, test recording options](https://playwright.dev/docs/test-use-options)). Microsoft describes a production flake system that infers flakes from telemetry, quarantines known flakes without ceasing to run them, files owner-visible bugs, and automatically removes quarantine when the test is healthy again ([Microsoft, Improving developer productivity via flaky test management](https://devblogs.microsoft.com/engineering-at-microsoft/improving-developer-productivity-via-flaky-test-management/)).

MeetLite should use these result classes:

- `PASS`: passed on the first attempt;
- `FLAKY`: failed first, passed on an isolated retry; visible and budget-consuming;
- `FAIL`: failed all allowed attempts;
- `INFRA_ERROR`: environment/setup failure, never reported as product green;
- `QUARANTINED_FAIL`: known flake still executed and reported, with owner and expiry.

A newly flaky test blocks a pull request. Quarantine requires human approval, an issue, an owner, evidence, and a short expiry. A quarantined test cannot cover a critical authorization, tenant-isolation, billing, recording-integrity, migration, or room-admission gate.

### Performance needs absolute thresholds and comparable repeated baselines

k6 thresholds are explicit pass/fail criteria and return a non-zero status when breached; checks alone do not fail a test unless a threshold is attached. Thresholds can enforce error rates, percentiles, and custom metrics, and can abort after an initial sample period ([Grafana k6, Thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/)). Grafana recommends comparable workloads, test data, scripts, and environments; average-load baselines; at least two consecutive runs for pre-release comparison; retained result history; and correlation with application observability ([Grafana k6, Automated performance testing](https://grafana.com/docs/k6/latest/testing-guides/automated-performance-testing/)).

The verifier must apply both:

1. **absolute budgets:** the user-facing SLO or safety ceiling must pass regardless of whether the baseline was worse;
2. **relative budgets:** candidate performance is compared with a same-revision baseline profile from an equivalent environment and workload.

A single noisy run must not establish a regression. The comparison records warm-up, sample size, repetitions, environment fingerprint, variation, and raw summaries. If variation is too high to decide, the result is `INCONCLUSIVE`, not green. Larger stress, spike, soak, and real-media tests remain staging/release gates rather than pull-request gates.

### Canary compares a partial cohort with a control and retains rollback

Google defines canarying as partial, time-limited exposure compared with a control. It recommends reproducible artifacts, small changes, absolute SLO measures as well as control comparison, representative cohorts and durations, and one canary at a time to avoid contaminated signals. Rollback should be automated when validation fails ([Google SRE Workbook, Canarying releases](https://sre.google/workbook/canarying-releases/)).

This supports MeetLite Cage 7's existing rule: hard-stop first, rollback second, diagnosis after containment; no exposure increase while a gate is red.

## Audit of MeetLite's existing verification standard

### What is already good

The current Cage 0–7 model already includes the strongest conceptual pieces found in the sources:

- baseline and pre-existing-failure capture;
- meaningful red evidence;
- minimum coherent implementation slices;
- focused static, unit, integration, and contract checks;
- adversarial identity, concurrency, failure, browser, migration, and upload cases;
- repository and staging system verification;
- diff, security, observability, rollback, and operability review;
- canary control comparison and hard-stop rollback.

Its evidence template is also directionally correct: invariant, scope, rollback, baseline revision/environment, exact commands, adversarial cases, performance, canary, and residual risk.

### What prevents reliable execution today

1. **It is prose-driven.** Nothing currently orchestrates the cages, checks required evidence fields, or proves the commands refer to the candidate revision.
2. **Several canonical commands are placeholders.** At the root, `format:check`, `test:integration`, `test:contracts`, and `test:e2e` currently echo future intent rather than perform checks. An absent or placeholder suite must be `NOT_IMPLEMENTED`, not `PASS`.
3. **There is no checked-in CI control plane.** No `.github/workflows` directory is present, so required checks, protected check provenance, evidence retention, and merge enforcement are not represented in the repository.
4. **E2E coverage is not real yet.** The root E2E command does not launch or exercise signup/login, scheduling, lobby, room media, recording, calendar, or admin journeys.
5. **There is no changed-scope manifest.** Agents and reviewers must manually infer consumers, data migrations, trust boundaries, and required test groups.
6. **There is no regression-budget policy.** “No unexplained regression” is correct but not machine-decidable for latency, memory, bundle size, cost, or browser timing.
7. **There is no flake state machine.** A retry could conceal a regression, and there is no quarantine owner, expiry, or budget.
8. **The verifier is not protected from self-modification.** An agent could change package scripts or tests in the same patch and then cite the weakened command as evidence.
9. **Evidence is hand-authored.** It is not cryptographically or structurally bound to commit SHA, merge base, container image, environment fingerprint, exact command, start/end times, and raw artifacts.
10. **Terminology was inconsistent at audit time.** The execution README called the process “seven verification cages,” but Cage 0 through Cage 7 is eight cages. The roadmap audit corrects this to “eight cages.”

## Proposed `meetlite-verifier` architecture

```text
protected policy revision / verifier image
                   │
                   ▼
          baseline + diff resolver
                   │
                   ▼
     risk and affected-scope classifier
                   │
          ┌────────┼─────────┐
          ▼        ▼         ▼
      static    behavior   system/E2E
      gates      gates      and perf gates
          └────────┼─────────┘
                   ▼
       baseline/candidate comparator
                   │
                   ▼
       signed evidence manifest + artifacts
                   │
                   ▼
       required status from trusted app
```

### 1. Protected policy package

Create a small versioned verifier package, for example:

```text
tools/verifier/
  src/cli.ts
  policy/affected-scopes.yaml
  policy/risk-rules.yaml
  policy/regression-budgets.yaml
  policy/required-flows.yaml
  schema/evidence.schema.json
  schema/baseline.schema.json
```

It exposes these commands:

```text
meetlite-verifier plan --base <sha> --head <sha>
meetlite-verifier baseline --base <sha> --plan <plan.json>
meetlite-verifier verify --head <sha> --plan <plan.json>
meetlite-verifier compare --baseline <dir> --candidate <dir>
meetlite-verifier attest --input <dir> --output <manifest.json>
```

The candidate repository may contain an updated verifier proposal, but the mandatory verdict uses the verifier/policy revision selected from the protected base branch. A second advisory “next-policy” run proves proposed verifier changes before a human owner merges them.

### 2. Baseline and diff resolver

The resolver records:

- merge base, baseline SHA, candidate SHA, and dirty-state rejection;
- changed, renamed, deleted, generated, and binary files;
- lockfile, schema, migration, environment, Docker, CI, auth, room, media, recording, calendar, and verifier changes;
- baseline failures reproduced in the same environment;
- toolchain versions and container-image digest.

Baseline failures are not waived silently. Each must have a stable fingerprint, issue, owner, first-seen revision, allowed scope, and expiry. The candidate is blocked if the failure worsens, spreads, changes fingerprint, or exceeds the accepted budget.

### 3. Risk and affected-scope classifier

The classifier uses explicit path and dependency rules, then produces a human-readable plan before any tests run. Suggested levels:

| Level | Examples | Minimum gate |
| --- | --- | --- |
| L0 docs-only | prose with no executable/config effect | format, link and secret checks |
| L1 local code | isolated UI/component or pure domain function | changed tests, workspace lint/type/build/unit |
| L2 contract/data | API schema, shared package, database query/migration, queue/event | L1 + consumer contracts + integration + migration checks |
| L3 trust/realtime | auth, tenant access, billing, WebSocket, media, recording, OAuth | full adversarial suite + critical E2E + security review |
| L4 deployment/scale | Docker, Cloudflare, k6, infrastructure, canary policy | L3 + staging, performance comparison, rollback drill/canary |

Agents may request **more** checks. Reducing the computed level requires a human verifier owner and leaves an auditable override record.

### 4. Deterministic execution workers

Run checks in disposable containers or VMs with fixed Node/npm/browser versions. Use fresh database schemas and unique run IDs. Freeze or inject time and randomness where applicable. Never share users, rooms, tokens, cache keys, object prefixes, or browser contexts across parallel tests.

Each check emits a structured record containing command, exit status, duration, stdout/stderr artifact digest, test counts, first-run/retry classification, and environment fingerprint. Timeouts are explicit failures or infrastructure errors; they are not skipped checks.

### 5. Real E2E outcome verifier

Implement Playwright journeys around user-visible and durable outcomes:

1. signup/login/logout/token refresh and family-reuse rejection;
2. quick meeting creation → lobby local preview → join → first local/remote media;
3. second participant admission → reconnect → no duplicate seat → leave cleanup;
4. scheduled meeting → invite → dashboard/calendar appearance → join authorization;
5. Google OAuth state round-trip with fake/provider sandbox → idempotent event create/update/cancel;
6. recording starts → host leaves → recorder continues → R2 completion → authorized replay/download;
7. collaboration update → batching/compaction → simulated DO restart → state recovery; awareness is absent from persistence;
8. admin authorization, measured health/audit data, pagination, and forbidden non-admin access.

Assertions inspect browser state **and** authoritative outcomes: API response schema, database rows, Redis/queue state where owned, storage object completion, socket acknowledgements, track state, and correlated telemetry. For WebRTC, synthetic media and two independent browser contexts are required; an HTTP 200 or Socket.IO polling request is not a media success.

Retain trace, screenshot, video, console, network log, service logs keyed by correlation ID, and sanitized DB/storage outcome snapshots on failure or first retry.

### 6. Regression comparator

Use three gate types:

- **binary invariants:** zero new test failures, type/lint/build errors, high/critical security findings, authorization bypasses, data loss, duplicate billing, recording corruption, secret exposure, or migration incompatibility;
- **absolute budgets:** published SLOs and resource ceilings;
- **relative budgets:** candidate-to-baseline change under identical profile and environment.

Provisional starting budgets below are recommendations to calibrate with MeetLite measurements, not universal industry constants:

| Signal | Suggested PR/release rule |
| --- | --- |
| changed-line coverage | no more than 0.5 percentage-point drop; security/domain policy changed lines require direct tests |
| client JS initial route | no unapproved increase above 3% or 50 KiB compressed, whichever is smaller |
| focused microbenchmark | block above 10% median regression after warm-up and repeated stable runs |
| API/load p95 | pass absolute SLO and no more than 10% regression in comparable repeated runs |
| API/load p99 | pass absolute SLO and no more than 15% regression |
| error/check rate | pass absolute SLO; no statistically/materially meaningful increase, with 0 new critical-flow failures |
| process/browser memory | no more than 10% retained-memory regression after fixed workload and cleanup |
| join-to-first-media | pass absolute SLO and no more than 10% regression in staging browser profile |
| cost per successful journey | no more than 5% unapproved increase at the certified workload mix |

Performance checks require at least two consecutive comparable candidate runs and a baseline with acceptable variance. If the environment coefficient of variation exceeds the policy ceiling, rerun once in a fresh environment; continued instability produces `INCONCLUSIVE` and blocks a performance claim.

### 7. Flake registry

Store quarantine records outside ordinary test source, for example `verification/quarantine.yaml`, but protect it with CODEOWNERS. Each entry contains exact test ID, fingerprint, owner, issue, evidence, first seen, expiry, maximum observed rate, and whether it is allowed to be non-blocking. The verifier always executes quarantined tests and reports their health.

Suggested policy:

- one isolated retry only in pull-request verification;
- retry success is `FLAKY`, never `PASS`;
- any new flake blocks;
- quarantine expires in seven days by default;
- no quarantine for security/data/billing/media-admission invariants;
- nightly repetition measures flake rate and automatically proposes removal only after a defined healthy window;
- a flake-budget breach freezes new feature merges until reliability is restored.

### 8. Evidence artifacts

Every run should publish a schema-validated `verification-manifest.json` containing:

- verifier and policy version/digest;
- base/head SHA and diff digest;
- risk level and selected/omitted checks with reasons;
- environment and service-image digests;
- commands, exit codes, counts, durations, flakes, quarantines, and infrastructure errors;
- baseline/candidate metric pairs, sample sizes, variation, and decisions;
- sanitized artifact URIs plus SHA-256 digests;
- hard-stop, rollback, canary, owner, expiry, and approval fields;
- overall state: `PASS`, `FAIL`, `INCONCLUSIVE`, or `NOT_IMPLEMENTED`.

Generate the human-readable Cage evidence Markdown from this manifest. Do not use manually written prose as the source of truth. Sign/attest the manifest in a separate trusted job after untrusted test execution has ended.

### 9. CI and ownership boundary

Recommended enforcement:

- `pull_request` workflow with read-only token and no production secrets runs candidate code in ephemeral hosted compute;
- a separately protected reusable workflow or verifier image supplies mandatory policy;
- evidence publishing receives only sanitized artifacts and has no ability to execute them;
- required checks are accepted only from the designated GitHub App/workflow;
- branch/ruleset protection requires checks against the latest merge result, code-owner review, resolved conversations, and no bypass for agents;
- merge queue reruns the required checks on the queued merge group;
- CODEOWNERS covers `.github/**`, `tools/verifier/**`, verifier policy/schema, E2E golden outcomes, load-test budgets, migration rules, security tests, and `CODEOWNERS` itself;
- third-party Actions are locked or pinned to reviewed full SHAs, and job permissions are explicit and minimal.

An agent can author a proposed guardrail update. It cannot approve that update, select its own baseline, remove the current gate for its run, write the required status, or access production/canary credentials.

## Mapping onto Cage 0 through Cage 7

| Existing cage | Executable verifier responsibility | Required artifact |
| --- | --- | --- |
| Cage 0 — evidence boundary | resolve base/head, reject dirty state, classify risk/scope, capture comparable baseline and known failures | `plan.json`, `baseline-manifest.json` |
| Cage 1 — meaningful red | record fail-to-pass test failing against baseline/pre-fix state for the intended reason; mechanical refactor uses characterization baseline | red test log and fingerprint |
| Cage 2 — minimum slice | candidate targeted tests green; scope/diff policy catches undeclared change | candidate focused result and diff manifest |
| Cage 3 — focused checks | formatter, lint, type/build, unit, integration/contracts selected from affected-scope graph | JUnit/SARIF/log records |
| Cage 4 — adversarial | select mandatory abuse/failure/concurrency/browser/migration tests by changed risk domains | adversarial matrix with outcomes |
| Cage 5 — system | preservation suite, consumer contracts, critical Playwright flows, comparable performance where required | E2E traces and comparison report |
| Cage 6 — security/operability | secret/dependency/code scans, architecture rules, migration/flag/telemetry/rollback checks, full diff inventory | SARIF, SBOM/dependency diff, operability checklist |
| Cage 7 — canary/closure | deploy immutable artifact to bounded cohort, compare control and absolute SLOs, automatically stop/rollback | canary manifest, dashboard snapshot, rollback result |

## Delivery plan

### Phase V0 — make the command contract truthful

1. Replace every echo-only root verification script with a real check or an explicit failing `NOT_IMPLEMENTED` result.
2. Add stable JUnit/JSON output to backend and client tests.
3. Correct the standard to say eight cages.
4. Define the first critical flow and risk/path mapping.

**Exit:** no placeholder can be mistaken for a pass.

### Phase V1 — deterministic local verifier

1. Implement `plan`, affected-scope selection, command execution, timeouts, and the evidence schema.
2. Add base/head binding and known-failure ledger.
3. Add structural tests for the highest-risk MeetLite engineering rules.
4. Generate Cage evidence Markdown from the manifest.

**Exit:** `npm run verify -- --base <sha>` produces the same decision from a clean checkout.

### Phase V2 — critical browser flows

1. Add Playwright with disposable fixtures and two-browser synthetic-media support.
2. Implement login, quick-meeting lobby/join/reconnect/leave, scheduling, and recording continuity first.
3. Add trace/video/log retention and authoritative backend outcome checks.
4. Add retry classification and protected quarantine registry.

**Exit:** intentional breakages in routing, CORS, auth, media join, seat accounting, and recording continuity each fail the expected E2E gate.

### Phase V3 — independent CI enforcement

1. Add protected CI/reusable workflow, least-privilege permissions, immutable action references, required status source, CODEOWNERS, and rulesets.
2. Load mandatory policy from the protected base revision.
3. Separate untrusted execution from trusted evidence attestation.
4. Enable merge-queue verification if the repository uses a queue.

**Exit:** a pull request that weakens or removes its own verifier cannot make itself mergeable.

### Phase V4 — performance and staging gates

1. Connect the repaired k6 harness to verifier manifests and observability correlation IDs.
2. Establish stable environment fingerprints, repeated baselines, absolute SLOs, and calibrated regression budgets.
3. Add scheduled average-load runs, then controlled spike/stress/soak and real-browser media runs.
4. Implement canary comparison and automated rollback evidence.

**Exit:** MeetLite can distinguish functional capacity, signalling capacity, and real media capacity, and every published number is bound to a revision, workload, environment, SLO, and evidence bundle.

## Acceptance criteria for the verifier project

The verifier is ready for mandatory use only when all of these are demonstrated:

1. a known good patch passes and a seeded regression in each critical domain fails;
2. a test deletion, skipped suite, zero-test run, placeholder command, or malformed result fails closed;
3. a patch modifying verifier policy is graded by the prior protected policy and requires human owner approval;
4. E2E gates assert durable/backend outcomes and preserve failure traces;
5. retry success is reported as flaky and cannot silently satisfy the no-regression gate;
6. base and candidate performance runs are comparable, repeated, and can return `INCONCLUSIVE`;
7. evidence is schema-valid, commit-bound, artifact-digested, secret-scanned, and reproducible;
8. untrusted code cannot access production secrets, write repository status, poison shared runner state, or replace the mandatory workflow;
9. the canary has a bounded cohort, absolute and comparative stop conditions, and a tested rollback;
10. the verifier itself has unit, integration, adversarial, and seeded-failure tests.

## Recommended decision

Approve the current eight-cage standard as the policy foundation, but do not describe agent changes as independently verified until V0–V3 are complete. Build the verifier before expanding autonomous agent merge rights. Begin with one protected critical journey—quick meeting creation through lobby, two-party media, reconnect, seat preservation, and leave cleanup—then add scheduling/calendar and recording continuity. This yields a real end-to-end safety signal early while the wider suite grows.
