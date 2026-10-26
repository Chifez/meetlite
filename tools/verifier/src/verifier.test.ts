import test from 'node:test';
import assert from 'node:assert';
import { ChangeClassifier } from './classifier.js';
import { CheckRunner } from './runner.js';
import {
  computeOverallVerdict,
  buildManifest,
  validateManifestAgainstSchema,
  renderMarkdownReport,
} from './reporter.js';
import { CheckResult, VerificationPlan } from './types.js';
import { assertValidGitSha, createVerificationPlan } from './plan.js';

test('VER-02 / VER-03: ChangeClassifier Risk & Scope Resolution', async (t) => {
  const classifier = new ChangeClassifier();

  await t.test('L0: classifies documentation only changes as L0', () => {
    const result = classifier.classify([
      'docs/architecture/readme.md',
      'README.md',
    ]);
    assert.strictEqual(result.riskLevel, 'L0');
    assert.deepStrictEqual(result.requiredChecks, ['format:check']);
  });

  await t.test('L1: classifies local client UI changes as L1', () => {
    const result = classifier.classify(['client/src/components/button.tsx']);
    assert.strictEqual(result.riskLevel, 'L1');
    assert.ok(result.requiredChecks.includes('lint'));
    assert.ok(result.requiredChecks.includes('test:unit'));
    assert.deepStrictEqual(result.affectedScopes, ['client']);
  });

  await t.test(
    'L2: classifies shared contracts and schema changes as L2 and discovers downstream consumers',
    () => {
      const result = classifier.classify([
        'backend/packages/shared/prisma/schema.prisma',
      ]);
      assert.strictEqual(result.riskLevel, 'L2');
      assert.ok(result.requiredChecks.includes('test:contracts'));
      assert.ok(result.requiredChecks.includes('test:integration'));
      assert.ok(result.affectedScopes.includes('@minimeet/shared'));
      assert.ok(result.affectedScopes.includes('@minimeet/room-service'));
      assert.ok(result.affectedScopes.includes('@minimeet/auth-service'));
    }
  );

  await t.test(
    'L3: classifies E2E harness changes as release-gate changes',
    () => {
      const result = classifier.classify(['e2e/auth-dashboard.spec.ts']);
      assert.strictEqual(result.riskLevel, 'L3');
      assert.ok(result.requiredChecks.includes('test:e2e'));
    }
  );

  await t.test(
    'L3: classifies room signaling and auth controller changes as L3',
    () => {
      const result = classifier.classify([
        'backend/packages/room-service/src/controllers/room.controller.ts',
      ]);
      assert.strictEqual(result.riskLevel, 'L3');
      assert.ok(result.requiredChecks.includes('test:e2e'));
    }
  );

  await t.test(
    'L4: classifies verifier policy and infrastructure changes as L4',
    () => {
      const result = classifier.classify([
        'tools/verifier/policy/risk-rules.json',
        'docker-compose.yml',
      ]);
      assert.strictEqual(result.riskLevel, 'L4');
      assert.ok(result.riskReason.includes('Verifier'));
    }
  );
});

test('VER-02: CheckRunner Zero-Test, Timeout, and Status Detection', async (t) => {
  await t.test(
    'detects zero-test false positive and fails closed',
    async () => {
      const runner = new CheckRunner({
        commandMap: {
          'test:zero':
            'node -e "console.log(\'ℹ tests 0\\nℹ pass 0\'); process.exit(0)"',
        },
      });

      const result = await runner.runCheck('test:zero');
      assert.strictEqual(result.status, 'FAIL');
      assert.strictEqual(result.zeroTestDetected, true);
      assert.ok(result.failureReason?.includes('ZERO_TESTS_DISCOVERED'));
    }
  );

  await t.test(
    'detects NOT_IMPLEMENTED suite and sets status to NOT_IMPLEMENTED',
    async () => {
      const runner = new CheckRunner({
        commandMap: {
          'test:e2e':
            'node -e "console.error(\'NOT_IMPLEMENTED: E2E scheduled for P2\'); process.exit(1)"',
        },
      });

      const result = await runner.runCheck('test:e2e');
      assert.strictEqual(result.status, 'NOT_IMPLEMENTED');
      assert.ok(result.failureReason?.includes('NOT_IMPLEMENTED'));
    }
  );

  await t.test('detects command timeout and flags INFRA_ERROR', async () => {
    const runner = new CheckRunner({
      timeoutMs: 200,
      commandMap: {
        'test:hang': 'node -e "setTimeout(() => {}, 10000)"',
      },
    });

    const result = await runner.runCheck('test:hang');
    assert.strictEqual(result.status, 'INFRA_ERROR');
    assert.strictEqual(result.timedOut, true);
    assert.ok(result.failureReason?.includes('CHECK_TIMED_OUT'));
  });

  await t.test('computes sha256 digests for stdout and stderr', async () => {
    const runner = new CheckRunner({
      commandMap: {
        'test:digest':
          "node -e \"console.log('hello output'); console.error('hello error')\"",
      },
    });

    const result = await runner.runCheck('test:digest');
    assert.strictEqual(result.stdoutDigest.length, 64);
    assert.strictEqual(result.stderrDigest.length, 64);
  });
});

