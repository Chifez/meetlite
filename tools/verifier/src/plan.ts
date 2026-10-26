import { execFileSync } from 'child_process';
import { ChangeClassifier } from './classifier.js';
import { VerificationPlan } from './types.js';

export interface PlanOptions {
  baseSha?: string;
  headSha?: string;
  allowDirty?: boolean;
  policyDir?: string;
}

const GIT_SHA_PATTERN = /^[0-9a-f]{7,40}$/i;

export function assertValidGitSha(value: string, label: string): void {
  if (!GIT_SHA_PATTERN.test(value)) {
    throw new Error(`INVALID_${label.toUpperCase()}_SHA`);
  }
}

function git(args: string[]): string {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

export function createVerificationPlan(
  options: PlanOptions = {}
): VerificationPlan {
  let headSha = options.headSha;
  let baseSha = options.baseSha;

  try {
    if (!headSha) {
      headSha = git(['rev-parse', 'HEAD']);
    }
  } catch (_e) {
    throw new Error('GIT_HEAD_UNAVAILABLE');
  }

  try {
    if (!baseSha) {
      // Try merge-base with origin/main or HEAD~1
      try {
        baseSha = git(['merge-base', 'HEAD', 'origin/main']);
      } catch (_e) {
        baseSha = git(['rev-parse', 'HEAD~1']);
      }
    }
  } catch (_e) {
    baseSha = headSha;
  }

  let isDirty = false;
  const changedFilesSet = new Set<string>();

  try {
    const status = git(['status', '--porcelain', '-uall']);
    if (status.trim().length > 0) {
      isDirty = true;
      for (const line of status.split('\n')) {
        if (!line.trim()) continue;
        const filePart = line.slice(3).trim();
        const cleanPath = filePart.includes('->')
          ? filePart.split('->')[1].trim()
          : filePart;
        changedFilesSet.add(cleanPath);
      }
    }
  } catch (_e) {}

  if (isDirty && !options.allowDirty) {
    throw new Error(
      'DIRTY_WORKTREE: commit or stash changes before generating release evidence; use --allow-dirty only for local diagnostics'
    );
  }

  assertValidGitSha(baseSha, 'base');
  assertValidGitSha(headSha, 'head');
  try {
    git(['cat-file', '-e', `${baseSha}^{commit}`]);
    git(['cat-file', '-e', `${headSha}^{commit}`]);
  } catch (_e) {
    throw new Error('GIT_COMMIT_UNAVAILABLE');
  }

  try {
    if (baseSha && headSha && baseSha !== headSha) {
      const diffFiles = git(['diff', '--name-only', baseSha, headSha]);
      for (const file of diffFiles.split('\n')) {
        if (file.trim()) changedFilesSet.add(file.trim());
      }
    }
  } catch (_e) {
    throw new Error('GIT_DIFF_UNAVAILABLE');
  }

  const changedFiles = Array.from(changedFilesSet).sort();
  const classifier = new ChangeClassifier(options.policyDir);
  const { riskLevel, riskReason, affectedScopes, requiredChecks } =
    classifier.classify(changedFiles);

  return {
    baseSha,
    headSha,
    isDirty,
    riskLevel,
    riskReason,
    affectedScopes,
    changedFiles,
    requiredChecks,
    generatedAt: new Date().toISOString(),
  };
}
