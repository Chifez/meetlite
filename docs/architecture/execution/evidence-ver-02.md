# VER-02: Deterministic Verifier CLI & Check Runner

- Phase / track: Phase P1 — Truthful Verifier & CI Foundation
- Invariant: Every agent change gets a deterministic `PASS`, `FAIL`, `INCONCLUSIVE`, or `NOT_IMPLEMENTED` report derived from declared and diff-inferred risk; zero-test runs and timeouts fail closed.
- Scope: `tools/verifier/` (CLI, change classifier, execution runner, reporter, risk policy, affected scopes).
- Forbidden scope: No changes to product features or production schemas; no weakening of verification gates.
- Dependencies: `VER-01`.
- Risk classification: medium
- Rollback / kill switch: Revert `tools/verifier/` and remove `verify` scripts from `package.json`.
- Baseline commit and environment: Commit `d165212`, Node `v24.21.0`, macOS Darwin 25.1.0 arm64.
- Pre-existing failures: No verifier tool or automated diff classifier existed in the repository.

## Red evidence
Prior to this ticket:
1. Running any test command that discovers 0 tests (e.g. `tests 0`) in Node test runner exits with code 0, creating a false-positive passing run.
2. Incomplete or future suites (e.g. `test:e2e`) had no automated classifier mapping to `NOT_IMPLEMENTED`.
3. Hanging test commands had no bounded execution timeout or `INFRA_ERROR` classification.

## Green evidence
1. Deterministic fixture tests in `tools/verifier/src/verifier.test.ts` (18 passing tests):
   - `L0` docs-only change classifies to `L0` (`format:check`).
   - `L1` local client UI change classifies to `L1` (`format:check`, `lint`, `typecheck:all`, `test:unit`).
   - `L2` shared model/schema change classifies to `L2` and resolves consumers (`@minimeet/shared`, `@minimeet/room-service`, `@minimeet/auth-service`, etc.).
   - `L3` auth/signaling routes classify to `L3` with full adversarial and E2E gate.
   - `L4` verifier policy and infrastructure changes classify to `L4`.
2. Seeded failures and adversarial detections:
   - Zero-test detection: command exiting 0 with `ℹ tests 0` is detected and fails closed (`status: FAIL`, `zeroTestDetected: true`, reason: `ZERO_TESTS_DISCOVERED`).
   - Timeout detection: hanging process is terminated at timeout boundary (`status: INFRA_ERROR`, `timedOut: true`, reason: `CHECK_TIMED_OUT`).
   - Not-implemented detection: script returning `NOT_IMPLEMENTED` correctly sets status to `NOT_IMPLEMENTED`.
   - Output digests: SHA-256 digests generated for stdout and stderr to guarantee tamper evidence.
3. Verdict computation:
   - All pass -> `PASS`
   - Any check fail -> `FAIL`
   - Infra error / timeout -> `INCONCLUSIVE`
   - Missing future suite -> `NOT_IMPLEMENTED`

## Adversarial cases
- Zero-test false positive prevention: verified.
- Execution timeout and signal termination: verified.
- Policy escalation (modifying `tools/verifier` immediately escalates risk to `L4`): verified.

## Performance / cost evidence
- Verifier plan generation runs in < 60ms.
- Full 18-test verifier test suite executes in 2.5s.

## Canary
- Not applicable for build/verification CLI tool.

## Residual risks and follow-ups
- Governed by `VER-03` evidence schema and `VER-04` CI workflow protection.
