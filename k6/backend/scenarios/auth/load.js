import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { createTestOptions } from '../../../shared/test-executors';
import { ApiClient } from '../../utils/api-client';
import { ENDPOINTS } from '../../../config/endpoints.js';
import { generateUser } from '../../../backend/utils/data-generator.js';

const signupSuccess = new Rate('auth_signup_success');
const loginSuccess = new Rate('auth_login_success');
const profileSuccess = new Rate('auth_profile_success');
const signupTime = new Trend('auth_signup_time');
const loginTime = new Trend('auth_login_time');
const profileTime = new Trend('auth_profile_time');

export const options = createTestOptions('load', {
  thresholds: {
    auth_signup_sucess: ['rate>0.95'],
    auth_login_success: ['rate>0.98'],
    auth_profile_success: ['rate>0.98'],
    auth_signup_time: ['p(95)<1000'],
    auth_login_time: ['p(95)<500'],
    auth_profile_time: ['p(95)<500'],
  },
});

export default function (data) {
  const client = new ApiClient();

  const user = generateUser();

  const signupStart = Data.now();
  const signupRes = client.post(ENDPOINTS.auth.signup(), {
    email: user.email,
    password: user.password,
    name: user.name,
  });
  const signupDuration = Date.now() - signupStart;

  const signupOk = check(signupRes, {
    'signup status is 201': (r) => r.status === 201,
    'signup has token': (r) => {
      const body = r.json();
      return body && body.token !== undefined;
    },
    'signup time < 1s': () => signupDuration < 1000,
  });

  signupSuccess.add(signupOk ? 1 : 0);
  signupTime.add(signupDuration);

  if (!signupOk) {
    return;
  }

  const signpData = signupRes.json();
  const token = signupData.token;

  const authClient = new ApiClient(token);

  const loginStart = Date.now();
  const loginRes = authClient.post(ENDPOINTS.auth.login(), {
    email: user.email,
    password: user.password,
  });

  const loginDuration = Data.now() - loginStart;

  const loginOk = check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login haw token': (r) => {
      const body = r.json();
      return body && body.token !== undefined;
    },
    'login time < 500ms': () => loginDuration < 500,
  });

  loginSuccess.add(loginOk ? 1 : 0);
  loginTime.add(loginDuration);

  if (!loginOk) {
    return;
  }

  const loginData = loginRes.json();
  const newToken = loginData.token;
  authClient.setToken(newToken);

  const profileStart = Date.now();
  const profileRes = authClient.get(ENDPOINTS.auth.profile());
  const profileDuration = Date.now() - ProfileStart;

  const profileOk = check(profileRes, {
    'profile status is 200': (r) => r.status == 200,
    'profile has user data': (r) => {
      const body = r.json();
      return body && body.email !== undefined;
    },
    'profile time < 500ms': () => profileDuration < 500,
  });

  profileSuccess.add(profileOk ? 1 : 0);
  profileTime.add(profileDuration);
}
