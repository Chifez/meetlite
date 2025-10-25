import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { TEST_CONFIG } from '../config/test-config.js';
import { loginAndGetToken, getAuthHeaders } from '../utils/auth-helper.js';
import { joinRoom, getRoom } from '../utils/room-helper.js';

// Custom metrics
const roomJoinRate = new Rate('room_join_success');
const roomJoinTime = new Trend('room_join_time');
const roomOperationRate = new Rate('room_operation_success');
const roomOperationTime = new Trend('room_operation_time');

// Test configuration
const { targets, durations } = TEST_CONFIG;

export const options = {
  stages: [
    { duration: durations.rampUp, target: targets.roomCapacity },
    { duration: durations.steady, target: targets.roomCapacity },
    { duration: durations.rampDown, target: 0 },
  ],
  thresholds: {
    room_join_success: ['rate>0.95'],
    room_operation_success: ['rate>0.95'],
    room_join_time: ['p(95)<2000'],
    room_operation_time: ['p(95)<2000'],
  },
};

// Global variables
let authToken;
let testRoomId = 'h03e2dgFaj'; // Use real room ID from database

export function setup() {
  console.log('🔐 Setting up authentication...');

  // Login once to get token
  authToken = loginAndGetToken();

  if (!authToken) {
    throw new Error('❌ Authentication failed during setup');
  }

  console.log('✅ Authentication successful');
  console.log(`🎯 Testing with ${targets.roomCapacity} virtual users`);

  return { authToken, testRoomId };
}

export default function (data) {
  const { authToken, testRoomId } = data;

  if (!authToken) {
    console.error('❌ No auth token available');
    return;
  }

  const headers = getAuthHeaders(authToken);

  // Test 1: Join room via HTTP API
  const joinStartTime = Date.now();
  const joinResponse = joinRoom(testRoomId, headers);
  const joinTime = Date.now() - joinStartTime;

  const joinSuccess = check(joinResponse, {
    'join room successful': (r) => r !== null && r !== undefined,
    'has room data': (r) =>
      r &&
      (r.room !== undefined ||
        r.id !== undefined ||
        r.participant !== undefined),
  });

  roomJoinRate.add(joinSuccess ? 1 : 0);
  roomJoinTime.add(joinTime);

  if (!joinSuccess) {
    console.error(
      `❌ Join room failed: ${
        joinResponse ? 'Response received but invalid' : 'No response'
      }`
    );
  }

  // Test 2: Get room info
  const getStartTime = Date.now();
  const getResponse = getRoom(testRoomId, headers);
  const getTime = Date.now() - getStartTime;

  const getSuccess = check(getResponse, {
    'get room successful': (r) => r !== null && r !== undefined,
    'has room data': (r) => r && (r.id !== undefined || r.roomId !== undefined),
  });

  roomOperationRate.add(getSuccess ? 1 : 0);
  roomOperationTime.add(getTime);

  if (!getSuccess) {
    console.error(
      `❌ Get room failed: ${
        getResponse ? 'Response received but invalid' : 'No response'
      }`
    );
  }

  // Simulate user activity
  sleep(1);
}

export function teardown(data) {
  console.log('🧹 Cleaning up test data...');
  // Cleanup could be added here if needed
}
