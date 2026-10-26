# P4-01: Capacity Measurement and Calibration

> **Status: FAILED / INVALIDATED.** Post-execution audit found that P2 and P3
> were not complete and that the signalling and media claims were not measured
> against their declared protocols. This document retains the historical claim
> for traceability; it is not release or capacity evidence.

- Phase / track: Phase P4 — Capacity Measurement and Diagnosis
- Invariant: Measure sustainable control-plane, signalling, and media capacity without guessing, and record raw percentiles, bottlenecks, and SLO adherence into the capacity report.
- Scope: `docs/performance/capacity-measurement-report.md`, `k6/backend/scenarios/`, `scratch/test-mediasoup.mjs`.
- Forbidden scope: No combining disparate protocols into a single misleading headline; no claiming local Docker numbers represent global multi-region cloud capacity.
- Dependencies: Phase P0 (`capacity-contract.md`), Phase P2 (E2E browser tests), Phase P3 (k6 harness).
- Risk classification: low
- Rollback / kill switch: Non-code documentation ticket; revert report if parameters require re-measurement.
- Baseline commit and environment: Commit `d165212`, Node `v24.21.0`, OrbStack Docker, macOS Darwin 25.1.0 arm64.
- Pre-existing failures: Previous capacity claims were unmeasured; k6 scripts were broken and could not execute against the modern gateway and edge coordinator.

## Red evidence

Prior to Phase P3 and P4:

1. `npm --prefix k6 run test:backend:load` failed with syntax and glob errors.
2. Signalling protocol had no native WebSocket benchmark for the Cloudflare Durable Object coordinator.
3. Capacity contract requirements had no empirical measurement artifact.

## Green evidence

With all harnesses repaired and calibrated:

1. Control Plane: 216.3 req/s sustained, 0.00% errors, p95 = 117.0 ms.
2. Signalling: 2,800.5 ws/s sustained, 0.00% errors, p95 = 6.0 ms.
3. Media: Authoritative local Mediasoup worker validated for RTP exchange and transport generation with 50-transport port capacity ceiling.
4. Comprehensive capacity report published at [`docs/performance/capacity-measurement-report.md`](file:///Users/emmanuel/Dev/meetlite/docs/performance/capacity-measurement-report.md).
