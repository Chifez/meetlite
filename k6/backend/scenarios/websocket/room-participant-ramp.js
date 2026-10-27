import { check, sleep } from 'k6';
import ws from 'k6/ws';
import { Rate, Trend, Counter } from 'k6/metrics';
import { ApiClient } from '../../../backend/utils/api-client.js';
import { login } from '../../../backend/utils/auth.js';
import { ENDPOINTS } from '../../../config/endpoints.js';
import { generateRoom } from '../../../backend/utils/data-generators.js';
import { CONFIG } from '../../../config/index.js';

// Custom Metrics for Single-Room Breakpoint Ramp Test
const wsConnectionSuccess = new Rate('room_ramp_ws_connection_success');
const chatBroadcastSuccess = new Rate('room_ramp_chat_broadcast_success');
const wsConnectionTime = new Trend('room_ramp_ws_connection_time');
const chatBroadcastLatency = new Trend('room_ramp_chat_broadcast_latency');
const activeParticipants = new Counter('room_ramp_active_participants');

function parseDurationMs(durationStr, fallbackMs = 30000) {
  if (!durationStr) return fallbackMs;
  const match = String(durationStr).match(/^(\d+)(ms|s|m|h)$/);
  if (!match) return fallbackMs;
  const val = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === 'ms') return val;
  if (unit === 's') return val * 1000;
  if (unit === 'm') return val * 60 * 1000;
  if (unit === 'h') return val * 3600 * 1000;
  return fallbackMs;
}

// Configurable hold period before advancing to the next ramp stage (default: 30s)
const holdPeriod =
  (typeof __ENV !== 'undefined' && (__ENV.HOLD_PERIOD || __ENV.HOLD)) || '30s';
const rampPeriod =
  (typeof __ENV !== 'undefined' && (__ENV.RAMP_PERIOD || __ENV.RAMP)) || '15s';

// Stepped Ramping Stages: gradually increases concurrent users inside the SAME room
// Each tier ramps up to the target and holds for `holdPeriod` to observe steady-state load
export const options = {
  stages: [
    { duration: rampPeriod, target: 10 },
    { duration: holdPeriod, target: 10 },  // Phase 1 hold
    { duration: rampPeriod, target: 25 },
    { duration: holdPeriod, target: 25 },  // Phase 2 hold
    { duration: rampPeriod, target: 50 },
    { duration: holdPeriod, target: 50 },  // Phase 3 hold
    { duration: rampPeriod, target: 100 },
    { duration: holdPeriod, target: 100 }, // Phase 4 hold
    { duration: rampPeriod, target: 150 },
    { duration: holdPeriod, target: 150 }, // Phase 5 hold
    { duration: rampPeriod, target: 200 },
    { duration: holdPeriod, target: 200 }, // Phase 6 hold
    { duration: rampPeriod, target: 0 },   // Graceful cooldown
  ],
  thresholds: {
    room_ramp_ws_connection_success: ['rate>0.90'],
    room_ramp_chat_broadcast_success: ['rate>0.90'],
    room_ramp_ws_connection_time: ['p(95)<2000'],
  },
};

const vuTokens = new Map();

export function setup() {
  const token = login();
  if (!token) throw new Error('Failed to authenticate during setup');

  const client = new ApiClient(token);
  // Create single test room with high capacity ceiling (up to 1,000 users)
  const roomData = generateRoom({
    settings: {
      maxParticipants: 1000,
    },
  });
  const roomRes = client.post(ENDPOINTS.rooms.create(), {
    settings: roomData.settings,
  });

  const body = roomRes.json();
  const roomId = body?.data?.roomId || body?.roomId || 'test-room-ramp';
  console.log(`\n🎯 Single Room Breakpoint Target: ${roomId} (Max: 1000 users)`);
  console.log(`⏱️  Ramp Configuration: Hold=${holdPeriod} per tier | Ramp=${rampPeriod}\n`);
  return { token, roomId, holdPeriod };
}

export default function (data) {
  const { roomId } = data;
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

  // Obtain fresh capability token for this connection
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

  // Sustained connection duration per iteration matches the configured hold period
  const sessionDurationMs = parseDurationMs(data.holdPeriod || holdPeriod, 30000);
  const start = Date.now();

  const res = ws.connect(url, {}, function (socket) {
    let intervalId = null;

    socket.on('open', () => {
      // 1. Join room with capability token
      socket.send(JSON.stringify({ type: 'join', token: capabilityToken }));
    });

    socket.on('message', (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage);

        if (message.type === 'joined') {
          wsConnectionSuccess.add(1);
          wsConnectionTime.add(Date.now() - start);
          activeParticipants.add(1);

          // 2. Periodic in-room activity: send chat message every 3 seconds
          intervalId = socket.setInterval(() => {
            const chatPayload = {
              type: 'chat',
              text: `ping_from_vu_${__VU}_ts_${Date.now()}`,
            };
            socket.send(JSON.stringify(chatPayload));
          }, 3000);
        } else if (message.type === 'chat_message') {
          // Verify broadcast delivery
          chatBroadcastSuccess.add(1);
          if (message.text && message.text.includes(`ping_from_vu_${__VU}_`)) {
            const parts = message.text.split('_ts_');
            if (parts.length === 2) {
              const sentTs = parseInt(parts[1], 10);
              if (!isNaN(sentTs)) {
                chatBroadcastLatency.add(Date.now() - sentTs);
              }
            }
          }
        } else if (message.type === 'error') {
          wsConnectionSuccess.add(0);
          socket.close();
        }
      } catch (err) {
        // ignore parse errors
      }
    });

    socket.on('error', () => {
      wsConnectionSuccess.add(0);
    });

    socket.on('close', () => {
      activeParticipants.add(-1);
    });

    // Stay in room for the session duration, then leave cleanly
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
