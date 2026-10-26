import { BrowserContext, Page } from '@playwright/test';

const API_BASE_URL = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3000';
const CLIENT_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5175';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  password: string;
  token: string;
  refreshToken: string;
}

export async function createIsolatedUser(
  options: {
    emailPrefix?: string;
    isAdmin?: boolean;
    skipOnboarding?: boolean;
  } = {}
): Promise<TestUser> {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `${options.emailPrefix || 'user'}-${uniqueId}@meetlite.test`;
  const password = 'Password123!';
  const name = `Test User ${uniqueId}`;

  const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bypass-rate-limit': 'true',
    },
    body: JSON.stringify({ email, password, name }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create test user: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  const token = data.token || data.accessToken;
  const refreshToken = data.refreshToken;

  if (!options.skipOnboarding) {
    const onboardRes = await fetch(`${API_BASE_URL}/api/auth/onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-bypass-rate-limit': 'true',
      },
      body: JSON.stringify({ name, useCase: 'personal' }),
    });
    if (!onboardRes.ok) {
      console.warn(`[e2e] Onboarding warning: status ${onboardRes.status}`);
    }
  }

  return {
    id: data.user?.id || 'unknown',
    email,
    name,
    password,
    token,
    refreshToken,
  };
}

export async function injectAuthSession(
  context: BrowserContext,
  _page: Page,
  user: TestUser
): Promise<void> {
  const clientUrl = new URL(CLIENT_BASE_URL);
  await context.addCookies([
    {
      name: 'token',
      value: user.token,
      domain: clientUrl.hostname,
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
    {
      name: 'refreshToken',
      value: user.refreshToken,
      domain: clientUrl.hostname,
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

export async function createQuickMeeting(token: string): Promise<{
  roomId: string;
  meetingId: string;
}> {
  const res = await fetch(`${API_BASE_URL}/api/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Failed to create quick meeting: ${res.status} - ${errorText}`
    );
  }

  const data = await res.json();
  const roomId = data.data?.roomId || data.roomId;
  return {
    roomId,
    meetingId: roomId,
  };
}
