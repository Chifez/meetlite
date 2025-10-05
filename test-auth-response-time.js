#!/usr/bin/env node

import axios from 'axios';

async function testAuthResponseTime() {
  console.log('🔍 Testing auth service response time...\n');

  const startTime = Date.now();

  try {
    const response = await axios.post(
      'http://localhost:5000/api/v1/auth/login',
      {
        email: 'test@example.com',
        password: 'testpassword',
      },
      {
        timeout: 15000, // 15 second timeout
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    console.log('✅ Auth service responded successfully!');
    console.log(`⏱️  Response time: ${responseTime}ms`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log(`📦 Data:`, response.data);
  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    console.error('❌ Auth service test failed!');
    console.log(`⏱️  Time before failure: ${responseTime}ms`);

    if (error.code === 'ECONNABORTED') {
      console.error('⏰ Request timed out after 15 seconds');
    } else if (error.code === 'ECONNRESET') {
      console.error('🔌 Connection was reset by the server');
    } else if (error.response) {
      console.error(`📊 Response Status: ${error.response.status}`);
      console.error(`📦 Response Data:`, error.response.data);
    } else {
      console.error('🔧 Error:', error.message);
    }
  }
}

async function testDatabaseConnection() {
  console.log('\n🔍 Testing database connection through health endpoint...\n');

  try {
    const response = await axios.get('http://localhost:5000/health', {
      timeout: 5000,
    });

    console.log('✅ Health check successful!');
    console.log(`📦 Response:`, response.data);
  } catch (error) {
    console.error('❌ Health check failed!');
    console.error('🔧 Error:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting auth service performance tests...\n');

  await testDatabaseConnection();
  await testAuthResponseTime();

  console.log('\n📋 Tests complete!');
}

runTests().catch(console.error);
