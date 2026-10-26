/**
 * Authentication Utilities for K6 Tests
 * Handles login, token management, and user authentication
 */

// Import API client to make auth requests
import { ApiClient } from './api-client.js';

// Import endpoints configuration
import { ENDPOINTS } from '../../config/endpoints.js';

// Import configuration for default test user
import { CONFIG } from '../../config/index.js';

/**
 * Global token cache
 * Stores token in memory for reuse across test iterations
 *
 * Syntax explanation:
 * - let allows variable to be reassigned (unlike const)
 * - null is initial value (no token yet)
 * - Module-level variable persists across function calls in same test run
 */
let cachedToken = null;

/**
 * Login and get JWT token
 * @param {string|null} email - User email (optional, uses default if not provided)
 * @param {string|null} password - User password (optional, uses default if not provided)
 * @returns {string|null} - JWT token or null if login fails
 *
 * Syntax explanation:
 * - async function means this function can use await (though k6 doesn't support async/await)
 * - We'll use synchronous approach instead
 * - || operator provides fallback: email || CONFIG.testUser.email
 */
export function login(email = null, password = null) {
  // Create API client instance (no token needed for login)
  const client = new ApiClient();

  // Use provided email/password or fall back to default from config
  // Syntax: value || fallback
  // If email is null/undefined/empty, use CONFIG.testUser.email
  const userEmail = email || CONFIG.testUsers.default.email;
  const userPassword = password || CONFIG.testUsers.default.password;

  // Make login request
  // ENDPOINTS.auth.login() calls the function to get the URL string
  const response = client.post(ENDPOINTS.auth.login(), {
    email: userEmail,
    password: userPassword,
  });

  if (response.status === 200) {
    const data = response.json();
    const token = data?.data?.token || data?.data?.accessToken || data?.token;
    cachedToken = token;
    return token;
  }

  // If user doesn't exist yet, attempt signup
  if (
    CONFIG.testUsers.allowProvisionDuringTest &&
    (response.status === 401 || response.status === 404)
  ) {
    console.log(
      `ℹ️ User not found, automatically provisioning test user: ${userEmail}`
    );
    const signupRes = client.post(ENDPOINTS.auth.signup(), {
      email: userEmail,
      password: userPassword,
      name: 'Test User',
    });
    if (signupRes.status === 200 || signupRes.status === 201) {
      const data = signupRes.json();
      const token =
        data?.data?.token ||
        data?.data?.accessToken ||
        data.token ||
        data.accessToken;
      if (token) {
        client.post(
          ENDPOINTS.auth.onboarding(),
          { name: 'Test User', useCase: 'personal' },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        cachedToken = token;
        return token;
      }
    }
  }

  const errorBody = response.json();
  console.error(`   Status: ${response.status}`);
  console.error(
    `   Message: ${errorBody?.message || errorBody?.error || 'Unknown error'}`
  );
  return null;
}

/**
 * Get cached authentication token
 * @returns {string|null} - Cached token or null if not logged in
 *
 * Syntax explanation:
 * - Simple getter function returns cached token
 * - Useful when you've already logged in and just need the token
 */
export function getToken() {
  return cachedToken;
}

/**
 * Clear cached token
 * Useful for logout scenarios or starting fresh
 *
 * Syntax explanation:
 * - Sets cachedToken to null to clear it
 * - void function (doesn't return anything)
 */
export function clearToken() {
  cachedToken = null;
}

/**
 * Validate if token exists and is valid format
 * @param {string} token - JWT token to validate
 * @returns {boolean} - True if token appears valid, false otherwise
 *
 * Syntax explanation:
 * - Simple validation (doesn't verify signature, just checks format)
 * - && is logical AND - all conditions must be true
 * - .length > 20 checks minimum length
 * - .includes('.') checks for JWT format (contains dots)
 */
export function isValidToken(token) {
  return token && token.length > 20 && token.includes('.');
}

/**
 * Login and validate token
 * Wrapper function that logs in and checks if token is valid
 * @param {string|null} email - Optional email
 * @param {string|null} password - Optional password
 * @returns {string|null} - Valid token or null
 *
 * Syntax explanation:
 * - Calls login() first
 * - Then validates the returned token
 * - If valid, returns it; otherwise returns null
 */
export function loginAndValidate(email = null, password = null) {
  const token = login(email, password);

  if (isValidToken(token)) {
    return token;
  }

  return null;
}
