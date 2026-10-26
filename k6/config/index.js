const isK6 = typeof __ENV !== 'undefined';
const isNode = typeof process !== 'undefined' && process.env;

const getEnv = (key, defaultValue) => {
  // Try k6 environment first (__ENV is k6's global object)
  if (isK6 && typeof __ENV[key] !== 'undefined') {
    const value = __ENV[key];
    return value;
  }

  // Try Node.js environment (process.env is Node.js's env object)
  if (isNode && typeof process.env[key] !== 'undefined') {
    const value = process.env[key];
    return value;
  }

  // Fall back to default value
  return defaultValue;
};

// const getEnv = (key, defaultValue) => __ENV[key] || defaultValue;

export const CONFIG = {
  apiGateway: {
    baseUrl: getEnv('API_GATEWAY_URL', 'http://localhost:3000'),
    timeout: parseInt(getEnv('API_TIMEOUT', '10000')),
  },

  services: {
    auth: getEnv('AUTH_SERVICE_URL', 'http://localhost:5000'),
    room: getEnv('ROOM_SERVICE_URL', 'http://localhost:5001'),
    mediasoup: getEnv('MEDIASOUP_SERVICE_URL', 'http://localhost:3003'),
    edgeCoordinator: getEnv('EDGE_COORDINATOR_URL', 'ws://localhost:8787'),
  },

  frontend: {
    baseUrl: getEnv('FRONTEND_URL', 'http://localhost:5175'),
  },

  testUsers: {
    default: {
      email: getEnv('TEST_USER_EMAIL', 'test@meetlite.test'),
      password: getEnv('TEST_USER_PASSWORD', 'TestPassword123!'),
    },

    poolSize: parseInt(getEnv('TEST_USER_POOL_SIZE', '100')),

    prefix: getEnv('TEST_USER_PREFIX', 'k6-test-user'),

    // Provisioning belongs to the explicit setup step, never the measured run.
    allowProvisionDuringTest:
      getEnv('ALLOW_USER_PROVISION_DURING_TEST', 'false') === 'true',
  },

  testData: {
    organizationPrefix: 'k6-test-org',
    meetingPrefix: 'k6-test-meeting',
    roomPrefix: 'k6-test-room',
  },

  environment: getEnv('NODE_ENV', 'test'),

  debug: getEnv('DEBUG', 'false') === 'true',
};

export function apiUrl(path = '') {
  const base = CONFIG.apiGateway.baseUrl.replace(/\/+$/, '');
  const cleanPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${base}${cleanPath}`;
}

export function serviceUrl(service, path = '') {
  const base = (CONFIG.services[service] || '').replace(/\/+$/, '');
  const cleanPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${base}${cleanPath}`;
}

export function frontendUrl(path = '') {
  const base = CONFIG.frontend.baseUrl.replace(/\/+$/, '');
  const cleanPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${base}${cleanPath}`;
}
