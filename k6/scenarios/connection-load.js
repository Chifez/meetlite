import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { TEST_CONFIG } from '../config/test-config.js';
import { loginAndGetToken } from '../utils/auth-helper.js';
import { RoomHelper } from '../utils/room-helper.js';
import { WebSocketHelper } from '../utils/websocket-helper.js';
import { dataGenerator } from '../utils/data-generator.js';

// Test configuration
const { durations, targets } = TEST_CONFIG;

// Custom metrics
const connectionRate = new Rate('connection_success');
const roomOperationRate = new Rate('room_operation_success');
const wsEventRate = new Rate('websocket_event_success');
const connectionTime = new Trend('connection_time');
const operationTime = new Trend('operation_time');

// Initialize helpers
const roomHelper = new RoomHelper(TEST_CONFIG.baseUrls.room);
const wsHelper = new WebSocketHelper(TEST_CONFIG.baseUrls.mediasoup);

export const options = {
  stages: [
    { duration: durations.rampUp, target: targets.connectionLoad },
    { duration: durations.steady, target: targets.connectionLoad },
    { duration: durations.rampDown, target: 0 },
  ],
  thresholds: {
    connection_success: ['rate>0.95'],
    room_operation_success: ['rate>0.95'],
    websocket_event_success: ['rate>0.95'],
    connection_time: ['p(95)<2000'],
    operation_time: ['p(95)<2000'],
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

export function setup() {
  console.log(
    '🚀 Setting up connection load test with single user authentication...'
  );

  // Login once to get JWT token
  const token = loginAndGetToken();
  if (!token) {
    throw new Error('Failed to authenticate test user');
  }

  console.log('✅ Authentication successful');
  console.log('🎯 Single user will be used across all VUs for testing');

  // Create a test room
  const testRoom = dataGenerator.generateRoomData();
  console.log(`🏠 Test room data prepared: ${testRoom.roomId}`);

  return { token, testRoom };
}

export default function (data) {
  const { token, testRoom } = data;

  // STEP 1: Test WebSocket connection (connection load focus)
  const connectionStart = Date.now();
  const wsConnected = wsHelper.connectWebSocket(token);
  const connectionDuration = Date.now() - connectionStart;
  connectionTime.add(connectionDuration);

  if (!wsConnected) {
    connectionRate.add(0);
    console.error('❌ Failed to connect WebSocket');
    return;
  }

  connectionRate.add(1);
  console.log('✅ Successfully connected WebSocket');

  // STEP 2: Join room via HTTP API
  const operationStart = Date.now();
  const joinResult = roomHelper.joinRoom(token, testRoom.roomId);

  if (joinResult) {
    roomOperationRate.add(1);
    console.log('✅ Successfully joined room via HTTP API');

    // STEP 3: Join Socket.IO room for real-time events
    const wsJoinSuccess = wsHelper.joinRoom(token, testRoom.roomId);
    if (wsJoinSuccess) {
      wsEventRate.add(1);
      console.log('✅ Successfully joined Socket.IO room');

      // STEP 4: Simulate multiple real-time events (connection load testing)
      const eventTypes = [
        'chat-message',
        'collaboration:update',
        'media:update',
        'presence:update',
      ];

      // Send multiple events to test connection handling
      for (let i = 0; i < 5; i++) {
        const eventType =
          eventTypes[Math.floor(Math.random() * eventTypes.length)];
        let eventData;

        switch (eventType) {
          case 'chat-message':
            eventData = `Load test message ${i} from VU ${__VU}`;
            const chatSuccess = wsHelper.sendChatMessage(
              token,
              testRoom.roomId,
              eventData
            );
            if (chatSuccess) wsEventRate.add(1);
            break;

          case 'collaboration:update':
            eventData = {
              tool: 'whiteboard',
              action: 'draw',
              coordinates: { x: Math.random() * 100, y: Math.random() * 100 },
              timestamp: new Date().toISOString(),
            };
            const collabSuccess = wsHelper.sendMessage(
              token,
              testRoom.roomId,
              eventType,
              eventData
            );
            if (collabSuccess) wsEventRate.add(1);
            break;

          case 'media:update':
            eventData = {
              audio: Math.random() > 0.5,
              video: Math.random() > 0.5,
              screenShare: Math.random() > 0.8,
            };
            const mediaSuccess = wsHelper.sendMessage(
              token,
              testRoom.roomId,
              eventType,
              eventData
            );
            if (mediaSuccess) wsEventRate.add(1);
            break;

          case 'presence:update':
            eventData = {
              status: Math.random() > 0.5 ? 'active' : 'away',
              lastSeen: new Date().toISOString(),
            };
            const presenceSuccess = wsHelper.sendMessage(
              token,
              testRoom.roomId,
              eventType,
              eventData
            );
            if (presenceSuccess) wsEventRate.add(1);
            break;
        }

        // Small delay between events
        if (i < 4) {
          // Simulate realistic user behavior
          const delay = Math.random() * 100 + 50; // 50-150ms
          // Note: In K6, we can't use sleep() in the main function, so we'll just continue
        }
      }

      // STEP 5: Leave Socket.IO room
      const wsLeaveSuccess = wsHelper.leaveRoom(token, testRoom.roomId);
      if (wsLeaveSuccess) {
        wsEventRate.add(1);
        console.log('✅ Successfully left Socket.IO room');
      } else {
        wsEventRate.add(0);
        console.error('❌ Failed to leave Socket.IO room');
      }

      // Record total operation time
      const totalOperationTime = Date.now() - operationStart;
      operationTime.add(totalOperationTime);
    } else {
      wsEventRate.add(0);
      console.error('❌ Failed to join Socket.IO room');
    }
  } else {
    roomOperationRate.add(0);
    console.error('❌ Failed to join room via HTTP API');
  }

  // STEP 6: Disconnect WebSocket
  wsHelper.disconnectWebSocket(token);
}

export function teardown(data) {
  console.log('🧹 Cleaning up connection load test...');

  // Get final statistics
  const roomStats = roomHelper.getRoomStats();
  const wsStats = wsHelper.getConnectionStats();

  console.log('📊 Connection Load Test Stats:');
  console.log('📊 Room Operations Stats:', roomStats);
  console.log('📊 WebSocket Stats:', wsStats);

  console.log('✅ Connection load test cleanup completed');
}
