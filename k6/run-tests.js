#!/usr/bin/env node

/**
 * MeetLite K6 Test Runner & CLI
 *
 * Supports:
 * - Shorthand target aliases (e.g. meeting:load, auth:load, room:load, coordinator:load, client:load)
 * - Preset modes: --smoke, --quick, --load, --stress
 * - Direct pass-through of native k6 flags (e.g. --vus 5 --duration 10s)
 * - Category / type discovery (e.g. backend load, frontend load)
 * - Listing all available targets (--list)
 *
 * Usage Examples:
 *   npm run k6 -- meeting:load --smoke
 *   npm run k6 -- --vus 5 --duration 10s meeting:load
 *   npm run k6 -- coordinator:load --vus 10 --duration 5s
 *   npm run k6 -- client:load --quick
 *   node run-tests.js backend load
 *   node run-tests.js --list
 */

import { spawnSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, extname, join, relative, resolve } from 'path';
import glob from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Target shortcuts mapping to scenario files (relative to k6 directory)
const TARGET_MAP = {
  // Meetings
  'meeting:load': 'backend/scenarios/meetings/load.js',
  'meetings:load': 'backend/scenarios/meetings/load.js',
  meeting: 'backend/scenarios/meetings/load.js',
  meetings: 'backend/scenarios/meetings/load.js',

  // Auth
  'auth:load': 'backend/scenarios/auth/load.js',
  auth: 'backend/scenarios/auth/load.js',

  // Rooms
  'room:load': 'backend/scenarios/rooms/load.js',
  'rooms:load': 'backend/scenarios/rooms/load.js',
  room: 'backend/scenarios/rooms/load.js',
  rooms: 'backend/scenarios/rooms/load.js',
  'room:stress': 'backend/scenarios/rooms/stress.js',
  'rooms:stress': 'backend/scenarios/rooms/stress.js',

  // Single-Room Participant Ramp (Hot Partition Breakpoint)
  'room:ramp': 'backend/scenarios/websocket/room-participant-ramp.js',
  'participant:ramp': 'backend/scenarios/websocket/room-participant-ramp.js',
  'hot-room:ramp': 'backend/scenarios/websocket/room-participant-ramp.js',

  // Multi-Room Concurrency Ramp (Horizontal Scalability Breakpoint)
  'rooms:ramp': 'backend/scenarios/websocket/multi-room-ramp.js',
  'cluster:ramp': 'backend/scenarios/websocket/multi-room-ramp.js',
  'multi-room:ramp': 'backend/scenarios/websocket/multi-room-ramp.js',

  // Edge Coordinator (Cloudflare Durable Object Native WebSocket)
  'coordinator:load': 'backend/scenarios/websocket/coordinator-load.js',
  coordinator: 'backend/scenarios/websocket/coordinator-load.js',
  'edge:load': 'backend/scenarios/websocket/coordinator-load.js',
  edge: 'backend/scenarios/websocket/coordinator-load.js',
  'ws:coordinator': 'backend/scenarios/websocket/coordinator-load.js',

  // Legacy Socket.IO Signaling
  'websocket:load': 'backend/scenarios/websocket/connection-load.js',
  websocket: 'backend/scenarios/websocket/connection-load.js',
  'socketio:load': 'backend/scenarios/websocket/connection-load.js',
  socketio: 'backend/scenarios/websocket/connection-load.js',

  // Frontend / Client SPA & Deep-linking
  'client:load': 'frontend/scenarios/client/load.js',
  client: 'frontend/scenarios/client/load.js',
  'frontend:load': 'frontend/scenarios/client/load.js',
  frontend: 'frontend/scenarios/client/load.js',
};

// Preset flags configuration
const PRESETS = {
  smoke: {
    vus: 5,
    duration: '10s',
    description: 'Fast 10s smoke test with 5 VUs',
  },
  quick: {
    vus: 2,
    duration: '5s',
    description: 'Ultra-fast 5s validation with 2 VUs',
  },
  load: {
    vus: 10,
    duration: '30s',
    description: 'Standard load baseline with 10 VUs',
  },
  stress: {
    vus: 25,
    duration: '30s',
    description: 'Stress profile with 25 VUs',
  },
  spike: {
    vus: 50,
    duration: '20s',
    description: 'Sudden burst profile with 50 VUs',
  },
  soak: {
    vus: 15,
    duration: '2m',
    description: 'Extended endurance soak profile with 15 VUs',
  },
};

