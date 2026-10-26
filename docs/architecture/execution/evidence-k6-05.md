# K6-05: Frontend Smoke and Performance Reporting

- Phase / track: Phase P3 — Truthful k6 and Protocol Load Harness
- Invariant: Frontend HTTP performance, SPA deep-linking, and static bundle delivery are verified under load with automated latency and error rate thresholds.
- Scope: `k6/frontend/scenarios/client/load.js`, `k6/run-tests.js`, `k6/package.json`.
- Forbidden scope: No passing tests when client server returns 404 or missing root div.
- Dependencies: Running `meetlite-client` on port 5175, k6 runner.
- Risk classification: low
- Rollback / kill switch: Revert `k6/frontend/scenarios/client/load.js`.
- Baseline commit and environment: Commit `d165212`, Node `v24.21.0`, k6 v2.3.0, Nginx client container on port 5175.
- Pre-existing failures: `k6/package.json` had a script `test:frontend:load`, but the `k6/frontend` directory did not exist, causing `run-tests.js` to log a warning and exit without testing anything.

## Red evidence
Prior to this implementation:
```text
node run-tests.js frontend load
⚠️  No load files found in frontend
```
Zero tests discovered or executed.

## Green evidence
With `k6/frontend/scenarios/client/load.js` created and executed against real client:
```text
k6 run --vus 5 --duration 5s frontend/scenarios/client/load.js

  █ THRESHOLDS 
    frontend_home_duration
    ✓ 'p(95)<500' p(95)=0.74325
    frontend_lobby_duration
    ✓ 'p(95)<500' p(95)=0.748
    frontend_login_duration
    ✓ 'p(95)<500' p(95)=0.737
    frontend_request_success
    ✓ 'rate>0.98' rate=100.00%

  █ TOTAL RESULTS 
    checks_total.......: 149364  29864.658894/s
    checks_succeeded...: 100.00% 149364 out of 149364
    checks_failed......: 0.00%   0 out of 149364

    ✓ home status is 200
    ✓ home contains root div
    ✓ home duration < 500ms
    ✓ login page status is 200
    ✓ login page contains html
    ✓ login duration < 500ms
    ✓ lobby page status is 200
    ✓ lobby page contains root div
    ✓ lobby duration < 500ms
```
149,364 checks passed, 100% success rate, p95 durations under 1ms.
