#!/usr/bin/env node

/**
 * K6 Test Runner with Test Type Support
 *
 * Supports:
 * - Running tests by category (backend, frontend)
 * - Running tests by type (load, stress, spike, soak, volume, capacity)
 * - Running all tests
 * - Helpful CLI interface
 *
 * Usage:
 *   node run-tests.js backend load
 *   node run-tests.js backend stress
 *   node run-tests.js frontend load
 *   node run-tests.js --help
 */

// Import Node.js modules
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { glob } from 'glob';

// Get current directory (ESM equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test categories
const CATEGORIES = ['backend', 'frontend'];

// Valid test types
const TEST_TYPES = ['load', 'stress', 'spike', 'soak', 'volume', 'capacity'];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
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
      // Skip empty lines and comments
      if (!line || line.startsWith('#')) return;

      // Split by first = sign
      const equalIndex = line.indexOf('=');
      if (equalIndex === -1) return;

      const key = line.substring(0, equalIndex).trim();
      const value = line.substring(equalIndex + 1).trim();

      // Remove quotes if present
      const cleanValue = value.replace(/^["']|["']$/g, '');

      if (key) {
        env[key] = cleanValue;
      }
    });

    return env;
  } catch (error) {
    // .env file doesn't exist, return empty object
    return {};
  }
}

// Build k6 environment variable flags
function buildK6EnvFlags(env) {
  return Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
}
/**
 * Print header
 */
function printHeader() {
  console.log(`${colors.cyan}${colors.bright}`);
  console.log('🚀 MiniMeet K6 Test Runner');
  console.log('==========================');
  console.log(`${colors.reset}`);
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`${colors.yellow}Usage:${colors.reset}`);
  console.log('  node run-tests.js [category] [test-type]');
  console.log('');
  console.log(`${colors.yellow}Categories:${colors.reset}`);
  CATEGORIES.forEach((cat) => {
    console.log(`  ${colors.green}${cat}${colors.reset}`);
  });
  console.log('');
  console.log(`${colors.yellow}Test Types:${colors.reset}`);
  TEST_TYPES.forEach((type) => {
    console.log(`  ${colors.cyan}${type}${colors.reset}`);
  });
  console.log('');
  console.log(`${colors.yellow}Examples:${colors.reset}`);
  console.log('  node run-tests.js backend load');
  console.log('  node run-tests.js backend stress');
  console.log('  node run-tests.js frontend load');
  console.log('  node run-tests.js --help');
  console.log('');
}

/**
 * Check if K6 is installed
 */
function checkK6() {
  try {
    execSync('k6 version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Run test file
 * @param {string} testFile - Path to test file
 */
function runTest(testFile, env = {}) {
  console.log(`${colors.cyan}📊 Running: ${testFile}${colors.reset}`);
  console.log('');

  try {
    const envFlags = buildK6EnvFlags(env);
    const command = envFlags
      ? `${envFlags} k6 run ${testFile}`
      : `k6 run ${testFile}`;

    // Execute k6 run command
    // stdio: 'inherit' means output goes to console
    execSync(`k6 run ${testFile}`, {
      stdio: 'inherit',
      cwd: __dirname,
      shell: true,
    });

    console.log('');
    console.log(`${colors.green}✅ Test completed${colors.reset}`);
    return true;
  } catch (error) {
    console.log('');
    console.log(`${colors.red}❌ Test failed${colors.reset}`);
    return false;
  }
}

/**
 * Run tests by category and type
 * @param {string} category - Test category (backend/frontend)
 * @param {string} testType - Test type (load/stress/etc.)
 */
async function runTests(category, testType) {
  // Load environment variables
  const env = loadEnvFile();
  if (Object.keys(env).length > 0) {
    console.log(
      `${colors.cyan}📝 Loaded ${
        Object.keys(env).length
      } environment variables${colors.reset}`
    );
  }

  // Validate category
  if (!CATEGORIES.includes(category)) {
    console.error(
      `${colors.red}❌ Invalid category: ${category}${colors.reset}`
    );
    console.log(`Valid categories: ${CATEGORIES.join(', ')}`);
    process.exit(1);
  }

  // Validate test type
  if (testType && !TEST_TYPES.includes(testType)) {
    console.error(
      `${colors.red}❌ Invalid test type: ${testType}${colors.reset}`
    );
    console.log(`Valid types: ${TEST_TYPES.join(', ')}`);
    process.exit(1);
  }

  // Build glob pattern
  const testDir = join(__dirname, category, 'scenarios');
  const pattern = testType
    ? `**/${testType}.js` // Specific test type: **/load.js
    : '**/*.js'; // All tests: **/*.js

  // Find test files
  const testFiles = await glob(pattern, {
    cwd: testDir,
    absolute: true,
  });

  if (testFiles.length === 0) {
    console.log(
      `${colors.yellow}⚠️  No ${testType || 'test'} files found in ${category}${
        colors.reset
      }`
    );
    return;
  }

  console.log(
    `${colors.cyan}🚀 Running ${testFiles.length} test(s) for ${category}/${
      testType || 'all'
    }${colors.reset}`
  );
  console.log('');

  // Run each test file
  for (const testFile of testFiles) {
    runTest(testFile, env);
    console.log('');
  }

  console.log(`${colors.green}🎉 All tests completed!${colors.reset}`);
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);

  // Handle help flag
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printHeader();
    printHelp();
    return;
  }

  // Check K6 installation
  if (!checkK6()) {
    console.error(
      `${colors.red}❌ K6 is not installed or not in PATH${colors.reset}`
    );
    console.log('');
    console.log('Please install K6:');
    console.log('  Windows: choco install k6');
    console.log('  macOS: brew install k6');
    console.log(
      '  Linux: See https://k6.io/docs/getting-started/installation/'
    );
    process.exit(1);
  }

  printHeader();

  // Get category and test type from arguments
  const category = args[0] || 'backend';
  const testType = args[1] || null;

  // Run tests
  runTests(category, testType).catch((error) => {
    console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

// Run main function
main();
