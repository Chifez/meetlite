import { check, sleep } from 'k6';
import ws from 'k6/ws';
import { Rate, Trend, Counter } from 'k6/metrics';
import { ApiClient } from '../../../backend/utils/api-client.js';
import { login } from '../../../backend/utils/auth.js';
import { ENDPOINTS } from '../../../config/endpoints.js';
import { generateRoom } from '../../../backend/utils/data-generators.js';
import { CONFIG } from '../../../config/index.js';

// Custom Metrics for Multi-Room Horizontal Scaling Test
const wsConnectionSuccess = new Rate('multi_room_ws_connection_success');
const chatBroadcastSuccess = new Rate('multi_room_chat_broadcast_success');
const wsConnectionTime = new Trend('multi_room_ws_connection_time');
const activeRoomsGauge = new Counter('multi_room_active_rooms');

// Fixed number of participants per room (e.g. 2 participants for 1-on-1 meetings)
const USERS_PER_ROOM = 2;

// Stepped Ramping Stages: ramps up the number of CONCURRENT ROOMS
// 10 VUs = 5 rooms | 20 VUs = 10 rooms | 50 VUs = 25 rooms | 100 VUs = 50 rooms
export const options = {
  stages: [
    { duration: '15s', target: 10 },  // 5 active rooms
    { duration: '20s', target: 10 },
    { duration: '15s', target: 20 },  // 10 active rooms
    { duration: '20s', target: 20 },
    { duration: '15s', target: 50 },  // 25 active rooms
    { duration: '20s', target: 50 },
    { duration: '15s', target: 100 }, // 50 active rooms (breakpoint target)
    { duration: '20s', target: 100 },
    { duration: '15s', target: 0 },   // Graceful ramp down
  ],
  thresholds: {
    multi_room_ws_connection_success: ['rate>0.95'],
    multi_room_chat_broadcast_success: ['rate>0.95'],
    multi_room_ws_connection_time: ['p(95)<1500'],
  },
};

const vuTokens = new Map();

export function setup() {
  const token = login();
  if (!token) throw new Error('Failed to authenticate during setup');

  const client = new ApiClient(token);
  const totalRoomsToCreate = 50; // Pre-provision 50 distinct isolated rooms
  const rooms = [];

  console.log(`\n🏢 Pre-provisioning ${totalRoomsToCreate} distinct rooms for Multi-Room Scalability Test...`);
  for (let i = 1; i <= totalRoomsToCreate; i++) {
    const roomData = generateRoom({
      name: `Multi-Room Load Test ${i}`,
      settings: { maxParticipants: 10 },
    });
    const res = client.post(ENDPOINTS.rooms.create(), {
      settings: roomData.settings,
    });
    if (res.status === 201) {
      const body = res.json();
      const roomId = body?.data?.roomId || body?.roomId;
      rooms.push(roomId);
    }
  }

  console.log(`✅ Successfully initialized ${rooms.length} distinct rooms across the cluster.\n`);
  return { token, rooms };
}

export default function (data) {
  const { rooms } = data;
  if (!rooms || rooms.length === 0) {
    wsConnectionSuccess.add(0);
    return;
  }

  // Calculate which room this VU belongs to
  // With USERS_PER_ROOM = 2:
  // VU 1 & 2 -> Room 0 | VU 3 & 4 -> Room 1 | VU 5 & 6 -> Room 2, etc.
  const roomIndex = Math.floor((__VU - 1) / USERS_PER_ROOM) % rooms.length;
  const roomId = rooms[roomIndex];

  const participantNumber = ((__VU - 1) % CONFIG.testUsers.poolSize) + 1;
  const email = `${CONFIG.testUsers.prefix}-${participantNumber}@meetlite.test`;
  const password = `TestPassword${participantNumber}!`;

  // Authenticate once per VU
  let participantToken = vuTokens.get(__VU);
  if (!participantToken) {
    participantToken = login(email, password);
    if (!participantToken) {
      wsConnectionSuccess.add(0);
      return;
    }
    vuTokens.set(__VU, participantToken);
  }

  // Mint fresh capability token for this specific room
  const client = new ApiClient(participantToken);
  const joinResponse = client.post(
    `${ENDPOINTS.rooms.join(roomId)}?includeCapability=true`
  );
  if (joinResponse.status !== 200) {
    wsConnectionSuccess.add(0);
    return;
  }
  const joinBody = joinResponse.json();
  const capabilityToken =
    joinBody?.data?.capabilityToken || joinBody?.capabilityToken;
  if (!capabilityToken) {
    wsConnectionSuccess.add(0);
    return;
  }

  const baseUrl = CONFIG.services.edgeCoordinator.replace(/\/$/, '');
  const url = `${baseUrl}/rooms/${encodeURIComponent(roomId)}/websocket`;

  // Sustained connection duration per iteration (15 seconds)
  const sessionDurationMs = 15000;
  const start = Date.now();

  const res = ws.connect(url, {}, function (socket) {
    let intervalId = null;

    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'join', token: capabilityToken }));
    });

    socket.on('message', (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage);

        if (message.type === 'joined') {
          wsConnectionSuccess.add(1);
          wsConnectionTime.add(Date.now() - start);

          // Track active room concurrency (only first user in room increments gauge)
          if ((__VU - 1) % USERS_PER_ROOM === 0) {
            activeRoomsGauge.add(1);
          }

          // In-room activity: send periodic message every 3s
          intervalId = socket.setInterval(() => {
            socket.send(
              JSON.stringify({
                type: 'chat',
                text: `msg_from_vu_${__VU}_room_${roomIndex}_ts_${Date.now()}`,
              })
            );
          }, 3000);
        } else if (message.type === 'chat_message') {
          chatBroadcastSuccess.add(1);
        } else if (message.type === 'error') {
          wsConnectionSuccess.add(0);
          socket.close();
        }
      } catch (err) {
        // ignore parse error
      }
    });

    socket.on('error', () => {
      wsConnectionSuccess.add(0);
    });

    socket.on('close', () => {
      if ((__VU - 1) % USERS_PER_ROOM === 0) {
        activeRoomsGauge.add(-1);
      }
    });

    socket.setTimeout(() => {
      if (intervalId) socket.clearInterval(intervalId);
      socket.send(JSON.stringify({ type: 'leave' }));
      socket.close();
    }, sessionDurationMs);
  });

  check(res, {
    'protocol switching 101': (r) => r && r.status === 101,
  });

  sleep(1);
}
