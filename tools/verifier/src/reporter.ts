import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CheckResult,
  OverallVerdict,
  VerificationManifest,
  VerificationPlan,
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function computeOverallVerdict(checks: CheckResult[]): OverallVerdict {
  if (
    checks.some((c) => ['FAIL', 'FLAKY', 'QUARANTINED_FAIL'].includes(c.status))
  ) {
    return 'FAIL';
  }
  if (checks.some((c) => c.status === 'INFRA_ERROR')) {
    return 'INCONCLUSIVE';
  }
  if (checks.some((c) => c.status === 'NOT_IMPLEMENTED')) {
    return 'NOT_IMPLEMENTED';
  }
  return 'PASS';
}

export function buildManifest(
  plan: VerificationPlan,
  checks: CheckResult[],
  durationMs: number
): VerificationManifest {
  const verdict = computeOverallVerdict(checks);
  const summary = {
    totalChecks: checks.length,
    passedChecks: checks.filter((c) => c.status === 'PASS').length,
    failedChecks: checks.filter((c) => c.status === 'FAIL').length,
    notImplementedChecks: checks.filter((c) => c.status === 'NOT_IMPLEMENTED')
      .length,
    infraErrorChecks: checks.filter((c) => c.status === 'INFRA_ERROR').length,
  };

  return {
    schemaVersion: '1.0.0',
    verifierVersion: '1.0.0',
    baseSha: plan.baseSha,
    headSha: plan.headSha,
    isDirty: plan.isDirty,
    riskLevel: plan.riskLevel,
    verdict,
    timestamp: new Date().toISOString(),
    durationMs,
    environment: {
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
      ci: Boolean(process.env.CI),
    },
    affectedScopes: plan.affectedScopes,
    changedFiles: plan.changedFiles,
    checks,
    summary,
  };
}

export function validateManifestAgainstSchema(
  manifest: VerificationManifest,
  schemaPath?: string
): { valid: boolean; errors: string[] } {
  const resolvedSchemaPath =
    schemaPath ||
    path.resolve(__dirname, '../../../verification/schemas/report-v1.json');
  if (!fs.existsSync(resolvedSchemaPath)) {
    return {
      valid: false,
      errors: [`Schema file not found at ${resolvedSchemaPath}`],
    };
  }

  const errors: string[] = [];

  // Fail-closed structural validation. The JSON schema is the public contract;
  // these checks deliberately mirror its required security/release fields.
  if (manifest.schemaVersion !== '1.0.0') {
    errors.push(
      `Invalid schemaVersion: expected 1.0.0, got ${manifest.schemaVersion}`
    );
  }
  if (!manifest.baseSha || !/^[0-9a-f]{7,40}$/i.test(manifest.baseSha)) {
    errors.push(`Invalid baseSha: ${manifest.baseSha}`);
  }
  if (!manifest.headSha || !/^[0-9a-f]{7,40}$/i.test(manifest.headSha)) {
    errors.push(`Invalid headSha: ${manifest.headSha}`);
  }
  if (!['L0', 'L1', 'L2', 'L3', 'L4'].includes(manifest.riskLevel)) {
    errors.push(`Invalid riskLevel: ${manifest.riskLevel}`);
  }
  if (
    !['PASS', 'FAIL', 'INCONCLUSIVE', 'NOT_IMPLEMENTED'].includes(
      manifest.verdict
    )
  ) {
    errors.push(`Invalid verdict: ${manifest.verdict}`);
  }
  if (!Array.isArray(manifest.checks)) {
    errors.push(`Checks must be an array`);
  } else {
    for (const [idx, check] of manifest.checks.entries()) {
      if (!check.name || !check.command || !check.status) {
        errors.push(
          `Check at index ${idx} missing required fields (name, command, status)`
        );
      }
      if (
        ![
          'PASS',
          'FAIL',
          'FLAKY',
          'INFRA_ERROR',
          'NOT_IMPLEMENTED',
          'QUARANTINED_FAIL',
        ].includes(check.status)
      ) {
        errors.push(
          `Check ${check.name || idx} has invalid status ${check.status}`
        );
      }
      if (!Number.isFinite(check.durationMs) || check.durationMs < 0) {
        errors.push(`Check ${check.name || idx} has invalid durationMs`);
      }
      if (!Number.isInteger(check.exitCode)) {
        errors.push(`Check ${check.name || idx} has invalid exitCode`);
      }
      if (!/^[0-9a-f]{64}$/i.test(check.stdoutDigest || '')) {
        errors.push(`Check ${check.name || idx} has invalid stdoutDigest`);
      }
      if (!/^[0-9a-f]{64}$/i.test(check.stderrDigest || '')) {
        errors.push(`Check ${check.name || idx} has invalid stderrDigest`);
      }
      if (check.zeroTestDetected && check.status !== 'FAIL') {
        errors.push(
          `Check ${check.name} has zeroTestDetected=true but status is not FAIL`
        );
      }
    }
  }

  if (!Number.isFinite(manifest.durationMs) || manifest.durationMs < 0) {
    errors.push(`Invalid durationMs: ${manifest.durationMs}`);
  }
  if (!Array.isArray(manifest.affectedScopes)) {
    errors.push(`affectedScopes must be an array`);
  }
  if (!Array.isArray(manifest.changedFiles)) {
    errors.push(`changedFiles must be an array`);
  }
  if (!manifest.environment || typeof manifest.environment !== 'object') {
    errors.push(`environment must be an object`);
  }
  if (
    !manifest.summary ||
    manifest.summary.totalChecks !== manifest.checks?.length
  ) {
    errors.push(`summary.totalChecks must match checks length`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function renderMarkdownReport(manifest: VerificationManifest): string {
  const checkRows = manifest.checks
    .map(
      (c) =>
        `| \`${c.name}\` | \`${c.command}\` | **${c.status}** | ${c.durationMs}ms | ${c.exitCode} | ${c.testCount !== undefined ? c.testCount : '-'} | ${c.failureReason || 'None'} |`
    )
    .join('\n');

  return `# Verification Report: ${manifest.verdict}

- **Verdict**: **\`${manifest.verdict}\`**
- **Risk Level**: \`${manifest.riskLevel}\`
- **Base SHA**: \`${manifest.baseSha}\`
- **Head SHA**: \`${manifest.headSha}\`
- **Working Tree Clean**: \`${!manifest.isDirty}\`
- **Environment**: Node \`${manifest.environment.nodeVersion}\`, \`${manifest.environment.platform}-${manifest.environment.arch}\`
- **Generated At**: \`${manifest.timestamp}\`
- **Duration**: \`${manifest.durationMs}ms\`

## Affected Scopes
${manifest.affectedScopes.length > 0 ? manifest.affectedScopes.map((s) => `- \`${s}\``).join('\n') : '_None_'}

## Checks Execution Matrix
| Check | Command | Status | Duration | Exit Code | Tests | Notes |
| --- | --- | --- | --- | --- | --- | --- |
${checkRows}

## Summary
- Total Checks: ${manifest.summary.totalChecks}
- Passed: ${manifest.summary.passedChecks}
- Failed: ${manifest.summary.failedChecks}
- Not Implemented: ${manifest.summary.notImplementedChecks}
- Infra Errors: ${manifest.summary.infraErrorChecks}
`;
}
