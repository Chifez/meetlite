#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { createVerificationPlan } from './plan.js';
import { CheckRunner } from './runner.js';
import {
  buildManifest,
  renderMarkdownReport,
  validateManifestAgainstSchema,
} from './reporter.js';
import { VerificationPlan } from './types.js';

function parseArgs(args: string[]) {
  const parsed: { command?: string; flags: Record<string, string> } = {
    flags: {},
  };

  let i = 0;
  if (args.length > 0 && !args[0].startsWith('-')) {
    parsed.command = args[0];
    i = 1;
  }

  for (; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        parsed.flags[key] = next;
        i++;
      } else {
        parsed.flags[key] = 'true';
      }
    }
  }

  return parsed;
}

async function main() {
  const { command = 'verify', flags } = parseArgs(process.argv.slice(2));

  if (command === 'help' || flags.help) {
    console.log(`
meetlite-verifier CLI

Usage:
  meetlite-verifier plan [--base <sha>] [--head <sha>] [--out <file>]
  meetlite-verifier verify [--plan <file>] [--base <sha>] [--head <sha>] [--out <manifest.json>] [--md-out <report.md>]

Local-only escape hatch:
  --allow-dirty   Include uncommitted files in risk classification. Never use for release evidence.
`);
    process.exit(0);
  }

  if (command === 'plan') {
    const plan = createVerificationPlan({
      baseSha: flags.base,
      headSha: flags.head,
      allowDirty: flags['allow-dirty'] === 'true',
    });

    const outPath = flags.out || 'plan.json';
    fs.writeFileSync(outPath, JSON.stringify(plan, null, 2), 'utf8');
    console.log(
      `[verifier] Plan generated: ${outPath} (Risk: ${plan.riskLevel})`
    );
    console.log(
      `[verifier] Required checks: ${plan.requiredChecks.join(', ')}`
    );
    process.exit(0);
  }

  if (command === 'verify') {
    let plan: VerificationPlan;
    if (flags.plan && fs.existsSync(flags.plan)) {
      plan = JSON.parse(fs.readFileSync(flags.plan, 'utf8'));
      const recomputedPlan = createVerificationPlan({
        baseSha: plan.baseSha,
        headSha: plan.headSha,
        allowDirty: flags['allow-dirty'] === 'true',
      });
      const protectedFields: Array<keyof VerificationPlan> = [
        'baseSha',
        'headSha',
        'isDirty',
        'riskLevel',
        'riskReason',
        'affectedScopes',
        'changedFiles',
        'requiredChecks',
      ];
      for (const field of protectedFields) {
        if (
          JSON.stringify(plan[field]) !== JSON.stringify(recomputedPlan[field])
        ) {
          throw new Error(`PLAN_MISMATCH:${field}`);
        }
      }
    } else {
      plan = createVerificationPlan({
        baseSha: flags.base,
        headSha: flags.head,
        allowDirty: flags['allow-dirty'] === 'true',
      });
    }

    console.log(`=======================================================`);
    console.log(` MeetLite Change Verifier`);
    console.log(
      ` Base: ${plan.baseSha.slice(0, 8)} | Head: ${plan.headSha.slice(0, 8)} | Dirty: ${plan.isDirty}`
    );
    console.log(` Risk Level: ${plan.riskLevel} (${plan.riskReason})`);
    console.log(` Required Checks: ${plan.requiredChecks.join(', ')}`);
    console.log(`=======================================================`);

    const runner = new CheckRunner({
      timeoutMs: flags.timeout ? parseInt(flags.timeout, 10) : undefined,
    });

    const startTime = Date.now();
    const checkResults = await runner.runAll(plan.requiredChecks);
    const durationMs = Date.now() - startTime;

    const manifest = buildManifest(plan, checkResults, durationMs);
    const validation = validateManifestAgainstSchema(manifest);

    if (!validation.valid) {
      console.error(
        `[verifier] CRITICAL: Generated manifest failed schema validation:`
      );
      for (const err of validation.errors) {
        console.error(`  - ${err}`);
      }
      process.exit(1);
    }

    const outManifest = flags.out || 'verification-manifest.json';
    fs.writeFileSync(outManifest, JSON.stringify(manifest, null, 2), 'utf8');

    const markdown = renderMarkdownReport(manifest);
    const outMd = flags['md-out'] || 'verification-report.md';
    fs.writeFileSync(outMd, markdown, 'utf8');

    console.log(`\n[verifier] Final Verdict: ${manifest.verdict}`);
    console.log(`[verifier] Artifacts written: ${outManifest}, ${outMd}`);

    if (manifest.verdict === 'FAIL') {
      console.error(`[verifier] FAILED: One or more checks failed.`);
      process.exit(1);
    } else if (manifest.verdict === 'NOT_IMPLEMENTED') {
      console.error(
        `[verifier] NOT_IMPLEMENTED: A required gate has no executable harness.`
      );
      process.exit(3);
    } else if (manifest.verdict === 'INCONCLUSIVE') {
      console.error(
        `[verifier] INCONCLUSIVE: Check timed out or encountered infrastructure error.`
      );
      process.exit(2);
    } else {
      console.log(`[verifier] PASSED: All required checks satisfied.`);
      process.exit(0);
    }
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(`[verifier] Unhandled error:`, err);
  process.exit(1);
});
