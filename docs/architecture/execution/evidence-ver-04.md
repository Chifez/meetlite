# VER-04: CI Workflows & Protected Ownership

- Phase / track: Phase P1 — Truthful Verifier & CI Foundation
- Invariant: Candidate code cannot weaken or replace its own mandatory verification gates, CI workflows, Code Owners, or risk policies without human code-owner approval.
- Scope: `.github/workflows/verifier.yml`, `.github/CODEOWNERS`.
- Forbidden scope: No production secrets; no bypass permissions for autonomous agents.
- Dependencies: `VER-01`, `VER-02`, `VER-03`.
- Risk classification: medium
- Rollback / kill switch: Revert commit adding `.github/` workflow and codeowners.
- Baseline commit and environment: Commit `d165212`, Node `v24.21.0`, macOS Darwin 25.1.0 arm64.
- Pre-existing failures: No `.github` workflows or CODEOWNERS file existed in the repository at audit time.

## Red evidence
Prior to this ticket:
1. No CI workflow existed in `.github/workflows/` to enforce automated verifier runs.
2. No `CODEOWNERS` file existed to protect `tools/verifier/`, `verification/`, `.github/`, database schemas, or media engines from unauthorized agent modification.

## Green evidence
1. `.github/CODEOWNERS` created and mapped to explicit technical domain owners defined in `docs/architecture/execution/ownership-and-environments.md`:
   - Protected paths include `/.github/`, `/tools/verifier/`, `/verification/`, `/docs/architecture/execution/`, `/docs/architecture/decisions/`, `/docs/performance/capacity-contract.md`, auth/identity, media engines, and durable storage.
2. `.github/workflows/verifier.yml` created:
   - Enforces clean checkouts (`actions/checkout@v4` with `fetch-depth: 0`).
   - Runs on ephemeral Ubuntu runner with least-privilege `contents: read` permissions.
   - Pinned Node.js 22 runtime.
   - Executes `meetlite-verifier` against base and head SHAs.
   - Retains `verification-manifest.json` and `verification-report.md` artifacts for 14 days.
3. System verification:
   - Full verifier run (`npm run verify -- --allow-dirty`) executed locally and generated schema-valid `verification-manifest.json` and `verification-report.md`.
   - All 6 implemented gates passed (`format:check`, `lint`, `typecheck:all`, `test:unit`, `test:integration`, `test:contracts`).
   - E2E truthfully reported as `NOT_IMPLEMENTED`.

## Adversarial cases
- Any modification to `.github/`, `tools/verifier/`, or `verification/` triggers `L4` risk level in `ChangeClassifier` and requires code-owner approval.
- Candidate PR cannot bypass required checks or weaken test runner exit criteria.

## Performance / cost evidence
- CI workflow runner requires ~1 minute for clean install and checks.

## Canary
- Not applicable for CI workflow definitions.

## Residual risks and follow-ups
- Phase P1 is now complete. Proceeding to Phase P2 (`E2E-01` through `E2E-05`: Protected browser product flows).
