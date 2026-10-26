# VER-03: Versioned Evidence Schema & Immutable Manifest Validation

- Phase / track: Phase P1 — Truthful Verifier & CI Foundation
- Invariant: Verification reports must conform to an immutable versioned JSON Schema bound to commit SHAs, stdout/stderr digests, and risk levels; malformed or tampered evidence fails closed.
- Scope: `verification/schemas/report-v1.json`, `tools/verifier/src/reporter.ts`.
- Forbidden scope: No hand-authored pass status; no unvalidated JSON output.
- Dependencies: `VER-01`, `VER-02`.
- Risk classification: medium
- Rollback / kill switch: Revert schema and reporter changes.
- Baseline commit and environment: Commit `d165212`, Node `v24.21.0`, macOS Darwin 25.1.0 arm64.
- Pre-existing failures: Verification evidence was previously hand-written in Markdown without programmatic schema validation, SHA binding, or digest verification.

## Red evidence
Prior to this ticket:
1. Manifests could contain arbitrary fields or missing SHAs without validation.
2. Tampered or corrupted manifests (e.g. invalid `schemaVersion`, corrupt SHA string, or non-array checks) were not detected.

## Green evidence
1. JSON Schema Draft-07 created at `verification/schemas/report-v1.json`.
2. Valid report generation:
   - Successfully generates schema-valid `verification-manifest.json` with commit SHAs (`baseSha`, `headSha`), `riskLevel`, `verdict`, environment metadata, test counts, durations, and SHA-256 digests.
   - Generates human-readable Markdown evidence tables matching the repository template.
3. Seeded validation failure test:
   - When a corrupted manifest (`schemaVersion: '2.0.0'`, `baseSha: 'not-a-sha'`, `checks: 'not-an-array'`) is evaluated against `validateManifestAgainstSchema()`, it fails closed (`valid: false`, `errors.length >= 3`).
   - Proven by unit test in `tools/verifier/src/verifier.test.ts`.

## Adversarial cases
- Invalid `schemaVersion` rejected.
- Non-hex or invalid length SHAs rejected.
- Unrecognized risk level or verdict rejected.
- Check with `zeroTestDetected: true` but status `PASS` rejected.

## Performance / cost evidence
- Schema validation executes in < 1ms per manifest.

## Canary
- Not applicable for schema definition and validator.

## Residual risks and follow-ups
- Integrated into CI in ticket `VER-04`.
