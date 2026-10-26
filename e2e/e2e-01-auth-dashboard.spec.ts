import { test, expect } from '@playwright/test';
import {
  createIsolatedUser,
  injectAuthSession,
} from './fixtures/auth-helper.js';

test.describe('E2E-01: Authentication, Dashboard, and Quick Meeting Journey', () => {
  test('authenticates user and loads dashboard with quick action controls', async ({
    page,
    context,
  }) => {
    // 1. Create isolated user
    const user = await createIsolatedUser({ emailPrefix: 'e2e-auth' });

    // 2. Inject session and navigate to dashboard
    await injectAuthSession(context, page, user);
    await page.goto('/dashboard');

    // 3. Verify dashboard loads with authenticated state
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole('button', { name: /Instant Meeting/i })
    ).toBeVisible({
      timeout: 15000,
    });
  });

  test('creates instant meeting and navigates to lobby with room parameter', async ({
    page,
    context,
  }) => {
    const user = await createIsolatedUser({ emailPrefix: 'e2e-quick' });
    await injectAuthSession(context, page, user);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);

    // Click "Instant Meeting"
    const quickMeetingBtn = page.getByRole('button', {
      name: /Instant Meeting/i,
    });
    await expect(quickMeetingBtn).toBeVisible({ timeout: 10000 });
    await quickMeetingBtn.click();

    // Verify navigation to lobby
    await expect(page).toHaveURL(/\/lobby\/[a-zA-Z0-9_-]+/, { timeout: 15000 });
    const roomId = page.url().split('/lobby/')[1];
    expect(roomId).toBeTruthy();

    // Verify lobby elements
    await expect(page.locator('#lobby-join-btn')).toBeVisible({
      timeout: 15000,
    });
  });

  test('logs out and redirects to login, preventing unauthenticated access to dashboard', async ({
    page,
    context,
  }) => {
    const user = await createIsolatedUser({ emailPrefix: 'e2e-logout' });
    await injectAuthSession(context, page, user);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);

    // Clear session to simulate logout
    await context.clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Try navigating to dashboard again
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
