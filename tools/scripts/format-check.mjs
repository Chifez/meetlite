#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import prettier from 'prettier';

const SUPPORTED_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
]);

function getTouchedFiles() {
  const customArgs = process.argv
    .slice(2)
    .filter((arg) => !arg.startsWith('-'));
  if (customArgs.length > 0) {
    return customArgs;
  }

  const files = new Set();
  try {
    // 1. Unstaged and staged files
    const statusOut = execSync('git status --porcelain -uall', {
      encoding: 'utf8',
    });
    for (const line of statusOut.split('\n')) {
      if (!line.trim()) continue;
      const filePart = line.slice(3).trim();
      const cleanPath = filePart.includes('->')
        ? filePart.split('->')[1].trim()
        : filePart;
      files.add(cleanPath);
    }

    // 2. Diff against merge-base or HEAD~1 if working copy is clean
    if (files.size === 0) {
      const diffOut = execSync('git diff --name-only HEAD~1 HEAD', {
        encoding: 'utf8',
      });
      for (const line of diffOut.split('\n')) {
        if (line.trim()) files.add(line.trim());
      }
    }
  } catch (_err) {
    // If not in a git repo or no commits yet, fallback to package.json
    files.add('package.json');
  }

  return Array.from(files);
}

async function main() {
  console.log(
    '[format:check] Checking whitespace and formatting on touched files...'
  );

  // 1. Git diff whitespace check
  try {
    execSync('git diff --check', { stdio: 'inherit' });
  } catch (err) {
    console.error(
      '[format:check] FAILED: git diff whitespace check detected errors.'
    );
    process.exit(1);
  }

  const candidates = getTouchedFiles();
  const eligibleFiles = candidates.filter((f) => {
    if (!fs.existsSync(f)) return false;
    const stat = fs.statSync(f);
    if (!stat.isFile()) return false;
    const ext = path.extname(f);
    return SUPPORTED_EXTS.has(ext);
  });

  if (eligibleFiles.length === 0) {
    console.log('[format:check] No eligible touched files to format check.');
    process.exit(0);
  }

  let failures = 0;
  for (const file of eligibleFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const prettierConfig = (await prettier.resolveConfig(file)) || {};
      const isFormatted = await prettier.check(content, {
        ...prettierConfig,
        filepath: file,
      });

      if (!isFormatted) {
        console.error(
          `[format:check] ✗ File is not properly formatted: ${file}`
        );
        failures++;
      }
    } catch (err) {
      console.error(`[format:check] Error checking ${file}: ${err.message}`);
      failures++;
    }
  }

  if (failures > 0) {
    console.error(
      `[format:check] FAILED: ${failures} file(s) failed formatting check.`
    );
    process.exit(1);
  }

  console.log(
    `[format:check] PASSED: ${eligibleFiles.length} touched file(s) verified.`
  );
}

main().catch((err) => {
  console.error('[format:check] Unexpected error:', err);
  process.exit(1);
});
