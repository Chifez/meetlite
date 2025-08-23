/**
 * Authentication Helper for K6 Tests
 *
 * This module handles authentication for the single test user approach.
 * One user, one token, used across all VUs for performance testing.
 */

import http from 'k6/http';
import { check } from 'k6';

// Test user credentials
const TEST_USER = {
  email: 'chifez@gmail.com',
  password: '@Chifez01',
};

// Base URL for auth service
const AUTH_BASE_URL = 'http://localhost:5000'; // Fixed: auth service runs on 5000

/**
 * Login with test user and get JWT token
 * @returns {string|null} JWT token or null if login fails
 */
export function loginAndGetToken() {
  console.log('🔐 Logging in with test user...');

  const payload = JSON.stringify({
    email: TEST_USER.email,
    password: TEST_USER.password,
  });

  const response = http.post(`${AUTH_BASE_URL}/api/auth/login`, payload, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const success = check(response, {
    'login successful': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000, // More realistic for auth
    'has token': (r) => r.json('token') !== undefined,
  });

  if (success) {
    const token = response.json('token');
    console.log('✅ Login successful, token obtained');
    return token;
  } else {
    console.error('❌ Login failed:', response.status, response.body);
    return null;
  }
}

/**
 * Get authenticated headers for API requests
 * @param {string} token - JWT token
 * @returns {Object} Headers object with Authorization
 */
export function getAuthHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Validate token is still valid
 * @param {string} token - JWT token to validate
 * @returns {boolean} True if token is valid
 */
export function validateToken(token) {
  // For now, just check if token exists and has basic format
  // In a real implementation, you might want to decode and check expiration
  return token && token.length > 20 && token.includes('.');
}

/**
 * Get test user information
 * @returns {Object} Test user object
 */
export function getTestUser() {
  return {
    ...TEST_USER,
    userId: 'chifez_test_user',
    name: 'Chifez Test User',
  };
}
