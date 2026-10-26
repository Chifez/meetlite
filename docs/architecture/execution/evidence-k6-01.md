# K6-01: K6 Runner and Configuration Validation

- Phase / track: Phase P3 — Truthful k6 and Protocol Load Harness
- Invariant: Load test runner correctly discovers scenario files, validates syntax, passes environment variables, applies test type stages/thresholds without silent syntax errors or missing test files.
- Scope: `k6/package.json`, `k6/run-tests.js`, `k6/config/index.js`, `k6/config/test-types.js`, `k6/shared/test-executors.js`.
- Forbidden scope: No dummy runs passing with exit code 0 on missing test files or unhandled syntax exceptions.
- Dependencies: Phase P0 capacity contract, Phase P1 verifier, native k6 binary.
- Risk classification: low
- Rollback / kill switch: Revert k6 configuration changes.
- Baseline commit and environment: Commit `d165212`, Node `v24.21.0`, k6 v2.3.0, macOS Darwin 25.1.0 arm64.
- Pre-existing failures: `npm --prefix k6 run validate` failed due to non-existent wildcard paths; `k6/run-tests.js` failed with `await glob(...) is not a function` under Node 24 ESM; `k6/config/test-types.js` contained typos `threholds` and `http_reg_duration`; `k6/config/index.js` imported unused `k6` module breaking Node CLI runner.

## Red evidence
Prior to this implementation:
1. `npm --prefix k6 run validate`:
   ```text
   node -c config/*.js utils/*.js scenarios/*/*.js
   node:fs:601: Cannot find module '.../scenarios/*/*.js'
   npm error Lifecycle script `validate` failed with error: 1
   ```
2. `node run-tests.js backend load`:
   ```text
   TypeError: glob is not a function
       at runTests (file:///Users/emmanuel/Dev/meetlite/k6/run-tests.js:262:27)
   ```
3. Typo in `k6/config/test-types.js`:
   `threholds` prevented k6 from enforcing failure thresholds on stress scenarios.

## Green evidence
With `glob.sync` properly imported, `validate` script aligned with scenario structure, typos corrected, and `k6` import cleanly separated:
1. `npm --prefix k6 run validate`:
   ```text
   > @minimeet/k6-tests@1.0.0 validate
   > node -c config/*.js shared/*.js scripts/*.js backend/utils/*.js backend/scenarios/*/*.js
   ```
   Exits with code 0.
2. `node run-tests.js --help`:
   ```text
   🚀 MeetLite K6 Test Runner
   ==========================

   Usage:
     node run-tests.js [category] [test-type]

   Categories:
     backend
     frontend
   ...
   ```
   Exits with code 0.
