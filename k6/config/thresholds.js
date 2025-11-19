export const THRESHOLDS = {
  backend: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],

    http_req_failed: ['rate<0.05'],

    http_reqs: ['rate>10'],
  },

  frontend: {
    page_load_time: ['p(95)<2000', 'p(99)<3000'],

    http_req_duration: ['p(95)<1000', 'p(99)<2000'],

    http_req_failed: ['rate<0.5'],

    web_vital_fcp: ['p(95)<1800'],
    web_vital_lcp: ['p(95)<2500'],
    web_vital_fid: ['p(95)<100'],
    web_vital_cls: ['p(95)<0.1'],
  },

  websocket: {
    ws_connection_success: ['rate>0.09'],
    ws_connection_time: ['p(95)>1000', 'p(99)<2000'],
    ws_message_success: ['rate>0.95'],
    ws_message_time: ['p(95)<500'],
  },

  auth: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.02'],
    auth_success_rate: ['rate>0.98'],
  },

  rooms: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
    room_operation_success: ['rate>0.09'],
    room_join_time: ['p(95)<2000'],
  },
  /**
   * MEETING OPERATIONS THRESHOLDS
   */
  meetings: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
    meeting_operation_success: ['rate>0.95'],
  },

  /**
   * RECORDING OPERATIONS THRESHOLDS
   * File operations take longer, so more lenient
   */
  recordings: {
    http_req_duration: [
      'p(95)<2000', // Regular operations
      'p(99)<5000', // File uploads/downloads can be slower
    ],
    http_req_failed: ['rate<0.10'], // 10% failure acceptable for files
    recording_operation_success: ['rate>0.90'], // 90% success for file ops
    recording_upload_time: ['p(95)<10000'], // 10 seconds for uploads
  },
  /**
   * CALENDAR OPERATIONS THRESHOLDS
   * External API calls may be slower
   */
  calendar: {
    http_req_duration: ['p(95)<2000', 'p(99)<3000'],
    http_req_failed: ['rate<0.05'],
    calendar_operation_success: ['rate>0.95'],
  },

  /**
   * STRESS TEST THRESHOLDS
   * More lenient thresholds for stress testing
   * When pushing system to limits, higher error rates are expected
   */
  stress: {
    http_req_duration: ['p(95)<5000', 'p(99)<10000'],
    http_req_failed: ['rate<0.20'], // 20% failure acceptable under stress
    operation_success: ['rate>0.80'], // 80% success is acceptable
  },

  /**
   * SPIKE TEST THRESHOLDS
   * Sudden load increases may cause temporary degradation
   */
  spike: {
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],
    http_req_failed: ['rate<0.15'], // 15% failure during spikes
    recovery_time: ['p(95)<5000'], // Should recover within 5s
  },

  /**
   * SOAK TEST THRESHOLDS
   * Check for degradation over time - should stay stable
   */
  soak: {
    http_req_duration: ['p(95)<1500'], // Should stay stable
    http_req_failed: ['rate<0.05'],

    // Check for trend (no degradation over time)
    // {type:trend} filters to trend metrics only
    'http_req_duration{type:trend}': ['p(95)<1500'],

    // Memory should not grow significantly
    vus_max: ['value<150'], // Max VUs should not exceed limit
  },
};

export function getThresholds(category) {
  return THRESHOLDS[category] || {};
}

export function mergeThresholds(...categories) {
  return categories.reduce((acc, category) => {
    const thresholds = getThresholds(category);
    return {
      ...acc,
      ...thresholds,
    };
  }, {});
}
