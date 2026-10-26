#!/usr/bin/env node

import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import glob from 'glob';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const patterns = [
  'config/*.js',
  'shared/*.js',
  'scripts/*.js',
  'backend/utils/*.js',
  'backend/scenarios/**/*.js',
  'frontend/scenarios/**/*.js',
  'run-tests.js',
];
const files = [
  ...new Set(patterns.flatMap((pattern) => glob.sync(pattern, { cwd: root }))),
]
  .filter((file) => file !== 'scripts/validate-syntax.js')
  .sort();

if (files.length === 0) {
  console.error('No k6 JavaScript files discovered');
  process.exit(1);
}

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  if (result.status !== 0) {
    console.error(`Syntax validation failed: ${file}`);
    process.exit(result.status || 1);
  }
}

console.log(`Validated ${files.length} k6 JavaScript files`);
