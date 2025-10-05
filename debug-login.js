#!/usr/bin/env node

import axios from 'axios';

async function testLogin() {
  console.log('🔍 Testing login request...\n');

  try {
    console.log(
      '📡 Sending POST request to http://localhost:3000/api/auth/login'
    );

    const response = await axios.post(
      'http://localhost:3000/api/auth/login',
      {
        email: 'test@example.com',
        password: 'testpassword',
      },
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5174',
        },
      }
    );

    console.log('✅ Login successful!');
    console.log('📊 Response:', response.status, response.statusText);
    console.log('📦 Data:', response.data);
  } catch (error) {
    console.error('❌ Login failed!');

    if (error.response) {
      console.error('📊 Response Status:', error.response.status);
      console.error('📊 Response Headers:', error.response.headers);
      console.error('📦 Response Data:', error.response.data);
    } else if (error.request) {
      console.error('🔗 Request made but no response received');
      console.error('🔍 Request details:', error.request);
    } else {
      console.error('🔧 Error setting up request:', error.message);
    }

    console.error('\n🔍 Full Error:', error);
  }
}

async function testAuthService() {
  console.log('\n🔍 Testing auth service directly...\n');

  try {
    console.log(
      '📡 Sending POST request to http://localhost:5000/api/auth/login'
    );

    const response = await axios.post(
      'http://localhost:5000/api/auth/login',
      {
        email: 'test@example.com',
        password: 'testpassword',
      },
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Direct auth service call successful!');
    console.log('📊 Response:', response.status, response.statusText);
    console.log('📦 Data:', response.data);
  } catch (error) {
    console.error('❌ Direct auth service call failed!');

    if (error.code === 'ECONNREFUSED') {
      console.error('🚨 Auth service is not running on port 5000');
    } else if (error.code === 'ECONNABORTED') {
      console.error('⏰ Auth service request timed out');
    } else {
      console.error('🔧 Error:', error.message);
    }
  }
}

async function runTests() {
  console.log('🚀 Starting login debugging tests...\n');

  await testAuthService();
  await testLogin();

  console.log('\n📋 Debugging complete!');
  console.log('💡 Check the API Gateway console for detailed logs.');
}

runTests().catch(console.error);
