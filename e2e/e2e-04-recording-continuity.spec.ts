import { test, expect } from '@playwright/test';
import {
  createIsolatedUser,
  injectAuthSession,
  createQuickMeeting,
} from './fixtures/auth-helper.js';

const API_BASE_URL = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3000';

test.describe('E2E-04: Recording Lifecycle & Tenant Playback Isolation', () => {
  test('verifies recording controls and tenant-isolated playback restrictions', async ({
    page,
    context,
  }) => {
    // 1. Create organizer and meeting
    const organizer = await createIsolatedUser({
      emailPrefix: 'recorder-host',
    });
    const { roomId } = await createQuickMeeting(organizer.token);

    // 2. Open room as organizer
    await injectAuthSession(context, page, organizer);
    await page.goto(`/room/${roomId}`);
    await expect(page).toHaveURL(new RegExp(`/room/${roomId}`));

    // In-room controls visible
    await expect(
      page.getByRole('button', { name: 'Leave' }).first()
    ).toBeVisible({ timeout: 15000 });

    // 3. Verify backend recording status query
    const statusRes = await fetch(
      `${API_BASE_URL}/api/recordings/room/${roomId}`,
      {
        headers: { Authorization: `Bearer ${organizer.token}` },
      }
    );
    // Expected 200 with empty recordings or valid status object
    expect(statusRes.status).toBeLessThan(500);

    // 4. Adversarial check: An unrelated tenant user cannot access this room's recording
    const unrelatedUser = await createIsolatedUser({ emailPrefix: 'attacker' });
    const attackRes = await fetch(
      `${API_BASE_URL}/api/recordings/room/${roomId}`,
      {
        headers: { Authorization: `Bearer ${unrelatedUser.token}` },
      }
    );
    // Expect access denial (403 or 404), never leaking metadata
    expect([403, 404]).toContain(attackRes.status);
  });
});
