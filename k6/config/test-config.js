// K6 Performance Testing Configuration
// Centralized configuration for all test scenarios

export const TEST_CONFIG = {
  // Test durations (in seconds)
  durations: {
    rampUp: '2m', // Ramp up to target
    steady: '5m', // Hold at target
    rampDown: '1m', // Ramp down to 0
  },

  // Target user counts for different test types
  targets: {
    roomCapacity: 5, // Test room capacity limits (increased from 1 to 5 users)
    roomOperation: 25, // Test room operations under load
    connectionLoad: 100, // Test connection handling
    stressTest: 200, // Stress test breaking points
  },

  // Base URLs for different services
  baseUrls: {
    auth: 'http://localhost:5000', // Fixed: auth service runs on 5000
    room: 'http://localhost:5001', // Fixed: room service runs on 5001
    mediasoup: 'http://localhost:3003', // MediaSoup service runs on 3003
  },

  // API endpoints
  endpoints: {
    auth: {
      login: '/api/auth/login',
      signup: '/api/auth/signup',
      refresh: '/api/auth/refresh',
      validate: '/api/auth/validate',
    },
    room: {
      create: '/api/rooms',
      join: '/api/rooms/:roomId/join',
      get: '/api/rooms/:roomId',
      collaboration: '/api/rooms/:roomId/collaboration',
      settings: '/api/rooms/:roomId/settings',
    },
    mediasoup: {
      ws: 'ws://localhost:3003', // MediaSoup service runs on 3003
    },
  },

  // User activity simulation settings
  userActivity: {
    minRoomDuration: 30, // Minimum time in room (seconds)
    maxRoomDuration: 300, // Maximum time in room (seconds)
    messageProbability: 0.3, // Probability of sending message
    mediaChangeProbability: 0.2, // Probability of media state change
    collaborationProbability: 0.1, // Probability of collaboration event
    activityInterval: 5, // Seconds between activity checks
    keepAliveInterval: 5, // Seconds between keep-alive activities
  },

  // Performance thresholds
  thresholds: {
    http: {
      successRate: 0.95, // 95% success rate
      responseTime: 2000, // 2 seconds max
      errorRate: 0.05, // 5% error rate max
    },
    websocket: {
      connectionRate: 0.95, // 95% connection success
      messageRate: 0.95, // 95% message success
      responseTime: 1000, // 1 second max
    },
    room: {
      joinRate: 0.95, // 95% join success
      operationRate: 0.95, // 95% operation success
      capacityLimit: 5, // Expected room capacity (increased from 1 to 5 users)
    },
  },
};

// Helper function to get test durations
export function getTestDurations(testType) {
  return TEST_CONFIG.durations;
}

// Helper function to get test targets
export function getTestTargets(testType) {
  return TEST_CONFIG.targets;
}

// Helper function to get user limits
export function getUserLimits() {
  return {
    MAX_USERS: 1000,
    ROOM_CAPACITY: 15,
    STRESS_TEST_USERS: 200,
  };
}
