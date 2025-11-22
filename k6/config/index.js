import { env } from 'k6';

const isK6 = typeof __ENV !== 'undefined';
const isNode = typeof process !== 'undefined' && process.env;

const getEnv = (key, defaultValue) => {
  // Try k6 environment first (__ENV is k6's global object)
  if (isK6 && typeof __ENV[key] !== 'undefined') {
    const value = __ENV[key];
    // Debug logging for sensitive keys (email only, not password)
    if (key === 'TEST_USER_EMAIL' && typeof console !== 'undefined') {
      console.log(`✅ [CONFIG] Using ${key} from __ENV: ${value}`);
    }
    return value;
  }

  // Try Node.js environment (process.env is Node.js's env object)
  if (isNode && typeof process.env[key] !== 'undefined') {
    const value = process.env[key];
    if (key === 'TEST_USER_EMAIL' && typeof console !== 'undefined') {
      console.log(`✅ [CONFIG] Using ${key} from process.env: ${value}`);
    }
    return value;
  }

  // Fall back to default value
  if (key === 'TEST_USER_EMAIL' && typeof console !== 'undefined') {
    console.log(`⚠️  [CONFIG] Using default value for ${key}: ${defaultValue}`);
  }
  return defaultValue;
};

// const getEnv = (key, defaultValue) => __ENV[key] || defaultValue;

export const CONFIG = {
  apiGateway: {
    baseUrl: getEnv('API_GATEWAY_URL', 'http://localhost:3000'),

    timeout: parseInt(getEnv('API_TIMEOUT', '6000')),
  },

  services: {
    auth: getEnv('AUTH_SERVICE_URL', 'http://localhost:5000'),
    room: getEnv('ROOM_SERVICE_URL', 'http://localhost:5001'),
    mediasoup: getEnv('MEDIASOUP_SERVICE_URL', 'http://localhost:3003'),
  },

  frontend: {
    baseUrl: getEnv('FRONTEND_URL', 'http://localhost:5174'),
  },

  testUsers: {
    default: {
      email: getEnv('TEST_USER_EMAIL', 'test@minimeet.com'),
      password: getEnv('TEST_USER_PASSWORD', 'TestPassword123'),
    },

    poolSize: parseInt(getEnv('TEST_USER_POOL_SIZE', '100')),

    prefix: getEnv('TEST_USER_PREFIX', 'k6-test-user'),
  },

  testData: {
    organizationPrefix: 'k6-test-org',
    meetingPrefix: 'k6-test-meeting',
    roomPrefix: 'k6-test-room',
  },

  environment: getEnv('NODE_ENV', 'test'),

  debug: getEnv('DEBUG', 'false') === 'true',
};

export function apiUrl(path) {
  return `${CONFIG.apiGateway.baseUrl}${path}`;
}

export function serviceUrl(service, path = '') {
  return `${CONFIG.services[service]}${path}`;
}

export function frontendUrl(path) {
  return `${CONFIG.frontend.baseUrl}${path}`;
}
