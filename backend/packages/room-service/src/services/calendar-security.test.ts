import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateOAuthState,
  verifyAndConsumeOAuthState,
} from './calendar-oauth-state.service.js';

describe('CAL-SEC-01: Calendar OAuth State Security & Invariants', () => {
  const userId = 'user_test_12345';
  const email = 'user12345@meetlite.test';

  const originalSecret = process.env.OAUTH_STATE_SECRET;

  before(() => {
    process.env.OAUTH_STATE_SECRET =
      'test-oauth-state-secret-at-least-32-characters';
  });

  after(() => {
    if (originalSecret === undefined) delete process.env.OAUTH_STATE_SECRET;
    else process.env.OAUTH_STATE_SECRET = originalSecret;
  });

  it('generates a signed, opaque, base64url state string with 2 segments', async () => {
    const state = await generateOAuthState(userId, email, 'google');
    assert.ok(state, 'State must not be empty');
    const parts = state.split('.');
    assert.strictEqual(
      parts.length,
      2,
      'State must contain payload and signature segments'
    );

    assert.match(parts[0], /^[0-9a-f]{32}$/i);
    assert.match(parts[1], /^[0-9a-f]{64}$/i);
    assert.ok(!state.includes(userId), 'State must not expose user identity');
    assert.ok(!state.includes(email), 'State must not expose user email');
  });

  it('successfully verifies and consumes valid OAuth state', async () => {
    const state = await generateOAuthState(userId, email, 'google');
    const verified = await verifyAndConsumeOAuthState(state);

    assert.strictEqual(verified.userId, userId);
    assert.strictEqual(verified.email, email);
    assert.strictEqual(verified.provider, 'google');
  });

  it('denies replay attacks: a consumed state cannot be reused', async () => {
    const state = await generateOAuthState(userId, email, 'google');

    // First consumption succeeds
    const first = await verifyAndConsumeOAuthState(state);
    assert.strictEqual(first.userId, userId);

    // Second consumption must fail (replay denial)
    await assert.rejects(
      async () => {
        await verifyAndConsumeOAuthState(state);
      },
      /replay denied|already been consumed/i,
      'Replayed OAuth state must be rejected'
    );
  });

  it('rejects tampered signature', async () => {
    const state = await generateOAuthState(userId, email, 'google');
    const [payload, sig] = state.split('.');
    const tamperedSig = sig.slice(0, -4) + 'abcd';
    const tamperedState = `${payload}.${tamperedSig}`;

    await assert.rejects(
      async () => {
        await verifyAndConsumeOAuthState(tamperedState);
      },
      /signature verification failed|tampered/i,
      'Tampered signature must be rejected'
    );
  });

  it('rejects an unknown nonce (cross-user state injection)', async () => {
    const state = await generateOAuthState(userId, email, 'google');
    const [, sig] = state.split('.');
    const tamperedState = `${'f'.repeat(32)}.${sig}`;

    await assert.rejects(
      async () => {
        await verifyAndConsumeOAuthState(tamperedState);
      },
      /signature verification failed|tampered/i,
      'Tampered user ID must fail cryptographic verification'
    );
  });

  it('rejects expired state', async () => {
    const realDateNow = Date.now;
    const issuedAt = realDateNow();
    const state = await generateOAuthState(userId, email, 'google');
    Date.now = () => issuedAt + 11 * 60 * 1000;
    try {
      await assert.rejects(() => verifyAndConsumeOAuthState(state), /expired/i);
    } finally {
      Date.now = realDateNow;
    }
  });

  it('rejects malformed state inputs', async () => {
    await assert.rejects(async () => {
      await verifyAndConsumeOAuthState('invalid-state-no-dot');
    }, /Malformed OAuth state/i);

    await assert.rejects(async () => {
      await verifyAndConsumeOAuthState('');
    }, /Missing or invalid/i);
  });
});
