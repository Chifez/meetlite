export const TEST_TYPES = {
  load: {
    name: 'load',
    description: 'Normal expected load testing',

    stages: [
      { duration: '2m', target: 50 },
      { duration: '5m', target: 50 },
      { duration: '2m', target: 0 },
    ],

    threshold: {
      http_req_duration: ['p(95)<1000', 'p(99)<2000'],

      http_req_failed: ['rate<0.05'],
    },
  },

  stress: {
    name: 'stress',
    description: 'Stress testing to find breaking points',

    stages: [
      { duration: '2m', target: 50 },
      { duration: '5m', target: 200 },
      { duration: '5m', target: 500 },
      { duration: '5m', target: 1000 },
      { duration: '5m', target: 500 },
      { duration: '5m', target: 200 },
      { duration: '2m', target: 0 },
    ],

    thresholdes: {
      http_requ_duration: ['p(95)<5000', 'p(99)<10000'],
      http_req_failed: ['rate<0.20'],
    },
  },

  spike: {
    name: 'spike',
    description: 'Spike testing for sudden traffic increases',

    stages: [
      { duration: '1m', target: 50 },
      { duration: '30s', target: 500 },
      { duration: '1m', target: 500 },
      { duration: '30s', target: 50 },
      { duration: '1m', target: 50 },
      { duration: '1m', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<3000'],
      http_req_failed: ['rate<0.15'],
    },
  },

  soak: {
    name: 'soak',
    description: 'Soak testing for sustained load over time',

    stages: [
      { duration: '5m', target: 100 },
      { duration: '30m', target: 100 },
      { duration: '5m', target: 0 },
    ],

    thresholds: {
      http_req_duration: ['p(95)<1500'],
      http_req_failed: ['rate<0.05'],

      'http_req_duration{type:trend}': ['p(95)<1500'],
    },
  },

  volume: {
    name: 'volume',
    description: 'Volume testing with large data sets',

    stages: [
      { duration: '2m', target: 20 },
      { duration: '10m', target: 20 },
      { duration: '2m', target: 0 },
    ],

    thresholds: {
      http_req_duration: ['p(95)<5000'],
      http_req_failed: ['rate<0.10'],
    },
  },

  capacity: {
    name: 'capacity',
    description: 'Capacity testing to find maximum limits',

    stages: [
      { duration: '2m', target: 10 },
      { duration: '5m', target: 50 },
      { duration: '5m', target: 100 },
      { duration: '5m', target: 200 },
      { duration: '5m', target: 300 },
      { duration: '5m', target: 400 },
      { duration: '5m', target: 500 },
      { duration: '5m', target: 0 },
    ],

    thresholds: {
      http_req_duration: ['p(95)<3000'],
      http_req_failed: ['rate<0.15'],
    },
  },
};

export function getTestType(type) {
  return TEST_TYPES[type] || TEST_TYPES.load;
}

export function applyTestType(options, testType) {
  const typesConfig = getTestType(testType);

  return {
    ...options,
    stages: options.stages || typesConfig.stages,
    threshold: {
      ...typesConfig.thresholds,
      ...options.thresholds,
    },
  };
}
