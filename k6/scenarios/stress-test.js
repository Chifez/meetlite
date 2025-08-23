import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { TEST_CONFIG } from '../config/test-config.js';
import { loginAndGetToken } from '../utils/auth-helper.js';
import { RoomHelper } from '../utils/room-helper.js';
import { WebSocketHelper } from '../utils/websocket-helper.js';
import { dataGenerator } from '../utils/data-generator.js';

// Test configuration
const { durations, targets } = TEST_CONFIG;

// Custom metrics for stress testing
const stressOperationRate = new Rate('stress_operation_success');
const wsStressRate = new Rate('websocket_stress_success');
const operationTime = new Trend('stress_operation_time');
const recoveryRate = new Rate('recovery_success');

// Initialize helpers
const roomHelper = new RoomHelper(TEST_CONFIG.baseUrls.room);
const wsHelper = new WebSocketHelper(TEST_CONFIG.baseUrls.signaling);

export const options = {
  stages: [
    { duration: durations.rampUp, target: targets.stressTest },
    { duration: durations.steady, target: targets.stressTest },
    { duration: durations.rampDown, target: 0 },
  ],
  thresholds: {
    stress_operation_success: ['rate>0.90'], // Lower threshold for stress test
    websocket_stress_success: ['rate>0.90'],
    recovery_success: ['rate>0.95'],
    stress_operation_time: ['p(95)<5000'], // Higher latency expected under stress
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.10'], // Higher failure rate expected under stress
  },
};

export function setup() {
  console.log('🚀 Setting up stress test with single user authentication...');

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

  // STEP 1: Connect to WebSocket under stress conditions
  const wsConnected = wsHelper.connectWebSocket(token);
  if (!wsConnected) {
    console.error('❌ Failed to connect WebSocket under stress');
    return;
  }

  // STEP 2: Join room via HTTP API (stress test)
  const startTime = Date.now();
  const joinResult = roomHelper.joinRoom(token, testRoom.roomId);

  if (joinResult) {
    stressOperationRate.add(1);
    console.log('✅ Successfully joined room via HTTP API under stress');

    // STEP 3: Join Socket.IO room for real-time events
    const wsJoinSuccess = wsHelper.joinRoom(token, testRoom.roomId);
    if (wsJoinSuccess) {
      wsStressRate.add(1);
      console.log('✅ Successfully joined Socket.IO room under stress');

      // STEP 4: Stress test with rapid operations
      const operations = [
        // Rapid collaboration mode changes
        () =>
          roomHelper.updateCollaborationMode(
            token,
            testRoom.roomId,
            'whiteboard'
          ),
        () =>
          roomHelper.updateCollaborationMode(
            token,
            testRoom.roomId,
            'document'
          ),
        () =>
          roomHelper.updateCollaborationMode(
            token,
            testRoom.roomId,
            'presentation'
          ),

        // Rapid settings updates
        () =>
          roomHelper.updateRoomSettings(token, testRoom.roomId, {
            allowCollaboration: true,
          }),
        () =>
          roomHelper.updateRoomSettings(token, testRoom.roomId, {
            maxParticipants: 25,
          }),
        () =>
          roomHelper.updateRoomSettings(token, testRoom.roomId, {
            allowCollaboration: false,
          }),

        // Rapid WebSocket events
        () =>
          wsHelper.sendChatMessage(
            token,
            testRoom.roomId,
            `Stress message ${Date.now()}`
          ),
        () =>
          wsHelper.sendMessage(token, testRoom.roomId, 'collaboration:update', {
            tool: 'whiteboard',
            action: 'stress',
          }),
        () =>
          wsHelper.sendMessage(token, testRoom.roomId, 'media:update', {
            audio: true,
            video: false,
          }),
      ];

      // Execute operations rapidly to create stress
      for (let i = 0; i < operations.length; i++) {
        try {
          const operation = operations[i];
          const result = operation();

          if (result) {
            wsStressRate.add(1);
          } else {
            wsStressRate.add(0);
          }
        } catch (error) {
          wsStressRate.add(0);
          console.error(`❌ Stress operation ${i} failed:`, error.message);
        }
      }

      // STEP 5: Test recovery after stress
      const recoveryStart = Date.now();

      // Try to get room info (should still work)
      const roomInfo = roomHelper.getRoom(token, testRoom.roomId);
      if (roomInfo) {
        recoveryRate.add(1);
        console.log('✅ Recovery successful - room info retrieved');
      } else {
        recoveryRate.add(0);
        console.error('❌ Recovery failed - room info not accessible');
      }

      // Try to send a final message
      const finalMessage = wsHelper.sendChatMessage(
        token,
        testRoom.roomId,
        'Recovery test message'
      );
      if (finalMessage) {
        recoveryRate.add(1);
        console.log('✅ Recovery successful - final message sent');
      } else {
        recoveryRate.add(0);
        console.error('❌ Recovery failed - final message not sent');
      }

      // STEP 6: Leave Socket.IO room
      const wsLeaveSuccess = wsHelper.leaveRoom(token, testRoom.roomId);
      if (wsLeaveSuccess) {
        wsStressRate.add(1);
        console.log('✅ Successfully left Socket.IO room after stress test');
      } else {
        wsStressRate.add(0);
        console.error('❌ Failed to leave Socket.IO room after stress test');
      }

      // Record total operation time
      const totalTime = Date.now() - startTime;
      operationTime.add(totalTime);
    } else {
      wsStressRate.add(0);
      console.error('❌ Failed to join Socket.IO room under stress');
    }
  } else {
    stressOperationRate.add(0);
    console.error('❌ Failed to join room via HTTP API under stress');
  }

  // STEP 7: Disconnect WebSocket
  wsHelper.disconnectWebSocket(token);
}

export function teardown(data) {
  console.log('🧹 Cleaning up stress test...');

  // Get final statistics
  const roomStats = roomHelper.getRoomStats();
  const wsStats = wsHelper.getConnectionStats();

  console.log('📊 Stress Test Stats:');
  console.log('📊 Room Operations Stats:', roomStats);
  console.log('📊 WebSocket Stats:', wsStats);

  console.log('✅ Stress test cleanup completed');
}
