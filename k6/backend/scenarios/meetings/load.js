/**
 * Meeting Operations Load Test
 * Tests meeting CRUD operations and lifecycle under normal load
 *
 * Demonstrates:
 * - Complete meeting lifecycle (create → start → complete)
 * - Meeting with calendar integration
 * - Meeting validation
 */

import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { createTestOptions } from '../../../shared/test-executors.js';
import { ApiClient } from '../../../backend/utils/api-client.js';
import { login } from '../../../backend/utils/auth.js';
import { ENDPOINTS } from '../../../config/endpoints.js';
import { generateMeeting } from '../../../backend/utils/data-generators.js';

// Custom metrics
const meetingSuccess = new Rate('meeting_operation_success');
const meetingTime = new Trend('meeting_operation_time');
const meetingLifecycleSuccess = new Rate('meeting_lifecycle_success');

export const options = createTestOptions('load', {
  thresholds: {
    meeting_operation_success: ['rate>0.95'],
    meeting_lifecycle_success: ['rate>0.90'],
    meeting_operation_time: ['p(95)<1000'],
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

  // Generate meeting data
  const meetingData = generateMeeting({
    title: `Load Test Meeting ${Date.now()}`,
    description: 'Performance test meeting',
    privacy: 'public',
  });

  // Test 1: Create Meeting
  const createStart = Date.now();
  const createRes = client.post(ENDPOINTS.meetings.create(), meetingData);
  const createTime = Date.now() - createStart;

  const createOk = check(createRes, {
    'meeting created': (r) => r.status === 201,
    'meeting has ID': (r) => {
      const body = r.json();
      return body && body.meetingId !== undefined;
    },
    'create time < 1s': () => createTime < 1000,
  });

  meetingSuccess.add(createOk ? 1 : 0);
  meetingTime.add(createTime);

  if (!createOk) {
    return; // Exit early if creation failed
  }

  const meetingId = createRes.json().meetingId;

  // Test 2: Get Meeting Details
  const getRes = client.get(ENDPOINTS.meetings.get(meetingId));

  const getOk = check(getRes, {
    'meeting retrieved': (r) => r.status === 200,
    'meeting data valid': (r) => {
      const body = r.json();
      return body && body.title !== undefined;
    },
  });

  meetingSuccess.add(getOk ? 1 : 0);

  // Test 3: Update Meeting
  const updateRes = client.put(ENDPOINTS.meetings.update(meetingId), {
    description: 'Updated description',
  });

  const updateOk = check(updateRes, {
    'meeting updated': (r) => r.status === 200,
  });

  meetingSuccess.add(updateOk ? 1 : 0);

  // Test 4: Start Meeting (creates room)
  const startRes = client.post(ENDPOINTS.meetings.start(meetingId), {});

  const startOk = check(startRes, {
    'meeting started': (r) => r.status === 200 || r.status === 201,
    'room created': (r) => {
      const body = r.json();
      return body && body.roomId !== undefined;
    },
  });

  meetingLifecycleSuccess.add(startOk ? 1 : 0);

  // Test 5: Complete Meeting
  if (startOk) {
    const completeRes = client.post(ENDPOINTS.meetings.complete(meetingId), {});

    const completeOk = check(completeRes, {
      'meeting completed': (r) => r.status === 200,
    });

    meetingLifecycleSuccess.add(completeOk ? 1 : 0);
  }

  // Test 6: List Meetings
  const listRes = client.get(ENDPOINTS.meetings.list());

  const listOk = check(listRes, {
    'meetings listed': (r) => r.status === 200,
    'list has data': (r) => {
      const body = r.json();
      return Array.isArray(body);
    },
  });

  meetingSuccess.add(listOk ? 1 : 0);
}
