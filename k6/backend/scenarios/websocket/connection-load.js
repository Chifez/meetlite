/**
 * WebSocket Connection Load Test
 * Tests WebSocket connections and real-time messaging under load
 *
 * Demonstrates:
 * - WebSocket connection establishment
 * - Room joining via WebSocket
 * - Real-time message sending
 * - Connection stability
 */

import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { createTestOptions } from '../../../shared/test-executors.js';
import { ApiClient } from '../../../backend/utils/api-client.js';
import { WebSocketClient } from '../../../backend/utils/websocket-client.js';
import { login } from '../../../backend/utils/auth.js';
import { ENDPOINTS } from '../../../config/endpoints.js';
import { generateRoom } from '../../../backend/utils/data-generators.js';
import { CONFIG } from '../../../config/index.js';

// Custom metrics
const wsConnectionSuccess = new Rate('ws_connection_success');
const wsRoomJoinSuccess = new Rate('ws_room_join_success');
const wsMessageSuccess = new Rate('ws_message_success');
const wsConnectionTime = new Trend('ws_connection_time');

export const options = createTestOptions('load', {
  thresholds: {
    ws_connection_success: ['rate>0.95'],
    ws_room_join_success: ['rate>0.95'],
    ws_message_success: ['rate>0.95'],
    ws_connection_time: ['p(95)<1000'],
  },
});

export function setup() {
  const token = login();
  if (!token) {
    throw new Error('Failed to authenticate during setup');
  }

  // Create a test room for WebSocket testing
  const client = new ApiClient(token);
  const roomData = generateRoom();
  const roomRes = client.post(ENDPOINTS.rooms.create(), {
    settings: roomData.settings,
  });

  let roomId = null;
  if (roomRes.status === 201) {
    roomId = roomRes.json().roomId;
  }

  return { token, roomId };
}

export default function (data) {
  const { token, roomId } = data;

  if (!roomId) {
    wsConnectionSuccess.add(0);
    return;
  }

  // Test 1: Connect to WebSocket
  const connectStart = Date.now();
  const wsClient = new WebSocketClient(CONFIG.services.mediasoup, token);
  const connected = wsClient.connect();
  const connectTime = Date.now() - connectStart;

  const connectOk = check(
    { connected },
    {
      'websocket connected': (r) => r.connected === true,
      'connection time < 1s': () => connectTime < 1000,
    }
  );

  wsConnectionSuccess.add(connectOk ? 1 : 0);
  wsConnectionTime.add(connectTime);

  if (!connectOk) {
    return; // Exit if connection failed
  }

  // Test 2: Join Room via WebSocket
  const joinOk = wsClient.joinRoom(roomId);

  const joinCheck = check(
    { joined: joinOk },
    {
      'room joined via websocket': (r) => r.joined === true,
    }
  );

  wsRoomJoinSuccess.add(joinCheck ? 1 : 0);

  if (!joinCheck) {
    wsClient.disconnect();
    return;
  }

  // Test 3: Send Chat Message
  const messageOk = wsClient.sendChatMessage(
    roomId,
    `Load test message ${Date.now()}`
  );

  const messageCheck = check(
    { sent: messageOk },
    {
      'message sent via websocket': (r) => r.sent === true,
    }
  );

  wsMessageSuccess.add(messageCheck ? 1 : 0);

  // Test 4: Send Collaboration Event
  const collabOk = wsClient.sendMessage('collaboration:update', {
    roomId,
    tool: 'whiteboard',
    action: 'draw',
    data: {
      x: Math.random() * 100,
      y: Math.random() * 100,
    },
  });

  wsMessageSuccess.add(collabOk ? 1 : 0);

  // Test 5: Leave Room
  wsClient.leaveRoom(roomId);

  // Cleanup: Disconnect
  wsClient.disconnect();
}
