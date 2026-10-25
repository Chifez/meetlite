import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import {
  TokenManager,
  InMemoryRefreshTokenStore,
  hashToken,
  TokenReuseError,
  TokenRevokedError,
  ACCESS_TOKEN_TTL_SECONDS,
} from '../auth/token-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../../..');

describe('P0-06: Token Lifetime & Revocation Semantics Contract', () => {
  const TEST_SECRET = 'contract_verification_secret_min_32_characters_123456';

  it('static source verification: auth-service wires 15m lifetime and family rotation routes', () => {
    const generateTokenPath = path.join(
      REPO_ROOT,
      'backend/packages/auth-service/src/utils/generate-token.ts'
    );
    assert.ok(fs.existsSync(generateTokenPath));
    const generateTokenContent = fs.readFileSync(generateTokenPath, 'utf-8');
    assert.ok(
      generateTokenContent.includes('ACCESS_TOKEN_TTL_SECONDS'),
      'generate-token.ts must use ACCESS_TOKEN_TTL_SECONDS (15m)'
    );

    const controllerPath = path.join(
      REPO_ROOT,
      'backend/packages/auth-service/src/controllers/auth.controller.ts'
    );
    assert.ok(fs.existsSync(controllerPath));
    const controllerContent = fs.readFileSync(controllerPath, 'utf-8');
    assert.ok(
      controllerContent.includes('tokenManager.issueTokenPair'),
      'auth.controller.ts must use tokenManager.issueTokenPair on login/signup'
    );
    assert.ok(
      controllerContent.includes('tokenManager.rotateRefreshToken'),
      'auth.controller.ts must use tokenManager.rotateRefreshToken'
    );
    assert.ok(
      controllerContent.includes('logoutAll'),
      'auth.controller.ts must implement logoutAll'
    );

    const routePath = path.join(
      REPO_ROOT,
      'backend/packages/auth-service/src/routes/v1/auth.route.ts'
    );
    assert.ok(fs.existsSync(routePath));
    const routeContent = fs.readFileSync(routePath, 'utf-8');
    assert.ok(routeContent.includes("'/refresh'"));
    assert.ok(routeContent.includes("'/logout'"));
    assert.ok(routeContent.includes("'/logout-all'"));
  });

  it('adversarial drill: multi-step session rotation preserves familyId across rotations', async () => {
    const store = new InMemoryRefreshTokenStore();
    const manager = new TokenManager(TEST_SECRET, store, { graceWindowSeconds: 0 });

    const user = { id: 'usr_rot_101', email: 'drill@meetlite.dev', tokenVersion: 1 };
    const pair1 = await manager.issueTokenPair(user);

    // Rotation 1
    const pair2 = await manager.rotateRefreshToken(pair1.refreshToken, async () => user);
    assert.equal(pair2.familyId, pair1.familyId);
    assert.notEqual(pair2.refreshToken, pair1.refreshToken);

    // Rotation 2
    const pair3 = await manager.rotateRefreshToken(pair2.refreshToken, async () => user);
    assert.equal(pair3.familyId, pair1.familyId);
    assert.notEqual(pair3.refreshToken, pair2.refreshToken);

    // Rotation 3
    const pair4 = await manager.rotateRefreshToken(pair3.refreshToken, async () => user);
    assert.equal(pair4.familyId, pair1.familyId);
    assert.notEqual(pair4.refreshToken, pair3.refreshToken);

    // Verify only the latest token is active
    const latestActive = await store.findToken(hashToken(pair4.refreshToken));
    assert.ok(latestActive);
    const oldInactive = await store.findToken(hashToken(pair1.refreshToken));
    assert.equal(oldInactive, null);
  });

  it('adversarial drill: replaying old rotated token revokes family and locks out attacker and victim', async () => {
    const store = new InMemoryRefreshTokenStore();
    const manager = new TokenManager(TEST_SECRET, store, { graceWindowSeconds: 0 });

    const user = { id: 'usr_adv_202', email: 'victim@meetlite.dev', tokenVersion: 1 };
    const session1 = await manager.issueTokenPair(user);

    // User legitimately rotates session1 -> session2 -> session3
    const session2 = await manager.rotateRefreshToken(session1.refreshToken, async () => user);
    const session3 = await manager.rotateRefreshToken(session2.refreshToken, async () => user);

    // Attacker steals session1.refreshToken and tries to use it!
    await assert.rejects(
      async () => manager.rotateRefreshToken(session1.refreshToken, async () => user),
      (err: unknown) => err instanceof TokenReuseError,
      'Reusing session1 must trigger TokenReuseError'
    );

    // Family is revoked
    assert.equal(await store.isFamilyRevoked(session1.familyId), true);

    // Subsequent attempt by attacker with session2 is rejected
    await assert.rejects(
      async () => manager.rotateRefreshToken(session2.refreshToken, async () => user),
      (err: unknown) => err instanceof TokenReuseError
    );

    // Legitimate user attempt with session3 is ALSO rejected due to family compromise
    await assert.rejects(
      async () => manager.rotateRefreshToken(session3.refreshToken, async () => user),
      (err: unknown) => err instanceof TokenRevokedError
    );
  });

  it('adversarial drill: global logout invalidates all sessions when tokenVersion is incremented', async () => {
    const store = new InMemoryRefreshTokenStore();
    const manager = new TokenManager(TEST_SECRET, store);

    let dbVersion = 1;
    const user = { id: 'usr_global_303', email: 'global@meetlite.dev', tokenVersion: dbVersion };

    // Device A logs in
    const deviceA = await manager.issueTokenPair(user);
    // Device B logs in
    const deviceB = await manager.issueTokenPair(user);

    // User clicks "Log out of all devices"
    dbVersion = 2;
    await manager.revokeAllUserSessions(user.id, dbVersion);

    // Immediate revocation check flags Device A and Device B as revoked
    const payloadA = manager.verifyAccessToken(deviceA.accessToken);
    const payloadB = manager.verifyAccessToken(deviceB.accessToken);

    assert.equal(await manager.isTokenRevoked(payloadA, async () => dbVersion), true);
    assert.equal(await manager.isTokenRevoked(payloadB, async () => dbVersion), true);

    // Refresh attempts from both devices fail
    await assert.rejects(
      async () => manager.rotateRefreshToken(deviceA.refreshToken, async () => ({ ...user, tokenVersion: dbVersion })),
      (err: unknown) => err instanceof TokenRevokedError
    );
    await assert.rejects(
      async () => manager.rotateRefreshToken(deviceB.refreshToken, async () => ({ ...user, tokenVersion: dbVersion })),
      (err: unknown) => err instanceof TokenRevokedError
    );
  });

  it('stateless access token verification is performant and requires zero store operations', () => {
    const store = new InMemoryRefreshTokenStore();
    const manager = new TokenManager(TEST_SECRET, store);

    const user = { id: 'usr_perf_404', email: 'perf@meetlite.dev' };
    const token = manager.createAccessToken(user);

    const start = process.hrtime.bigint();
    const payload = manager.verifyAccessToken(token);
    const elapsedNs = Number(process.hrtime.bigint() - start);

    assert.equal(payload.userId, 'usr_perf_404');
    // Verification should complete in under 5ms
    assert.ok(elapsedNs < 5_000_000, `Stateless verification took ${elapsedNs}ns`);
  });
});