const CATEGORIES = ['backend', 'frontend'];
const TEST_TYPES = ['load', 'stress', 'spike', 'soak', 'volume', 'capacity'];

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function loadEnvFile() {
  try {
    const envPath = join(__dirname, '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    const env = {};

    envContent.split('\n').forEach((line) => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const equalIndex = line.indexOf('=');
      if (equalIndex === -1) return;
      const key = line.substring(0, equalIndex).trim();
      const value = line.substring(equalIndex + 1).trim();
      const cleanValue = value.replace(/^["']|["']$/g, '');
      if (key) env[key] = cleanValue;
    });

    return env;
  } catch (error) {
    return {};
  }
}

function buildK6EnvArgs(env) {
  return Object.entries(env).flatMap(([key, value]) => [
    '--env',
    `${key}=${String(value)}`,
  ]);
}

function printHeader() {
  console.log(`${colors.cyan}${colors.bright}`);
  console.log('🚀 MeetLite K6 Test Runner & CLI');
  console.log('================================');
  console.log(`${colors.reset}`);
}

function printList() {
  console.log(`${colors.yellow}Available Shorthand Targets:${colors.reset}`);
  console.log('');
  const seenPaths = new Set();
  const grouped = {};

  for (const [alias, relPath] of Object.entries(TARGET_MAP)) {
    if (!grouped[relPath]) grouped[relPath] = [];
    grouped[relPath].push(alias);
  }

  for (const [relPath, aliases] of Object.entries(grouped)) {
    console.log(`  ${colors.green}${aliases.join(', ')}${colors.reset}`);
    console.log(`    ${colors.dim}File: ${relPath}${colors.reset}`);
  }

  console.log('');
  console.log(`${colors.yellow}Available Presets:${colors.reset}`);
  for (const [preset, cfg] of Object.entries(PRESETS)) {
    console.log(
      `  ${colors.cyan}--${preset}${colors.reset} (VUs: ${cfg.vus}, Duration: ${cfg.duration}) - ${cfg.description}`
    );
  }
  console.log('');
  console.log(`${colors.yellow}Examples:${colors.reset}`);
  console.log('  npm run k6 seed vus 50');
  console.log('  npm run k6 -- meeting:load --smoke');
  console.log('  npm run k6 -- --vus 5 --duration 10s meeting:load');
  console.log('  npm run k6 -- coordinator:load --smoke');
  console.log('  npm run k6 -- client:load --quick');
  console.log('  npm run k6 -- room:stress --vus 15 --duration 20s');
  console.log('');
}

function printHelp() {
  console.log(`${colors.yellow}Usage:${colors.reset}`);
  console.log('  npm run k6 -- [target] [flags]');
  console.log('  npm run k6 seed [vus <n>]');
  console.log('  node run-tests.js [target] [flags]');
  console.log('  node run-tests.js [category] [test-type]');
  console.log('');
  console.log(`${colors.yellow}Presets:${colors.reset}`);
  console.log('  --smoke               Run 10s test with 5 VUs');
  console.log('  --quick               Run 5s test with 2 VUs');
  console.log('  --load                Run 30s test with 10 VUs');
  console.log('  --stress              Run 30s test with 25 VUs');
  console.log('  --spike               Run 20s test with 50 VUs');
  console.log('  --soak                Run 2m endurance test with 15 VUs');
  console.log('');
  console.log(`${colors.yellow}Native K6 Flags:${colors.reset}`);
  console.log('  --vus <n>             Number of virtual users');
  console.log('  --duration <time>     Test duration (e.g. 10s, 1m)');
  console.log('  --iterations <n>      Total iterations to execute');
  console.log('  --http-debug          Log full HTTP requests & responses');
  console.log('');
  console.log(`${colors.yellow}Utilities:${colors.reset}`);
  console.log('  seed [vus <n>]        Seed N virtual test users into DB (default: 50)');
  console.log('                        e.g. npm run k6 seed vus 50');
  console.log('');
  console.log(`${colors.yellow}Targets:${colors.reset}`);
  console.log('  meeting:load          Meeting lifecycle journey');
  console.log('  auth:load             Authentication & profile journey');
  console.log('  room:load             Room creation & admission');
  console.log('  room:stress           Room capacity stress test');
  console.log('  room:ramp             Single-room participant ramp (hot room breakpoint)');
  console.log('  rooms:ramp            Multi-room concurrency ramp (cluster scale breakpoint)');
  console.log('  coordinator:load      Native Cloudflare Edge WebSocket');
  console.log('  websocket:load        Mediasoup Socket.IO signalling');
  console.log('  client:load           Frontend static & deep-link load');
  console.log('  all                   Run all test suites');
  console.log('');
  console.log('Run with --list to see all shorthand aliases.');
  console.log('');
}

function checkK6() {
  return spawnSync('k6', ['version'], { stdio: 'pipe' }).status === 0;
}

/**
 * Run a single k6 test file with flags
 */
function runTest(testFile, env = {}, extraK6Args = []) {
  console.log(`${colors.cyan}📊 Running: ${testFile}${colors.reset}`);
  if (extraK6Args.length > 0) {
    console.log(
      `${colors.yellow}⚙️  K6 Flags: ${extraK6Args.join(' ')}${colors.reset}`
    );
  }
  console.log('');

  const k6Args = ['run', ...buildK6EnvArgs(env), ...extraK6Args, testFile];
  console.log(`🚀 Executing k6 with ${k6Args.length - 2} argument(s)`);

  const result = spawnSync('k6', k6Args, {
    stdio: 'inherit',
    cwd: __dirname,
    shell: false,
    env: { ...process.env, ...env },
  });

  if (result.status === 0) {
    console.log('');
    console.log(`${colors.green}✅ Test completed successfully${colors.reset}`);
    return true;
  }

  console.log('');
  console.log(`${colors.red}❌ Test execution failed${colors.reset}`);
  return false;
}

function requirePositiveInteger(value, flag) {
  if (!/^\d+$/.test(value || '') || Number(value) < 1) {
    throw new Error(`${flag} requires a positive integer`);
  }
  return value;
}

function requireDuration(value) {
  if (!/^\d+(ms|s|m|h)$/.test(value || '')) {
    throw new Error('--duration requires a value such as 10s, 2m, or 1h');
  }
  return value;
}

async function main() {
  let rawArgs = process.argv.slice(2);

  // If command was invoked as `k6 run ...` or `node run-tests.js run ...`, strip `run`
  if (rawArgs[0] === 'run') {
    rawArgs = rawArgs.slice(1);
  }

  // Help & list options
  if (
    rawArgs.includes('--help') ||
    rawArgs.includes('-h') ||
    rawArgs.length === 0
  ) {
    printHeader();
    printHelp();
    return;
  }

  if (
    rawArgs.includes('--list') ||
    rawArgs.includes('-l') ||
    rawArgs[0] === 'list'
  ) {
    printHeader();
    printList();
    return;
  }

  // Handle user seeding command (e.g. `npm run k6 seed vus 50`, `npm run k6 seed 50`, `npm run k6 seed:vus 50`)
  if (
    rawArgs[0] === 'seed' ||
    rawArgs[0]?.startsWith('seed:') ||
    rawArgs[0] === 'seed:vus' ||
    rawArgs[0] === 'seed:users'
  ) {
    printHeader();
    let count = 50;
    for (const token of rawArgs) {
      if (/^\d+$/.test(token)) {
        count = parseInt(token, 10);
        break;
      }
      const match = token.match(/(\d+)/);
      if (match && !token.startsWith('seed')) {
        count = parseInt(match[1], 10);
        break;
      }
    }
    const scriptPath = join(__dirname, 'scripts', 'setup-users.js');
    console.log(
      `${colors.cyan}🌱 Seeding ${count} virtual test users for K6...${colors.reset}\n`
    );
    const result = spawnSync('node', [scriptPath, String(count)], {
      stdio: 'inherit',
      cwd: __dirname,
    });
    process.exit(result.status ?? 0);
  }

  if (!checkK6()) {
    console.error(
      `${colors.red}❌ K6 is not installed or not in PATH${colors.reset}`
    );
    console.log(
      'Please install K6 via Homebrew (`brew install k6`) or package manager.'
    );
    process.exit(1);
  }

  printHeader();

  // Parse flags and identify targets
  const extraK6Args = [];
  const positionalArgs = [];
  let detectedPreset = null;

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];

    if (
      arg === '--smoke' ||
      arg === '--quick' ||
      arg === '--load' ||
      arg === '--stress' ||
      arg === '--spike' ||
      arg === '--soak'
    ) {
      detectedPreset = arg.slice(2);
      continue;
    }

    if (arg === '--vus' || arg === '-u') {
      const val = requirePositiveInteger(rawArgs[++i], '--vus');
      extraK6Args.push('--vus', val);
      continue;
    }

    if (arg === '--duration' || arg === '-d') {
      const val = requireDuration(rawArgs[++i]);
      extraK6Args.push('--duration', val);
      continue;
    }

    if (arg === '--iterations' || arg === '-i') {
      const val = requirePositiveInteger(rawArgs[++i], '--iterations');
      extraK6Args.push('--iterations', val);
      continue;
    }

    if (arg.startsWith('--vus=')) {
      extraK6Args.push('--vus', requirePositiveInteger(arg.slice(6), '--vus'));
      continue;
    }
    if (arg.startsWith('--duration=')) {
      extraK6Args.push('--duration', requireDuration(arg.slice(11)));
      continue;
    }
    if (arg.startsWith('--iterations=')) {
      extraK6Args.push(
        '--iterations',
        requirePositiveInteger(arg.slice(13), '--iterations')
      );
      continue;
    }

    if (arg === '--http-debug') {
      extraK6Args.push('--http-debug');
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unsupported k6 flag: ${arg}`);
    }

    positionalArgs.push(arg);
  }

  // Check if target has a suffix like `:smoke`, `:quick`, `:spike`, `:soak`, `:stress`
  let targetArg = positionalArgs[0] || 'all';
  const suffixMatch = targetArg.match(/:(smoke|quick|spike|soak|stress)$/);
  if (suffixMatch) {
    const suffix = suffixMatch[1];
    // If not already in target map directly (like room:stress), normalize to base target
    if (!TARGET_MAP[targetArg.toLowerCase()]) {
      targetArg = targetArg.replace(new RegExp(`:${suffix}$`), ':load');
      if (!TARGET_MAP[targetArg.toLowerCase()]) {
        targetArg = targetArg.replace(/:load$/, '');
      }
    }
    if (!detectedPreset) detectedPreset = suffix;
  }

  // Apply preset flags if not explicitly overridden by user
  const hasExplicitVus = extraK6Args.includes('--vus');
  const hasExplicitDuration = extraK6Args.includes('--duration');

  if (detectedPreset && PRESETS[detectedPreset]) {
    const presetCfg = PRESETS[detectedPreset];
    console.log(
      `${colors.cyan}⚡ Applying preset: ${detectedPreset.toUpperCase()} (${presetCfg.description})${colors.reset}`
    );
    if (!hasExplicitVus) {
      extraK6Args.push('--vus', String(presetCfg.vus));
    }
    if (!hasExplicitDuration) {
      extraK6Args.push('--duration', presetCfg.duration);
    }
  }

  const env = loadEnvFile();

  // Resolve target files
  const filesToRun = [];

  // Check 1: Direct target alias match
  if (TARGET_MAP[targetArg.toLowerCase()]) {
    filesToRun.push(join(__dirname, TARGET_MAP[targetArg.toLowerCase()]));
  }
  // Check 2: Direct file path
  else if (existsSync(resolve(__dirname, targetArg))) {
    const candidate = resolve(__dirname, targetArg);
    const candidateRelative = relative(__dirname, candidate);
    if (
      candidateRelative.startsWith('..') ||
      candidateRelative.startsWith('/') ||
      extname(candidate) !== '.js'
    ) {
      throw new Error(
        'Direct scenario paths must be JavaScript files inside k6/'
      );
    }
    filesToRun.push(candidate);
  }
  // Check 3: Traditional category [type] syntax (e.g. "backend load" or "backend")
  else if (CATEGORIES.includes(targetArg)) {
    const category = targetArg;
    const testType = positionalArgs[1] || null;
    const testDir = join(__dirname, category, 'scenarios');
    const pattern = testType ? `**/${testType}.js` : '**/*.js';
    const matches = glob.sync(pattern, { cwd: testDir, absolute: true });
    filesToRun.push(...matches);
  }
  // Check 4: "all" targets
  else if (targetArg === 'all') {
    const backendFiles = glob.sync('**/*.js', {
      cwd: join(__dirname, 'backend', 'scenarios'),
      absolute: true,
    });
    const frontendFiles = glob.sync('**/*.js', {
      cwd: join(__dirname, 'frontend', 'scenarios'),
      absolute: true,
    });
    filesToRun.push(...backendFiles, ...frontendFiles);
  }
  // Unknown target
  else {
    console.error(
      `${colors.red}❌ Unknown test target: "${targetArg}"${colors.reset}`
    );
    console.log(
      `Run ${colors.yellow}npm run k6 -- --list${colors.reset} to see all available shorthand targets.`
    );
    process.exit(1);
  }

  if (filesToRun.length === 0) {
    console.log(
      `${colors.yellow}⚠️  No matching test scenario files found.${colors.reset}`
    );
    process.exit(1);
  }

  console.log(
    `${colors.cyan}🎯 Target files: ${filesToRun.length} scenario(s)${colors.reset}`
  );
  console.log('');

  let allPassed = true;
  for (const testFile of filesToRun) {
    const passed = runTest(testFile, env, extraK6Args);
    if (!passed) allPassed = false;
    console.log('');
  }

  if (!allPassed) {
    console.error(
      `${colors.red}❌ One or more k6 test scenarios failed.${colors.reset}`
    );
    process.exit(1);
  }

  console.log(
    `${colors.green}🎉 All requested k6 tests completed successfully!${colors.reset}`
  );
}

main().catch((err) => {
  console.error(`${colors.red}❌ Error: ${err.message}${colors.reset}`);
  process.exit(1);
});
