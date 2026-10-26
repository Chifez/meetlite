# VER-01: Truthful Repository Verification Commands & Lint Alignment

- Phase / track: Phase P1 — Truthful Verifier & CI Foundation
- Invariant: No required repository check can pass through empty `echo` placeholders, unhandled linter crashes, or falsified test discovery.
- Scope: Root `package.json`, `client/eslint.config.js`, `client/src/components/room/collaboration/code-panel.tsx`, `client/src/components/sidebar/teams-switcher.tsx`, `client/src/lib/yjs/yjs-provider.ts`, `tools/scripts/format-check.mjs`, `.prettierrc`.
- Forbidden scope: No product feature changes, no weakening of typecheck rules, no mocking of E2E suites.
- Dependencies: Phase P0 baseline (`docs/architecture/execution/evidence-p0-baseline.md`).
- Risk classification: low
- Rollback / kill switch: Revert commit updating root `package.json` scripts and restore prior configuration.
- Baseline commit and environment: Commit `d165212`, Node `v24.21.0`, macOS Darwin 25.1.0 arm64.
- Pre-existing failures: `npm run lint` crashed in client with `Cannot find package 'typescript-eslint'`; `format:check`, `test:integration`, `test:contracts`, and `test:e2e` were successful `echo` placeholders.

## Red evidence
Prior to this ticket:
1. `npm run lint`:
   ```text
   Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'typescript-eslint' imported from client/eslint.config.js
   Lifecycle script `lint` failed with error: code 2
   ```
2. Placeholder scripts returning false-positive exit code `0`:
   - `npm run format:check` -> `echo 'Format check placeholder: format tool to be configured in R0 tooling'` (exit 0)
   - `npm run test:integration` -> `echo 'Integration harness...'` (exit 0)
   - `npm run test:contracts` -> `echo 'Contracts harness...'` (exit 0)
   - `npm run test:e2e` -> `echo 'E2E harness: Playwright E2E configured for staging gates'` (exit 0)
3. Seeded formatting failure:
   When `tools/scripts/seeded-format-failure.ts` was introduced, `npm run format:check` returned exit code 1 with:
   `[format:check] ✗ File is not properly formatted: tools/scripts/seeded-format-failure.ts`
   `[format:check] FAILED: 2 file(s) failed formatting check.`

## Green evidence
1. `npm run format:check`:
   ```text
   > meetlite@1.0.0 format:check
   > node tools/scripts/format-check.mjs

   [format:check] Checking whitespace and formatting on touched files...
   [format:check] PASSED: 7 touched file(s) verified.
   Exit code: 0
   ```
2. `npm run lint`:
   ```text
   > meetlite@1.0.0 lint
   > npm run lint --workspaces --if-present

   > meetlite-video-app@1.0.0 lint
   > eslint .

   490 problems (0 errors, 490 warnings)
   Exit code: 0
   ```
3. `npm run test:integration`:
   ```text
   > meetlite@1.0.0 test:integration
   > npx tsx --test 'backend/packages/**/src/**/*integration*.test.ts'

   ✔ S2-03: End-to-End Client-Coordinator Integration & Protocol Contract (46.458709ms)
   ℹ tests 3
   ℹ suites 1
   ℹ pass 3
   ℹ fail 0
   Exit code: 0
   ```
4. `npm run test:contracts`:
   ```text
   > meetlite@1.0.0 test:contracts
   > npx tsx --test 'backend/packages/**/src/**/*contract*.test.ts'

   ✔ S2-03: End-to-End Client-Coordinator Integration & Protocol Contract (26.152625ms)
   ✔ P0-02: Safe Database Delivery & Migration Contract (3.050042ms)
   ℹ tests 7
   ℹ suites 2
   ℹ pass 7
   ℹ fail 0
   Exit code: 0
   ```
5. `npm run test:e2e` (truthful `NOT_IMPLEMENTED` non-zero exit):
   ```text
   > meetlite@1.0.0 test:e2e
   > node -e "console.error('NOT_IMPLEMENTED: E2E harness scheduled for Phase P2 (E2E-01)'); process.exit(1)"

   NOT_IMPLEMENTED: E2E harness scheduled for Phase P2 (E2E-01)
   Exit code: 1
   ```
6. Full regression gates pass:
   - `npm run typecheck:all`: Exit 0 (all 6 backend packages pass `tsc --noEmit`, client passes `tsc -b && vite build`)
   - `npm run test:unit`: Exit 0 (185 tests pass)
   - `npm run test --workspace=client`: Exit 0 (8 tests pass)

## Adversarial cases
- Unformatted touched file triggers non-zero exit code 1.
- Merge conflict markers / git whitespace errors trigger non-zero exit code 1 via `git diff --check`.
- Absent E2E harness exits 1 immediately rather than claiming false completion.

## Performance / cost evidence
- Formatting check on touched files runs in < 400ms.
- Integration tests execute in 775ms.
- Contract tests execute in 535ms.

## Canary
- Not applicable for build/verification command wiring.

## Residual risks and follow-ups
- Phase P2 (`E2E-01` through `E2E-05`) will replace the `NOT_IMPLEMENTED` script in `test:e2e` with the real Playwright browser test harness.
- Phase P1 next ticket is `VER-02` (Verifier Core CLI).
