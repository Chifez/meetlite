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
const roomOperationRate = new Rate('room_operation_success');
const collaborationRate = new Rate('collaboration_operation_success');
const wsEventRate = new Rate('websocket_event_success');
const operationTime = new Trend('operation_time');

// Initialize helpers
const roomHelper = new RoomHelper(TEST_CONFIG.baseUrls.room);
const wsHelper = new WebSocketHelper(TEST_CONFIG.baseUrls.signaling);

export const options = {
  stages: [
    { duration: durations.rampUp, target: targets.roomOperation },
    { duration: durations.steady, target: targets.roomOperation },
    { duration: durations.rampDown, target: 0 },
  ],
  thresholds: {
    room_operation_success: ['rate>0.95'],
    collaboration_operation_success: ['rate>0.95'],
    websocket_event_success: ['rate>0.95'],
    operation_time: ['p(95)<2000'],
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

export function setup() {
  console.log(
    '🚀 Setting up room operation test with single user authentication...'
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

  // STEP 1: Connect to WebSocket for real-time events
  const wsConnected = wsHelper.connectWebSocket(token);
  if (!wsConnected) {
    console.error('❌ Failed to connect WebSocket');
    return;
  }

  // STEP 2: Join room via HTTP API
  const startTime = Date.now();
  const joinResult = roomHelper._joinRoom(token, testRoom.roomId);

  if (joinResult) {
    roomOperationRate.add(1);
    console.log('✅ Successfully joined room via HTTP API');

    // STEP 3: Join Socket.IO room for real-time events
    const wsJoinSuccess = wsHelper.joinRoom(token, testRoom.roomId);
    if (wsJoinSuccess) {
      wsEventRate.add(1);
      console.log('✅ Successfully joined Socket.IO room');

      // STEP 4: Test room collaboration operations via HTTP API
      const collaborationModes = ['whiteboard', 'document', 'presentation'];
      const randomMode =
        collaborationModes[
          Math.floor(Math.random() * collaborationModes.length)
        ];

      const collabStartTime = Date.now();
      const collabResult = roomHelper._updateCollaborationMode(
        token,
        testRoom.roomId,
        randomMode
      );
      const collabTime = Date.now() - collabStartTime;

      if (collabResult) {
        collaborationRate.add(1);
        console.log(
          `✅ Successfully updated collaboration mode to: ${randomMode}`
        );
      } else {
        collaborationRate.add(0);
        console.error('❌ Failed to update collaboration mode');
      }

      // STEP 5: Test room settings update via HTTP API
      const newSettings = {
        allowCollaboration: Math.random() > 0.5,
        maxParticipants: Math.floor(Math.random() * 50) + 10,
      };

      const settingsResult = roomHelper._updateRoomSettings(
        token,
        testRoom.roomId,
        newSettings
      );

      if (settingsResult) {
        roomOperationRate.add(1);
        console.log('✅ Successfully updated room settings');
      } else {
        roomOperationRate.add(0);
        console.error('❌ Failed to update room settings');
      }

      // STEP 6: Send real-time collaboration events via WebSocket
      const collaborationData = {
        tool: randomMode,
        action: 'update',
        timestamp: new Date().toISOString(),
        data: {
          x: Math.random() * 100,
          y: Math.random() * 100,
          value: `VU ${__VU} update`,
        },
      };

      const collabEventSuccess = wsHelper.sendMessage(
        token,
        testRoom.roomId,
        'collaboration:update',
        collaborationData
      );

      if (collabEventSuccess) {
        wsEventRate.add(1);
        console.log('✅ Successfully sent collaboration event via WebSocket');
      } else {
        wsEventRate.add(0);
        console.error('❌ Failed to send collaboration event');
      }

      // STEP 7: Send chat message via WebSocket
      const chatMessage = `Operation test message from VU ${__VU} at ${new Date().toISOString()}`;
      const chatSuccess = wsHelper.sendChatMessage(
        token,
        testRoom.roomId,
        chatMessage
      );

      if (chatSuccess) {
        wsEventRate.add(1);
        console.log('✅ Successfully sent chat message via WebSocket');
      } else {
        wsEventRate.add(0);
        console.error('❌ Failed to send chat message');
      }

      // STEP 8: Leave Socket.IO room
      const wsLeaveSuccess = wsHelper.leaveRoom(token, testRoom.roomId);
      if (wsLeaveSuccess) {
        wsEventRate.add(1);
        console.log('✅ Successfully left Socket.IO room');
      } else {
        wsEventRate.add(0);
        console.error('❌ Failed to leave Socket.IO room');
      }

      // Record total operation time
      const totalTime = Date.now() - startTime;
      operationTime.add(totalTime);
    } else {
      wsEventRate.add(0);
      console.error('❌ Failed to join Socket.IO room');
    }
  } else {
    roomOperationRate.add(0);
    console.error('❌ Failed to join room via HTTP API');
  }

  // STEP 9: Disconnect WebSocket
  wsHelper.disconnectWebSocket(token);
}

export function teardown(data) {
  console.log('🧹 Cleaning up room operation test...');

  // Get final statistics
  const roomStats = roomHelper.getRoomStats();
  const wsStats = wsHelper.getConnectionStats();

  console.log('📊 Room Operations Stats:', roomStats);
  console.log('📊 WebSocket Stats:', wsStats);

  console.log('✅ Room operation test cleanup completed');
}