test('VER-02 / VER-03: Verdict Resolution & Schema Validation', async (t) => {
  const dummyPlan: VerificationPlan = {
    baseSha: '0123456789abcdef0123456789abcdef01234567',
    headSha: 'fedcba9876543210fedcba9876543210fedcba98',
    isDirty: false,
    riskLevel: 'L2',
    riskReason: 'Test plan',
    affectedScopes: ['@minimeet/shared'],
    changedFiles: ['backend/packages/shared/src/index.ts'],
    requiredChecks: ['format:check', 'test:unit'],
    generatedAt: new Date().toISOString(),
  };

  await t.test('computes PASS when all checks pass', () => {
    const checks: CheckResult[] = [
      {
        name: 'format:check',
        command: 'npm run format:check',
        status: 'PASS',
        durationMs: 100,
        exitCode: 0,
        zeroTestDetected: false,
        timedOut: false,
        stdoutDigest: 'abc',
        stderrDigest: 'def',
      },
    ];
    assert.strictEqual(computeOverallVerdict(checks), 'PASS');
  });

  await t.test('computes FAIL when any check fails', () => {
    const checks: CheckResult[] = [
      {
        name: 'format:check',
        command: 'npm run format:check',
        status: 'PASS',
        durationMs: 100,
        exitCode: 0,
        zeroTestDetected: false,
        timedOut: false,
        stdoutDigest: 'abc',
        stderrDigest: 'def',
      },
      {
        name: 'test:unit',
        command: 'npm run test:unit',
        status: 'FAIL',
        durationMs: 200,
        exitCode: 1,
        zeroTestDetected: false,
        timedOut: false,
        stdoutDigest: 'abc',
        stderrDigest: 'def',
      },
    ];
    assert.strictEqual(computeOverallVerdict(checks), 'FAIL');
  });

  await t.test('fails closed for flaky and quarantined failures', () => {
    for (const status of ['FLAKY', 'QUARANTINED_FAIL'] as const) {
      const checks: CheckResult[] = [
        {
          name: 'test:e2e',
          command: 'npm run test:e2e',
          status,
          durationMs: 100,
          exitCode: 1,
          zeroTestDetected: false,
          timedOut: false,
          stdoutDigest: 'a'.repeat(64),
          stderrDigest: 'b'.repeat(64),
        },
      ];
      assert.strictEqual(computeOverallVerdict(checks), 'FAIL');
    }
  });

  await t.test(
    'computes INCONCLUSIVE on infra error / timeout without failure',
    () => {
      const checks: CheckResult[] = [
        {
          name: 'test:unit',
          command: 'npm run test:unit',
          status: 'INFRA_ERROR',
          durationMs: 200,
          exitCode: 1,
          zeroTestDetected: false,
          timedOut: true,
          stdoutDigest: 'abc',
          stderrDigest: 'def',
        },
      ];
      assert.strictEqual(computeOverallVerdict(checks), 'INCONCLUSIVE');
    }
  );

  await t.test(
    'computes NOT_IMPLEMENTED when required check is scheduled for future phase',
    () => {
      const checks: CheckResult[] = [
        {
          name: 'format:check',
          command: 'npm run format:check',
          status: 'PASS',
          durationMs: 100,
          exitCode: 0,
          zeroTestDetected: false,
          timedOut: false,
          stdoutDigest: 'abc',
          stderrDigest: 'def',
        },
        {
          name: 'test:e2e',
          command: 'npm run test:e2e',
          status: 'NOT_IMPLEMENTED',
          durationMs: 50,
          exitCode: 1,
          zeroTestDetected: false,
          timedOut: false,
          stdoutDigest: 'abc',
          stderrDigest: 'def',
        },
      ];
      assert.strictEqual(computeOverallVerdict(checks), 'NOT_IMPLEMENTED');
    }
  );

  await t.test(
    'validates manifest against report-v1 schema and generates markdown',
    () => {
      const checks: CheckResult[] = [
        {
          name: 'format:check',
          command: 'npm run format:check',
          status: 'PASS',
          durationMs: 100,
          exitCode: 0,
          zeroTestDetected: false,
          timedOut: false,
          stdoutDigest:
            '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          stderrDigest:
            '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        },
      ];
      const manifest = buildManifest(dummyPlan, checks, 150);
      const validation = validateManifestAgainstSchema(manifest);
      assert.strictEqual(validation.valid, true);

      const md = renderMarkdownReport(manifest);
      assert.ok(md.includes('# Verification Report: PASS'));
      assert.ok(md.includes('`format:check`'));
    }
  );

  await t.test(
    'fails schema validation closed on tampered or corrupted manifest',
    () => {
      const corruptedManifest: any = {
        schemaVersion: '2.0.0', // invalid version
        baseSha: 'not-a-sha',
        checks: 'not-an-array',
      };
      const validation = validateManifestAgainstSchema(corruptedManifest);
      assert.strictEqual(validation.valid, false);
      assert.ok(validation.errors.length >= 3);
    }
  );
});

test('VER-02: rejects untrusted git revision input', () => {
  assert.doesNotThrow(() => assertValidGitSha('0123456789abcdef', 'base'));
  assert.throws(
    () => assertValidGitSha('HEAD; touch /tmp/verifier-pwned', 'base'),
    /INVALID_BASE_SHA/
  );
});

test('VER-02: rejects syntactically valid but unavailable commits', () => {
  assert.throws(
    () =>
      createVerificationPlan({
        baseSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        headSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        allowDirty: true,
      }),
    /GIT_COMMIT_UNAVAILABLE/
  );
});
