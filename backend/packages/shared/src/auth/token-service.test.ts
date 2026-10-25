import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {
  TokenManager,
  InMemoryRefreshTokenStore,
  hashToken,
  generateOpaqueToken,
  TokenReuseError,
  TokenRevokedError,
  ACCESS_TOKEN_TTL_SECONDS,
} from './token-service.js';

describe('P0-06: Token Lifetime & Revocation Semantics', () => {
  const TEST_SECRET = 'super_secret_test_key_for_jwt_tokens_32_chars_min';

  it('access tokens have a 15-minute expiration (900 seconds)', () => {
    const store = new InMemoryRefreshTokenStore();
    const manager = new TokenManager(TEST_SECRET, store);

    const user = { id: 'usr_1', email: 'alice@example.com', role: 'member' };
    const token = manager.createAccessToken(user);

    const decoded = jwt.decode(token) as any;
    assert.ok(decoded);
    assert.equal(decoded.userId, 'usr_1');
    assert.equal(decoded.email, 'alice@example.com');
    assert.equal(typeof decoded.exp, 'number');
    assert.equal(typeof decoded.iat, 'number');

    const durationSeconds = decoded.exp - decoded.iat;
    assert.equal(
      durationSeconds,
      ACCESS_TOKEN_TTL_SECONDS,
      'Access token lifetime must be exactly 900 seconds (15 minutes)'
    );
  });

  it('hashToken computes deterministic SHA-256 and never matches raw token', () => {
    const raw = generateOpaqueToken();
    const hash1 = hashToken(raw);
    const hash2 = hashToken(raw);

    assert.equal(hash1, hash2);
    assert.notEqual(raw, hash1);
    assert.equal(hash1.length, 64, 'SHA-256 hex string must be 64 characters');
  });

  it('issueTokenPair creates an access token and a hashed refresh token in a new family', async () => {
    const store = new InMemoryRefreshTokenStore();
    const manager = new TokenManager(TEST_SECRET, store);

    const user = { id: 'usr_1', email: 'alice@example.com', tokenVersion: 1 };
    const pair = await manager.issueTokenPair(user);

    assert.ok(pair.accessToken);
    assert.ok(pair.refreshToken);
    assert.ok(pair.familyId);
    assert.equal(pair.expiresIn, 900);

    // Verify refresh token is stored hashed, not raw
    const rawFound = await store.findToken(pair.refreshToken);
    assert.equal(rawFound, null, 'Raw refresh token must never be stored in plaintext');

    const hashedFound = await store.findToken(hashToken(pair.refreshToken));
    assert.ok(hashedFound, 'Hashed refresh token must be stored');
    assert.equal(hashedFound?.userId, 'usr_1');
    assert.equal(hashedFound?.familyId, pair.familyId);
  });

  it('rotateRefreshToken rotates the refresh token within the same family', async () => {
    const store = new InMemoryRefreshTokenStore();
    const manager = new TokenManager(TEST_SECRET, store, { graceWindowSeconds: 0 });

    const user = { id: 'usr_1', email: 'alice@example.com', tokenVersion: 1 };
    const pair1 = await manager.issueTokenPair(user);

    const pair2 = await manager.rotateRefreshToken(pair1.refreshToken, async () => user);

    assert.equal(pair2.familyId, pair1.familyId, 'Rotated token must belong to the same family');
    assert.notEqual(pair2.refreshToken, pair1.refreshToken, 'New refresh token must be issued');
    assert.notEqual(pair2.accessToken, pair1.accessToken, 'New access token must be issued');

    // First refresh token should now be inactive
    const oldFound = await store.findToken(hashToken(pair1.refreshToken));
    assert.equal(oldFound, null, 'Old refresh token must be removed upon rotation');

    // Second refresh token is active
    const newFound = await store.findToken(hashToken(pair2.refreshToken));
    assert.ok(newFound, 'New refresh token must be active');
  });

  it('detects token reuse and immediately revokes the entire family', async () => {
    const store = new InMemoryRefreshTokenStore();
    const manager = new TokenManager(TEST_SECRET, store, { graceWindowSeconds: 0 });

    const user = { id: 'usr_1', email: 'alice@example.com', tokenVersion: 1 };
    const pair1 = await manager.issueTokenPair(user);

    // Legitimate rotation: client obtains pair2
    const pair2 = await manager.rotateRefreshToken(pair1.refreshToken, async () => user);

    // Attacker or replay presents pair1.refreshToken again!
    await assert.rejects(
      async () => manager.rotateRefreshToken(pair1.refreshToken, async () => user),
      (err: unknown) => err instanceof TokenReuseError,
      'Reusing an already-rotated token must trigger TokenReuseError'
    );

    // Entire family must now be revoked!
    const isRevoked = await store.isFamilyRevoked(pair1.familyId);
    assert.equal(isRevoked, true, 'Compromised family must be revoked');

    // Legitimate user's pair2 must now ALSO be rejected because the family was compromised
    await assert.rejects(
      async () => manager.rotateRefreshToken(pair2.refreshToken, async () => user),
      (err: unknown) => err instanceof TokenRevokedError,
      'Tokens from revoked family must be rejected'
    );
  });

  it('user tokenVersion bump invalidates sessions during immediate revocation check', async () => {
    const store = new InMemoryRefreshTokenStore();
    const manager = new TokenManager(TEST_SECRET, store);

    let activeVersion = 1;
    const user = { id: 'usr_1', email: 'alice@example.com', tokenVersion: activeVersion };
    const pair = await manager.issueTokenPair(user);

    const payload = manager.verifyAccessToken(pair.accessToken);
    assert.equal(payload.tokenVersion, 1);

    // Before version bump: not revoked
    const revokedBefore = await manager.isTokenRevoked(payload, async () => activeVersion);
    assert.equal(revokedBefore, false);

    // User changes password or clicks "Log out all devices": tokenVersion bumps to 2
    activeVersion = 2;
    const revokedAfter = await manager.isTokenRevoked(payload, async () => activeVersion);
    assert.equal(revokedAfter, true, 'Access token with outdated tokenVersion must be revoked');

    // Refresh attempt with version 1 must also fail
    await assert.rejects(
      async () => manager.rotateRefreshToken(pair.refreshToken, async () => ({ ...user, tokenVersion: activeVersion })),
      (err: unknown) => err instanceof TokenRevokedError,
      'Refresh token with outdated tokenVersion must be rejected'
    );
  });

  it('stateless token verification runs without touching the store', () => {
    let storeAccessed = false;
    const proxyStore: any = new Proxy(new InMemoryRefreshTokenStore(), {
      get(target, prop) {
        storeAccessed = true;
        return (target as any)[prop];
      },
    });

    const manager = new TokenManager(TEST_SECRET, proxyStore);
    const token = manager.createAccessToken({ id: 'usr_1', email: 'alice@example.com' });

    storeAccessed = false;
    const payload = manager.verifyAccessToken(token);

    assert.equal(payload.userId, 'usr_1');
    assert.equal(storeAccessed, false, 'Stateless verification must not query the store');
  });
});
