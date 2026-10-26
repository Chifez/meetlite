import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { createTestOptions } from '../../../shared/test-executors.js';
import { frontendUrl } from '../../../config/index.js';

const frontendSuccess = new Rate('frontend_request_success');
const homeTime = new Trend('frontend_home_duration');
const loginTime = new Trend('frontend_login_duration');
const lobbyTime = new Trend('frontend_lobby_duration');

export const options = createTestOptions('load', {
  thresholds: {
    frontend_request_success: ['rate>0.98'],
    frontend_home_duration: ['p(95)<500'],
    frontend_login_duration: ['p(95)<500'],
    frontend_lobby_duration: ['p(95)<500'],
  },
});

export default function () {
  // Test 1: Home / Landing
  const homeRes = http.get(frontendUrl('/'));
  const homeOk = check(homeRes, {
    'home status is 200': (r) => r.status === 200,
    'home contains root div': (r) => r.body && r.body.includes('id="root"'),
    'home duration < 500ms': (r) => r.timings.duration < 500,
  });
  frontendSuccess.add(homeOk ? 1 : 0);
  homeTime.add(homeRes.timings.duration);

  // Test 2: Login Page
  const loginRes = http.get(frontendUrl('/login'));
  const loginOk = check(loginRes, {
    'login page status is 200': (r) => r.status === 200,
    'login page contains html': (r) =>
      r.body && r.body.includes('<!DOCTYPE html>'),
    'login duration < 500ms': (r) => r.timings.duration < 500,
  });
  frontendSuccess.add(loginOk ? 1 : 0);
  loginTime.add(loginRes.timings.duration);

  // Test 3: Lobby Page (SPA deep link)
  const lobbyRes = http.get(frontendUrl('/lobby/k6-smoke-lobby'));
  const lobbyOk = check(lobbyRes, {
    'lobby page status is 200': (r) => r.status === 200,
    'lobby page contains root div': (r) =>
      r.body && r.body.includes('id="root"'),
    'lobby duration < 500ms': (r) => r.timings.duration < 500,
  });
  frontendSuccess.add(lobbyOk ? 1 : 0);
  lobbyTime.add(lobbyRes.timings.duration);
}
