import { test, expect } from '@playwright/test';
import {
  createIsolatedUser,
  injectAuthSession,
} from './fixtures/auth-helper.js';

const API_BASE_URL = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3000';

test.describe('E2E-05: System Admin Authorization and Access Control', () => {
  test('denies non-admin browser navigation to /admin and redirects to /dashboard', async ({
    page,
    context,
  }) => {
    // 1. Create ordinary non-admin user
    const ordinaryUser = await createIsolatedUser({ emailPrefix: 'non-admin' });

    // 2. Open /admin
    await injectAuthSession(context, page, ordinaryUser);
    await page.goto('/admin');

    // 3. Invariant: User is immediately redirected away from /admin to /dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test('denies non-admin API access to /api/admin/metrics with 403 Forbidden', async () => {
    const ordinaryUser = await createIsolatedUser({
      emailPrefix: 'api-non-admin',
    });

    const res = await fetch(`${API_BASE_URL}/api/admin/metrics`, {
      headers: {
        Authorization: `Bearer ${ordinaryUser.token}`,
      },
    });

    // Invariant: Non-admin receives HTTP 403 Forbidden
    expect(res.status).toBe(403);
  });
});
