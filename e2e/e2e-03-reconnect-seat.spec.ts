import { test, expect } from '@playwright/test';
import {
  createIsolatedUser,
  injectAuthSession,
  createQuickMeeting,
} from './fixtures/auth-helper.js';

const MEDIASOUP_BASE_URL =
  process.env.PLAYWRIGHT_MEDIASOUP_URL || 'http://localhost:3003';

async function getMediaParticipants(roomId: string, token: string) {
  const response = await fetch(
    `${MEDIASOUP_BASE_URL}/api/media/rooms/${encodeURIComponent(roomId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (response.status === 404) return [];
  expect(response.ok).toBe(true);
  const body = await response.json();
  return body.participants as Array<{ userId: string }>;
}

test.describe('E2E-03: Reconnect, Single Seat Preservation, and Clean Leave Journey', () => {
  test('browser reload reconnects to room without duplicating logical seat', async ({
    page,
    context,
  }) => {
    // 1. Create organizer and meeting
    const user = await createIsolatedUser({ emailPrefix: 'reconnect' });
    const { roomId } = await createQuickMeeting(user.token);

    // 2. Join room
    await injectAuthSession(context, page, user);
    await page.goto(`/room/${roomId}`);
    await expect(page).toHaveURL(new RegExp(`/room/${roomId}`));

    // Wait for in-room controls to mount
    const leaveBtn = page.getByRole('button', { name: 'Leave' }).first();
    await expect(leaveBtn).toBeVisible({ timeout: 15000 });

    await expect
      .poll(async () => (await getMediaParticipants(roomId, user.token)).length)
      .toBe(1);

    // 3. Reload browser page
    await page.reload();

    // 4. Verify in-room state restores cleanly
    await expect(page).toHaveURL(new RegExp(`/room/${roomId}`), {
      timeout: 15000,
    });
    await expect(page).not.toHaveURL(/\/dashboard/);
    await expect
      .poll(async () => (await getMediaParticipants(roomId, user.token)).length)
      .toBe(1);

    const participantsAfterReconnect = await getMediaParticipants(
      roomId,
      user.token
    );
    expect(participantsAfterReconnect).toHaveLength(1);
    expect(
      new Set(participantsAfterReconnect.map(({ userId }) => userId)).size
    ).toBe(1);

    // 5. Explicit Leave
    await leaveBtn.click();

    // 6. Invariant: User returns to /dashboard and tracks are released
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await expect
      .poll(async () => {
        const response = await fetch(
          `${MEDIASOUP_BASE_URL}/api/media/rooms/${encodeURIComponent(roomId)}`,
          { headers: { Authorization: `Bearer ${user.token}` } }
        );
        return response.status;
      })
      .toBe(404);
  });
});
