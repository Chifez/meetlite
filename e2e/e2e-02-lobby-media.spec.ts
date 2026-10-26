import { test, expect } from '@playwright/test';
import {
  createIsolatedUser,
  injectAuthSession,
  createQuickMeeting,
} from './fixtures/auth-helper.js';

test.describe('E2E-02: Lobby Preview and Two-Party Media Join Journey', () => {
  test('initializes camera preview in lobby and joins meeting room without false redirect', async ({
    page,
    context,
  }) => {
    // 1. Create organizer
    const organizer = await createIsolatedUser({ emailPrefix: 'organizer' });
    const { roomId } = await createQuickMeeting(organizer.token);

    // 2. Open lobby
    await injectAuthSession(context, page, organizer);
    await page.goto(`/lobby/${roomId}`);

    // Verify on lobby page
    await expect(page).toHaveURL(new RegExp(`/lobby/${roomId}`));

    // Verify join button is enabled and video element is present
    const joinBtn = page.locator('#lobby-join-btn');
    await expect(joinBtn).toBeVisible({ timeout: 15000 });
    const preview = page.getByTestId('lobby-video-preview');
    await expect(preview).toBeVisible();
    await expect
      .poll(() =>
        preview.evaluate((video: HTMLVideoElement) => {
          const stream = video.srcObject as MediaStream | null;
          return Boolean(
            stream
              ?.getVideoTracks()
              .some((track) => track.readyState === 'live')
          );
        })
      )
      .toBe(true);

    // 3. Join the meeting
    await joinBtn.click();

    // 4. Invariant: User MUST transition to /room/:roomId and NOT get redirected back to dashboard!
    await expect(page).toHaveURL(new RegExp(`/room/${roomId}`), {
      timeout: 15000,
    });
    await expect(page).not.toHaveURL(/\/dashboard/);

    // Verify in-room controls exist
    await expect(
      page.getByRole('button', { name: 'Leave' }).first()
    ).toBeVisible({
      timeout: 15000,
    });
  });

  test('two independent participants join the same room and exchange media state', async ({
    browser,
  }) => {
    // 1. Create two isolated users
    const userA = await createIsolatedUser({ emailPrefix: 'peer-a' });
    const userB = await createIsolatedUser({ emailPrefix: 'peer-b' });

    // 2. Create room
    const { roomId } = await createQuickMeeting(userA.token);

    // 3. Setup Participant A context
    const contextA = await browser.newContext({
      permissions: ['camera', 'microphone'],
    });
    const pageA = await contextA.newPage();
    await injectAuthSession(contextA, pageA, userA);
    await pageA.goto(`/lobby/${roomId}`);
    await expect(pageA.locator('#lobby-join-btn')).toBeVisible({
      timeout: 15000,
    });
    await pageA.locator('#lobby-join-btn').click();
    await expect(pageA).toHaveURL(new RegExp(`/room/${roomId}`), {
      timeout: 15000,
    });

    // 4. Setup Participant B context (independent browser context)
    const contextB = await browser.newContext({
      permissions: ['camera', 'microphone'],
    });
    const pageB = await contextB.newPage();
    await injectAuthSession(contextB, pageB, userB);
    await pageB.goto(`/lobby/${roomId}`);
    await expect(pageB.locator('#lobby-join-btn')).toBeVisible({
      timeout: 15000,
    });
    await pageB.locator('#lobby-join-btn').click();
    await expect(pageB).toHaveURL(new RegExp(`/room/${roomId}`), {
      timeout: 15000,
    });

    // 5. Invariant: Participant count updates to 2 in both browsers
    await expect(
      pageA.getByText('2', { exact: true }).filter({ visible: true })
    ).toBeVisible({
      timeout: 20000,
    });
    await expect(
      pageB.getByText('2', { exact: true }).filter({ visible: true })
    ).toBeVisible({
      timeout: 20000,
    });

    // A participant counter alone can pass while SFU transport creation is
    // broken. Both browsers must receive a live remote video track.
    for (const participantPage of [pageA, pageB]) {
      const remoteVideo = participantPage
        .getByTestId('remote-participant-video')
        .filter({ visible: true })
        .first();
      await expect(remoteVideo).toBeVisible({ timeout: 20000 });
      await expect
        .poll(() =>
          remoteVideo.evaluate((video: HTMLVideoElement) => {
            const stream = video.srcObject as MediaStream | null;
            return Boolean(
              stream
                ?.getVideoTracks()
                .some((track) => track.readyState === 'live')
            );
          })
        )
        .toBe(true);
    }

    // Cleanup contexts
    await contextA.close();
    await contextB.close();
  });
});
