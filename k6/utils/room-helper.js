import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics for room operations
const roomJoinRate = new Rate('room_join_success');
const roomLeaveRate = new Rate('room_leave_success');
const roomCreateRate = new Rate('room_create_success');
const roomJoinTime = new Trend('room_join_time');
const roomLeaveTime = new Trend('room_leave_time');
const roomCreateTime = new Trend('room_create_time');

export class RoomHelper {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  // Join room via HTTP API (this is what your backend expects)
  _joinRoom(token, roomId) {
    const startTime = Date.now();

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    try {
      const response = http.post(
        `${this.baseUrl}/api/rooms/${roomId}/join`,
        {},
        { headers }
      );

      const joinTime = Date.now() - startTime;
      roomJoinTime.add(joinTime);

      const success = check(response, {
        'join room successful': (r) => r.status === 200,
        'response time < 2s': (r) => r.timings && r.timings.duration < 2000,
        'has participant data': (r) => r.json('participant') !== undefined,
        'has collaboration mode': (r) =>
          r.json('collaborationMode') !== undefined,
        'has room settings': (r) => r.json('settings') !== undefined,
      });

      if (success) {
        roomJoinRate.add(1);
        console.log(`✅ Successfully joined room: ${roomId}`);
        return response.json();
      } else {
        roomJoinRate.add(0);
        console.error(
          `❌ Failed to join room: ${roomId}`,
          response.status,
          response.body
        );
        return null;
      }
    } catch (error) {
      roomJoinRate.add(0);
      console.error(`❌ Error joining room: ${error.message}`);
      return null;
    }
  }

  // Create room via HTTP API
  _createRoom(token, settings = {}) {
    const startTime = Date.now();

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const payload = JSON.stringify({ settings });

    try {
      const response = http.post(`${this.baseUrl}/api/rooms`, payload, {
        headers,
      });

      const createTime = Date.now() - startTime;
      roomCreateTime.add(createTime);

      const success = check(response, {
        'create room successful': (r) => r.status === 201,
        'response time < 2s': (r) => r.timings && r.timings.duration < 2000,
        'has room ID': (r) => r.json('roomId') !== undefined,
      });

      if (success) {
        roomCreateRate.add(1);
        const roomId = response.json('roomId');
        console.log(`✅ Successfully created room: ${roomId}`);
        return { roomId };
      } else {
        roomCreateRate.add(0);
        console.error(
          `❌ Failed to create room:`,
          response.status,
          response.body
        );
        return null;
      }
    } catch (error) {
      roomCreateRate.add(0);
      console.error(`❌ Error creating room: ${error.message}`);
      return null;
    }
  }

  // Get room info via HTTP API
  _getRoom(token, roomId) {
    const headers = {
      Authorization: `Bearer ${token}`,
    };

    try {
      const response = http.get(`${this.baseUrl}/api/rooms/${roomId}`, {
        headers,
      });

      const success = check(response, {
        'get room successful': (r) => r.status === 200,
        'response time < 1s': (r) => r.timings && r.timings.duration < 1000,
        'has room data': (r) => r.json('roomId') !== undefined,
      });

      if (success) {
        console.log(`✅ Successfully retrieved room: ${roomId}`);
        return response.json();
      } else {
        console.error(
          `❌ Failed to get room: ${roomId}`,
          response.status,
          response.body
        );
        return null;
      }
    } catch (error) {
      console.error(`❌ Error getting room: ${error.message}`);
      return null;
    }
  }

  // Update room collaboration mode
  _updateCollaborationMode(token, roomId, mode) {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const payload = JSON.stringify({ mode });

    try {
      const response = http.patch(
        `${this.baseUrl}/api/rooms/${roomId}/collaboration`,
        payload,
        { headers }
      );

      const success = check(response, {
        'update collaboration mode successful': (r) => r.status === 200,
        'response time < 1s': (r) => r.timings && r.timings.duration < 1000,
        'has collaboration mode': (r) =>
          r.json('collaborationMode') !== undefined,
      });

      if (success) {
        console.log(`✅ Successfully updated collaboration mode to: ${mode}`);
        return response.json();
      } else {
        console.error(
          `❌ Failed to update collaboration mode:`,
          response.status,
          response.body
        );
        return null;
      }
    } catch (error) {
      console.error(`❌ Error updating collaboration mode: ${error.message}`);
      return null;
    }
  }

  // Update room settings
  _updateRoomSettings(token, roomId, settings) {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const payload = JSON.stringify({ settings });

    try {
      const response = http.patch(
        `${this.baseUrl}/api/rooms/${roomId}/settings`,
        payload,
        { headers }
      );

      const success = check(response, {
        'update room settings successful': (r) => r.status === 200,
        'response time < 1s': (r) => r.timings && r.timings.duration < 1000,
        'has settings': (r) => r.json('settings') !== undefined,
      });

      if (success) {
        console.log(`✅ Successfully updated room settings`);
        return response.json();
      } else {
        console.error(
          `❌ Failed to update room settings:`,
          response.status,
          response.body
        );
        return null;
      }
    } catch (error) {
      console.error(`❌ Error updating room settings: ${error.message}`);
      return null;
    }
  }

  // Get room operation stats
  getRoomStats() {
    return {
      joinSuccessRate: roomJoinRate.value,
      leaveSuccessRate: roomLeaveRate.value,
      createSuccessRate: roomCreateRate.value,
      avgJoinTime: roomJoinTime.value,
      avgLeaveTime: roomLeaveTime.value,
      avgCreateTime: roomCreateTime.value,
    };
  }
}

// Export individual functions for direct import
export function joinRoom(roomId, headers) {
  const roomHelper = new RoomHelper('http://localhost:5001');
  return roomHelper._joinRoom(
    headers.Authorization.replace('Bearer ', ''),
    roomId
  );
}

export function getRoom(roomId, headers) {
  const roomHelper = new RoomHelper('http://localhost:5001');
  return roomHelper._getRoom(
    headers.Authorization.replace('Bearer ', ''),
    roomId
  );
}

export function createRoom(headers, settings = {}) {
  const roomHelper = new RoomHelper('http://localhost:5001');
  return roomHelper._createRoom(
    headers.Authorization.replace('Bearer ', ''),
    settings
  );
}

export function updateCollaborationMode(roomId, headers, mode) {
  const roomHelper = new RoomHelper('http://localhost:5001');
  return roomHelper._updateCollaborationMode(
    headers.Authorization.replace('Bearer ', ''),
    roomId,
    mode
  );
}

export function updateRoomSettings(roomId, headers, settings) {
  const roomHelper = new RoomHelper('http://localhost:5001');
  return roomHelper._updateRoomSettings(
    headers.Authorization.replace('Bearer ', ''),
    roomId,
    settings
  );
}
