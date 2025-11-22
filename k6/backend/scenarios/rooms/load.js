/**
 * Room Operations Load Test
 * Normal expected load on room endpoints
 *
 * This test demonstrates:
 * - Using test type configuration (load)
 * - Making API calls with ApiClient
 * - Generating test data
 * - Checking responses
 * - Recording custom metrics
 */

// Import k6's check function for assertions
// check() validates responses and records pass/fail
import { check } from 'k6';

// Import k6 metrics
// Rate: tracks success/failure rate (0.0 to 1.0)
// Trend: tracks numerical values over time (for averages, percentiles)
import { Rate, Trend } from 'k6/metrics';

// Import test type executor
// createTestOptions applies 'load' test type configuration
import { createTestOptions } from '../../../shared/test-executors.js';

// Import API client for making HTTP requests
import { ApiClient } from '../../../backend/utils/api-client.js';

// Import authentication utility
// login() authenticates and returns JWT token
import { login } from '../../../backend/utils/auth.js';

// Import endpoint definitions
import { ENDPOINTS } from '../../../config/endpoints.js';

// Import data generators
import { generateRoom } from '../../../backend/utils/data-generators.js';

/**
 * Custom Metrics
 * These are k6 custom metrics we define ourselves
 *
 * Syntax explanation:
 * - new Rate('name') creates a rate metric (0.0 = 0%, 1.0 = 100%)
 * - new Trend('name') creates a trend metric (for averages, percentiles)
 * - Rate.add(1) = success, Rate.add(0) = failure
 * - Trend.add(value) records a value
 */
const roomSuccess = new Rate('room_operation_success');
const roomTime = new Trend('room_operation_time');
const roomCreateTime = new Trend('room_create_time'); // Added: separate metric for creation
const roomJoinTime = new Trend('room_join_time'); // Added: separate metric for join

/**
 * K6 Options Configuration
 *
 * Syntax explanation:
 * - export const options makes this available to k6
 * - createTestOptions('load', {...}) applies load test configuration
 * - custom thresholds override test type defaults
 */
export const options = createTestOptions('load', {
  // Custom thresholds for this specific test
  // These override the default 'load' thresholds
  thresholds: {
    room_operation_success: ['rate>0.95'], // 95% success rate required
    room_operation_time: ['p(95)<1000'], // 95% of operations < 1s
    room_create_time: ['p(95)<1000'], // Updated: 2x industry standard (500ms * 2)
    room_join_time: ['p(95)<1000'],
  },
});

/**
 * Setup Function
 * Runs once before all virtual users (VUs) start
 *
 * Syntax explanation:
 * - export function setup() is special k6 function
 * - Runs once per test execution (not per VU)
 * - Return value is passed to default function as 'data' parameter
 * - Perfect for authentication or test data preparation
 */
export function setup() {
  console.log('🔐 Setting up room load test...');

  // Login and get token
  // login() returns JWT token or null
  const token = login();

  // Check if login was successful
  if (!token) {
    // throw stops execution and reports error
    throw new Error('Failed to authenticate during setup');
  }

  console.log('✅ Setup complete - token obtained');

  // Return token to be used by all VUs
  // This object is passed to default function as 'data' parameter
  return { token };
}

/**
 * Default Function (Main Test Logic)
 * Runs for each virtual user (VU) and iteration
 *
 * Syntax explanation:
 * - export default function(data) is the main test function
 * - Runs multiple times (once per VU per iteration)
 * - data parameter contains what was returned from setup()
 * - { token } is destructuring - extracts token from data object
 */
export default function (data) {
  // Destructure token from setup data
  // Syntax: { token } extracts 'token' property from data object
  // Equivalent to: const token = data.token;
  const { token } = data;

  // Create API client with token
  // new ApiClient(token) creates instance with authentication
  const client = new ApiClient(token);

  // Generate test data
  // generateRoom() creates unique room configuration
  const roomData = generateRoom();

  // Test 1: Create Room
  // Record start time for performance measurement
  const startTime = Date.now();

  // Make POST request to create room
  // ENDPOINTS.rooms.create() returns URL string: '/api/rooms'
  // client.post(url, body) sends POST request with JSON body
  const createRes = client.post(ENDPOINTS.rooms.create(), {
    settings: roomData.settings,
  });

  // Calculate duration
  // Date.now() returns current timestamp in milliseconds
  // Subtract startTime to get elapsed time
  const createTime = Date.now() - startTime;
  roomCreateTime.add(createTime); // Added: track creation time separately

  // Check if room creation was successful
  // check() validates response and records pass/fail
  // Syntax: check(response, { 'name': function }) where function returns boolean
  const createOk = check(createRes, {
    // Check 1: Status code is 201 (Created)
    // Arrow function: (r) => r.status === 201
    // r is the response object
    // === means strict equality (exact match)
    'room created': (r) => r.status === 201,

    // Check 2: Response has roomId
    // response.json() parses JSON body
    // && is logical AND (both conditions must be true)
    'room has ID': (r) => {
      const body = r.json();
      return body && body.roomId !== undefined;
    },

    // Check 3: Response time is acceptable
    // Duration check: createTime should be less than 2000ms
    'create time < 1s': () => createTime < 1000,
  });

  // If room creation failed, exit early
  // return stops function execution
  if (!createOk) {
    roomSuccess.add(0); // Record failure
    return; // Exit early - don't continue with other tests
  }

  // Extract roomId from response
  // JSON.parse() converts JSON string to JavaScript object
  // .roomId accesses the roomId property
  const roomId = createRes.json().roomId;

  // Test 2: Join Room
  const joinStart = Date.now();

  // Make POST request to join room
  // ENDPOINTS.rooms.join(roomId) returns URL: '/api/rooms/{roomId}/join'
  // Empty object {} as body (room join might not need body)
  const joinRes = client.post(ENDPOINTS.rooms.join(roomId), {});

  const joinTime = Date.now() - joinStart;

  // Check if room join was successful
  const joinOk = check(joinRes, {
    'room joined': (r) => r.status === 200,
    'join time < 1s': () => joinTime < 1000,
  });

  // Record metrics
  // roomSuccess.add(1) = success, roomSuccess.add(0) = failure
  // roomTime.add(duration) records the time taken
  roomSuccess.add(joinOk ? 1 : 0);
  roomJoinTime.add(joinTime); // Added: track join time separately
  roomTime.add(joinTime);

  // Note: No cleanup needed - k6 handles VU lifecycle
  // Rooms created during test can be cleaned up later via scripts
}
