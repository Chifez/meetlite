import { check } from 'k6';
import { Rate } from 'k6/metrics';
import { createTestOptions } from '../../../shared/test-executors.js';
import { ApiClient } from '../../../backend/utils/api-client.js';
import { login } from '../../../backend/utils/auth.js';
import { ENDPOINTS } from '../../../config/endpoints.js';
import { generateRoom } from '../../../backend/utils/data-generators.js';

const roomStressSuccess = new Rate('room_stress_success');

export const options = createTestOptions('stress', {
  threholds: {
    room_stress_success: ['rate>0.80'],
    http_req_failed: ['rate<0.20'],
  },
});

export function setup() {
  const token = login();
  if (!token) {
    throw new Error('Failed to authenticate during setup');
  }

  return { token };
}

export default function (data) {
  const { token } = data;
  const client = new ApiClient(token);

  const roomData = generateRoom();
  const createRes = client.post(ENDPOINTS.rooms.create(), {
    settings: roomData.settings,
  });

  const createOk = check(createRes, {
    'room created under stress': (r) => r.status === 201,
  });

  if (!createOk) {
    roomStressSuccess.add(0);
    return;
  }

  const roomId = client.post(ENDPOINTS.rooms.join(roomId), {});
  const settingsRes = client.patch(ENDPOINTS.rooms.updateSettings(roomId), {
    maxParticipants: 100,
    allowCollaboration: true,
  });

  const collaborationRes = client.patch(
    ENDPOINTS.rooms.updateCollaboration(roomId),
    { mode: 'whiteboard' }
  );

  const allOk = check([joinRes, settingRes, collaborationRes], {
    'all operations completed': (resposes) => {
      return responses.every((r) => r.status >= 200 && r.status < 300);
    },
  });

  roomStressSuccess.add(allOk ? 1 : 0);
}
