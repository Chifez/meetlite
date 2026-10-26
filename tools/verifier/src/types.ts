export type RiskLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

export type CheckStatus =
  | 'PASS'
  | 'FAIL'
  | 'FLAKY'
  | 'INFRA_ERROR'
  | 'NOT_IMPLEMENTED'
  | 'QUARANTINED_FAIL';

export type OverallVerdict =
  'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'NOT_IMPLEMENTED';

export interface VerificationPlan {
  baseSha: string;
  headSha: string;
  isDirty: boolean;
  riskLevel: RiskLevel;
  riskReason: string;
  affectedScopes: string[];
  changedFiles: string[];
  requiredChecks: string[];
  generatedAt: string;
}

export interface CheckResult {
  name: string;
  command: string;
  status: CheckStatus;
  durationMs: number;
  exitCode: number;
  testCount?: number;
  zeroTestDetected: boolean;
  timedOut: boolean;
  failureReason?: string;
  stdoutDigest: string;
  stderrDigest: string;
}

export interface VerificationManifest {
  schemaVersion: '1.0.0';
  verifierVersion: string;
  baseSha: string;
  headSha: string;
  isDirty: boolean;
  riskLevel: RiskLevel;
  verdict: OverallVerdict;
  timestamp: string;
  durationMs: number;
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
    ci: boolean;
  };
  affectedScopes: string[];
  changedFiles: string[];
  checks: CheckResult[];
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    notImplementedChecks: number;
    infraErrorChecks: number;
  };
}
