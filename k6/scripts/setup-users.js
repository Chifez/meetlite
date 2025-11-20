#!/usr/bin/env node

/**
 * Setup Test Users Script
 * Creates test users for K6 performance testing
 *
 * Usage:
 *   node scripts/setup-users.js [count]
 *
 * Example:
 *   node scripts/setup-users.js 100
 */

import http from 'http';
import { CONFIG } from '../config/index.js';
import { ENDPOINTS } from '../config/endpoints.js';

// Get command line arguments
// process.argv[0] = node executable
// process.argv[1] = script path
// process.argv[2] = first argument (user count)
const userCount = parseInt(process.argv[2] || '10', 10);
const baseUrl = CONFIG.apiGateway.baseUrl;

console.log(`🚀 Creating ${userCount} test users...`);
console.log(`📡 API Gateway: ${baseUrl}`);
console.log('');

let successCount = 0;
let failureCount = 0;

/**
 * Create a single test user
 * @param {number} index - User index number
 * @returns {Promise<boolean>} - True if successful
 *
 * Syntax explanation:
 * - Async function for making HTTP request
 * - Returns Promise that resolves to boolean
 */
async function createUser(index) {
  const user = {
    email: `${CONFIG.testUsers.prefix}-${index}@test.minimeet.com`,
    password: `TestPassword${index}!`,
    name: `Test User ${index}`,
  };

  return new Promise((resolve) => {
    // Build full URL
    const url = `${baseUrl}${ENDPOINTS.auth.signup()}`;

    // Parse URL to get hostname and path
    const urlObj = new URL(url);

    // HTTP request options
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Create HTTP request
    const req = http.request(options, (res) => {
      let data = '';

      // Collect response data
      res.on('data', (chunk) => {
        data += chunk;
      });

      // Handle response end
      res.on('end', () => {
        if (res.statusCode === 201) {
          successCount++;
          if (index % 10 === 0) {
            console.log(`✅ Created user ${index}/${userCount}`);
          }
          resolve(true);
        } else {
          failureCount++;
          console.error(`❌ Failed to create user ${index}: ${res.statusCode}`);
          resolve(false);
        }
      });
    });

    // Handle request errors
    req.on('error', (error) => {
      failureCount++;
      console.error(`❌ Error creating user ${index}:`, error.message);
      resolve(false);
    });

    // Send request body
    req.write(JSON.stringify(user));
    req.end();
  });
}

/**
 * Main function
 * Creates all test users sequentially
 */
async function main() {
  console.log('📝 Starting user creation...');
  console.log('');

  // Create users sequentially (to avoid overwhelming server)
  for (let i = 1; i <= userCount; i++) {
    await createUser(i);

    // Small delay between requests (100ms)
    // Prevents overwhelming the server
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log('');
  console.log('📊 Summary:');
  console.log(`✅ Successfully created: ${successCount} users`);
  console.log(`❌ Failed to create: ${failureCount} users`);
  console.log(
    `📈 Success rate: ${((successCount / userCount) * 100).toFixed(2)}%`
  );
  console.log('');

  if (successCount > 0) {
    console.log('✅ Setup complete! You can now run K6 tests.');
  } else {
    console.log(
      '❌ Setup failed. Please check your API Gateway and auth service.'
    );
    process.exit(1);
  }
}

// Run main function
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
