import http from 'k6/http';
import { check } from 'k6';
import { dataGenerator } from './data-generator.js';
import { TEST_CONFIG, getUserLimits } from '../config/test-config.js';

// Script to create test users before running K6 tests - FIXED for your API
export function createTestUsers() {
  console.log('🚀 Creating test users for K6 testing...');
  console.log(`📊 Using constants: MAX_USERS=${getUserLimits().MAX_USERS}`);

  // Generate test users up to MAX_USERS constant
  const testUsers = dataGenerator.generateBulkUsers(getUserLimits().MAX_USERS);
  const createdUsers = [];
  let successCount = 0;
  let failureCount = 0;

  for (const user of testUsers) {
    try {
      // FIXED: Your API expects 'name' field, not 'firstName'/'lastName'
      const userData = {
        email: user.email,
        password: user.password,
        name: user.name, // FIXED: Use 'name' field
      };

      const response = http.post(
        `${TEST_CONFIG.baseUrls.auth}/api/auth/signup`, // FIXED: Use 'signup' endpoint
        JSON.stringify(userData),
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const success = check(response, {
        'user creation successful': (r) => r.status === 201,
        'user creation response time < 1s': (r) => r.timings.duration < 1000,
      });

      if (success) {
        createdUsers.push(user);
        successCount++;
        console.log(`✅ Created user: ${user.email}`);
      } else {
        failureCount++;
        console.error(
          `❌ Failed to create user: ${user.email}`,
          response.status,
          response.body
        );
      }

      // Small delay to avoid overwhelming the server
      if (successCount % 10 === 0) {
        console.log(
          `📊 Progress: ${successCount}/${testUsers.length} users created`
        );
      }
    } catch (error) {
      failureCount++;
      console.error(`❌ Error creating user ${user.email}:`, error);
    }
  }

  console.log(` Test user creation completed!`);
  console.log(`✅ Successfully created: ${successCount} users`);
  console.log(`❌ Failed to create: ${failureCount} users`);
  console.log(
    ` Success rate: ${((successCount / testUsers.length) * 100).toFixed(2)}%`
  );

  return createdUsers;
}

// Run this function to create users
createTestUsers();
