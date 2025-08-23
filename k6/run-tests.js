#!/usr/bin/env node

/**
 * K6 Performance Test Runner
 * Orchestrates and runs K6 performance tests for MiniMeet
 *
 * Architecture: HTTP API for room operations + WebSocket for real-time events
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test scenarios configuration
const TEST_SCENARIOS = {
  'room-capacity': {
    description: 'Test room capacity limits with HTTP API + WebSocket events',
    file: 'scenarios/room-capacity.js',
    target: '5 users', //basic test size for now should increase to 10+
    duration: '8 minutes',
  },
  'room-operation': {
    description: 'Test room operations under realistic load',
    file: 'scenarios/room-operation.js',
    target: '25 users',
    duration: '8 minutes',
  },
  'connection-load': {
    description: 'Test WebSocket connection handling with increasing load',
    file: 'scenarios/connection-load.js',
    target: '100 users',
    duration: '8 minutes',
  },
  'stress-test': {
    description: 'Extreme stress testing to find breaking points',
    file: 'scenarios/stress-test.js',
    target: '200 users',
    duration: '8 minutes',
  },
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function printHeader() {
  console.log(`${colors.cyan}${colors.bright}`);
  console.log('🚀 MiniMeet K6 Performance Test Runner');
  console.log('=====================================');
  console.log(`${colors.reset}`);
  console.log('📊 Architecture: HTTP API + WebSocket Events');
  console.log('🔐 Authentication: Single JWT token across all VUs');
  console.log('🏠 Room Operations: HTTP API endpoints');
  console.log('📡 Real-time Events: WebSocket/Socket.IO');
  console.log('');
}

function printHelp() {
  console.log(`${colors.yellow}Usage:${colors.reset}`);
  console.log('  node run-tests.js [scenario] [options]');
  console.log('');
  console.log(`${colors.yellow}Available Scenarios:${colors.reset}`);

  Object.entries(TEST_SCENARIOS).forEach(([key, config]) => {
    console.log(`  ${colors.green}${key}${colors.reset}`);
    console.log(`    ${config.description}`);
    console.log(`    Target: ${colors.cyan}${config.target}${colors.reset}`);
    console.log(
      `    Duration: ${colors.cyan}${config.duration}${colors.reset}`
    );
    console.log('');
  });

  console.log(`${colors.yellow}Options:${colors.reset}`);
  console.log('  --help, -h     Show this help message');
  console.log('  --list, -l     List available test scenarios');
  console.log('  --all          Run all test scenarios sequentially');
  console.log('');
  console.log(`${colors.yellow}Examples:${colors.reset}`);
  console.log('  node run-tests.js room-capacity');
  console.log('  node run-tests.js --all');
  console.log('  node run-tests.js --list');
  console.log('');
}

function listScenarios() {
  console.log(`${colors.yellow}Available Test Scenarios:${colors.reset}`);
  console.log('');

  Object.entries(TEST_SCENARIOS).forEach(([key, config]) => {
    console.log(`${colors.green}${key}${colors.reset}`);
    console.log(`  ${config.description}`);
    console.log(`  Target: ${colors.cyan}${config.target}${colors.reset}`);
    console.log(`  Duration: ${colors.cyan}${config.duration}${colors.reset}`);
    console.log(`  File: ${colors.magenta}${config.file}${colors.reset}`);
    console.log('');
  });
}

function checkK6Installation() {
  try {
    execSync('k6 version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

function runTest(scenarioName) {
  const scenario = TEST_SCENARIOS[scenarioName];

  if (!scenario) {
    console.error(
      `${colors.red}❌ Unknown test scenario: ${scenarioName}${colors.reset}`
    );
    console.log('');
    printHelp();
    process.exit(1);
  }

  const testFile = join(__dirname, scenario.file);

  if (!fs.existsSync(testFile)) {
    console.error(
      `${colors.red}❌ Test file not found: ${testFile}${colors.reset}`
    );
    process.exit(1);
  }

  console.log(
    `${colors.cyan}🚀 Running ${scenarioName} test...${colors.reset}`
  );
  console.log(`📊 ${scenario.description}`);
  console.log(`🎯 Target: ${scenario.target}`);
  console.log(`⏱️  Duration: ${scenario.duration}`);
  console.log(`📁 File: ${scenario.file}`);
  console.log('');

  try {
    console.log(
      `${colors.yellow}⚠️  Make sure your backend services are running:${colors.reset}`
    );
    console.log(
      `   Auth Service: ${colors.cyan}http://localhost:5000${colors.reset}`
    );
    console.log(
      `   Room Service: ${colors.cyan}http://localhost:5001${colors.reset}`
    );
    console.log(
      `   Signaling Service: ${colors.cyan}http://localhost:5002${colors.reset}`
    );
    console.log('');

    console.log(`${colors.green}✅ Starting K6 test...${colors.reset}`);
    console.log('');

    // Run K6 test
    const command = `k6 run ${testFile}`;
    execSync(command, { stdio: 'inherit', cwd: __dirname });

    console.log('');
    console.log(
      `${colors.green}✅ Test completed successfully!${colors.reset}`
    );
  } catch (error) {
    console.error('');
    console.error(`${colors.red}❌ Test failed:${colors.reset}`);
    console.error(error.message);
    process.exit(1);
  }
}

function runAllTests() {
  console.log(
    `${colors.cyan}🚀 Running all test scenarios sequentially...${colors.reset}`
  );
  console.log('');

  const scenarios = Object.keys(TEST_SCENARIOS);

  for (const scenario of scenarios) {
    console.log(
      `${colors.yellow}=====================================${colors.reset}`
    );
    runTest(scenario);
    console.log('');

    // Wait between tests
    if (scenario !== scenarios[scenarios.length - 1]) {
      console.log(
        `${colors.cyan}⏳ Waiting 5 seconds before next test...${colors.reset}`
      );
      console.log('');
      // Note: In Node.js, we can't use sleep, so we'll just continue
      // In a real implementation, you might want to add a delay here
    }
  }

  console.log(`${colors.green}🎉 All tests completed!${colors.reset}`);
}

// Main execution
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHeader();
    printHelp();
    return;
  }

  if (args.includes('--list') || args.includes('-l')) {
    printHeader();
    listScenarios();
    return;
  }

  // Check K6 installation
  if (!checkK6Installation()) {
    console.error(
      `${colors.red}❌ K6 is not installed or not in PATH${colors.reset}`
    );
    console.log('');
    console.log('Please install K6 first:');
    console.log(
      '  Windows: https://k6.io/docs/getting-started/installation/windows/'
    );
    console.log('  macOS: brew install k6');
    console.log(
      '  Linux: https://k6.io/docs/getting-started/installation/linux/'
    );
    console.log('');
    process.exit(1);
  }

  printHeader();

  if (args.includes('--all')) {
    runAllTests();
  } else {
    const scenarioName = args[0];
    runTest(scenarioName);
  }
}

// Run if called directly
main();
