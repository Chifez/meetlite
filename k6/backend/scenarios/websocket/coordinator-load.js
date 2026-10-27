import { check, sleep } from 'k6';
import ws from 'k6/ws';
import { Rate, Trend } from 'k6/metrics';
import { createTestOptions } from '../../../shared/test-executors.js';
import { ApiClient } from '../../../backend/utils/api-client.js';
import { login } from '../../../backend/utils/auth.js';
import { ENDPOINTS } from '../../../config/endpoints.js';
import { generateRoom } from '../../../backend/utils/data-generators.js';
import { CONFIG } from '../../../config/index.js';

const coordWsSuccess = new Rate('coord_ws_connection_success');
const coordWsTime = new Trend('coord_ws_connection_time');
const vuTokens = new Map();

export const options = createTestOptions('load', {
  thresholds: {
    coord_ws_connection_success: ['rate>0.95'],
    coord_ws_connection_time: ['p(95)<1000'],
  },
});

export function setup() {
  const token = login();
  if (!token) throw new Error('Failed to authenticate during setup');

  const client = new ApiClient(token);
  const roomData = generateRoom({
    settings: {
      maxParticipants: 200,
    },
  });
  const roomRes = client.post(ENDPOINTS.rooms.create(), {
    settings: roomData.settings,
  });

  const body = roomRes.json();
  const roomId = body?.data?.roomId || body?.roomId || 'test-room-k6';
  return { token, roomId };
}

export default function (data) {
  const { roomId } = data;
  const participantNumber = ((__VU - 1) % CONFIG.testUsers.poolSize) + 1;
  const email = `${CONFIG.testUsers.prefix}-${participantNumber}@meetlite.test`;
  const password = `TestPassword${participantNumber}!`;

  let participantToken = vuTokens.get(__VU);
  if (!participantToken) {
    participantToken = login(email, password);
    if (!participantToken) {
      coordWsSuccess.add(0);
      return;
    }
    vuTokens.set(__VU, participantToken);
  }

  const client = new ApiClient(participantToken);
  const joinResponse = client.post(
    `${ENDPOINTS.rooms.join(roomId)}?includeCapability=true`
  );
  if (joinResponse.status !== 200) {
    coordWsSuccess.add(0);
    return;
  }
  const joinBody = joinResponse.json();
  const capabilityToken =
    joinBody?.data?.capabilityToken || joinBody?.capabilityToken;
  if (!capabilityToken) {
    coordWsSuccess.add(0);
    return;
  }

  const baseUrl = CONFIG.services.edgeCoordinator.replace(/\/$/, '');
  const url = `${baseUrl}/rooms/${encodeURIComponent(roomId)}/websocket`;

  const start = Date.now();
  const res = ws.connect(url, {}, function (socket) {
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'join', token: capabilityToken }));
    });

    socket.on('message', (rawMessage) => {
      const message = JSON.parse(rawMessage);
      if (message.type === 'joined') {
        coordWsSuccess.add(1);
        coordWsTime.add(Date.now() - start);
        socket.send(JSON.stringify({ type: 'leave' }));
        socket.close();
      } else if (message.type === 'error') {
        coordWsSuccess.add(0);
        socket.close();
      }
    });

    socket.on('error', () => {
      coordWsSuccess.add(0);
    });

    socket.setTimeout(() => {
      coordWsSuccess.add(0);
      socket.close();
    }, 5000);
  });

  check(res, {
    'protocol switching 101': (r) => r && r.status === 101,
  });

  sleep(0.5);
}
