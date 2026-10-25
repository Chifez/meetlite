import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  createVerifiedPrincipal,
  isVerifiedPrincipal,
  getVerifiedPrincipal,
  VerifiedPrincipal,
} from '../auth/principal.js';
import {
  AsymmetricCapabilityService,
  generateEd25519KeyPair,
  ExpiredCapabilityError,
  InvalidCapabilitySignatureError,
  RoomMismatchError,
  MalformedCapabilityError,
  CapabilityTokenError,
  DEFAULT_ROLE_PERMISSIONS,
} from '../auth/capability-token.js';
import { AppError } from '../utils/app-error.js';

describe('R2-01: VerifiedPrincipal Model & Contract', () => {
  it('normalizes a Prisma User entity into an immutable VerifiedPrincipal', () => {
    const prismaUser = {
      id: 'usr_abc123',
      email: 'alex@example.com',
      role: 'admin',
      organizationId: 'org_xyz789',
      tokenVersion: 3,
      isSystemAdmin: false,
    };

    const principal = createVerifiedPrincipal(prismaUser);

    assert.equal(principal.userId, 'usr_abc123');
    assert.equal(principal.orgId, 'org_xyz789');
    assert.equal(principal.role, 'admin');
    assert.equal(principal.tokenVersion, 3);
    assert.equal(principal.email, 'alex@example.com');
    assert.equal(principal.isSystemAdmin, false);
    assert.ok(principal.expiresAt > Date.now());
    assert.ok(isVerifiedPrincipal(principal));
    assert.ok(Object.isFrozen(principal));
  });

  it('normalizes a JWT AccessTokenPayload into a VerifiedPrincipal', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const jwtPayload = {
      userId: 'usr_jwt456',
      email: 'carol@example.com',
      organizationId: null,
      role: 'owner',
      tokenVersion: 1,
      isSystemAdmin: true,
      familyId: 'fam_test999',
      exp: nowSec + 900,
    };

    const principal = createVerifiedPrincipal(jwtPayload);

    assert.equal(principal.userId, 'usr_jwt456');
    assert.equal(principal.orgId, null);
    assert.equal(principal.role, 'owner');
    assert.equal(principal.tokenVersion, 1);
    assert.equal(principal.isSystemAdmin, true);
    assert.equal(principal.familyId, 'fam_test999');
    assert.equal(principal.expiresAt, (nowSec + 900) * 1000);
    assert.ok(isVerifiedPrincipal(principal));
  });

  it('rejects invalid or missing userId with AppError 400', () => {
    assert.throws(
      () => createVerifiedPrincipal({}),
      (err: any) => err instanceof AppError && err.statusCode === 400
    );

    assert.throws(
      () => createVerifiedPrincipal({ userId: '   ' }),
      (err: any) => err instanceof AppError && err.statusCode === 400
    );

    assert.throws(
      () => createVerifiedPrincipal(null),
      (err: any) => err instanceof AppError && err.statusCode === 400
    );
  });

  it('falls back safely for unassigned org, missing tokenVersion, or unrecognized role', () => {
    const principal = createVerifiedPrincipal({
      userId: 'usr_minimal',
      role: 'invalid_role_string',
    });

    assert.equal(principal.userId, 'usr_minimal');
    assert.equal(principal.orgId, null);
    assert.equal(principal.role, 'member'); // normalized to default member
    assert.equal(principal.tokenVersion, 1);
  });

  it('isVerifiedPrincipal correctly identifies valid and corrupt objects', () => {
    const valid: VerifiedPrincipal = {
      userId: 'u1',
      orgId: 'org1',
      role: 'member',
      tokenVersion: 1,
      expiresAt: Date.now() + 60000,
    };
    assert.ok(isVerifiedPrincipal(valid));

    assert.equal(isVerifiedPrincipal(null), false);
    assert.equal(isVerifiedPrincipal(undefined), false);
    assert.equal(isVerifiedPrincipal('string'), false);
    assert.equal(isVerifiedPrincipal({ userId: 'u1' }), false);
    assert.equal(isVerifiedPrincipal({ ...valid, role: 'supergod' }), false);
    assert.equal(isVerifiedPrincipal({ ...valid, tokenVersion: 'not-a-number' }), false);
  });

  it('getVerifiedPrincipal extracts principal or synthesizes from req.user with fallback', () => {
    const reqWithPrincipal: any = {
      principal: {
        userId: 'u_p1',
        orgId: null,
        role: 'member',
        tokenVersion: 1,
        expiresAt: Date.now() + 60000,
      },
    };
    const p1 = getVerifiedPrincipal(reqWithPrincipal);
    assert.equal(p1.userId, 'u_p1');

    const reqWithUser: any = {
      user: {
        id: 'u_user1',
        organizationId: 'org_user1',
        role: 'admin',
      },
    };
    const p2 = getVerifiedPrincipal(reqWithUser);
    assert.equal(p2.userId, 'u_user1');
    assert.equal(p2.orgId, 'org_user1');
    assert.ok(reqWithUser.principal); // cached on request

    const reqEmpty: any = {};
    assert.throws(
      () => getVerifiedPrincipal(reqEmpty),
      (err: any) => err instanceof AppError && err.statusCode === 401
    );
  });
});

describe('R2-02: Asymmetric Room Capability Token Issuer (Ed25519)', () => {
  it('generates an Ed25519 key pair with valid PKCS#8 PEM, SPKI PEM, and RFC 8037 JWK', () => {
    const keyPair = generateEd25519KeyPair('test-kid-1');
    assert.ok(keyPair.privateKeyPem.includes('BEGIN PRIVATE KEY'));
    assert.ok(keyPair.publicKeyPem.includes('BEGIN PUBLIC KEY'));
    assert.equal(keyPair.keyId, 'test-kid-1');
    assert.equal(keyPair.publicKeyJwk.kty, 'OKP');
    assert.equal(keyPair.publicKeyJwk.crv, 'Ed25519');
    assert.equal(keyPair.publicKeyJwk.kid, 'test-kid-1');
    assert.equal(keyPair.publicKeyJwk.use, 'sig');
    assert.equal(keyPair.publicKeyJwk.alg, 'EdDSA');
    assert.ok(typeof keyPair.publicKeyJwk.x === 'string' && keyPair.publicKeyJwk.x.length > 0);
  });

  it('issues and verifies a room capability token using Ed25519', () => {
    const service = new AsymmetricCapabilityService();
    const principal: VerifiedPrincipal = {
      userId: 'usr_speaker_1',
      email: 'speaker@example.com',
      orgId: 'org_acme',
      role: 'member',
      tokenVersion: 1,
      expiresAt: Date.now() + 900000,
    };

    const token = service.issueRoomCapabilityFromPrincipal(
      principal,
      'room_townhall_2026',
      'host'
    );

    assert.ok(typeof token === 'string');
    const segments = token.split('.');
    assert.equal(segments.length, 3);

    // Verify token
    const claims = service.verifyRoomCapability(token, {
      expectedRoomId: 'room_townhall_2026',
    });

    assert.equal(claims.sub, 'usr_speaker_1');
    assert.equal(claims.email, 'speaker@example.com');
    assert.equal(claims.roomId, 'room_townhall_2026');
    assert.equal(claims.tenantId, 'org_acme');
    assert.equal(claims.role, 'host');
    assert.deepEqual(claims.permissions, DEFAULT_ROLE_PERMISSIONS.host);
    assert.equal(claims.iss, 'meetlite-origin');
    assert.equal(claims.aud, 'meetlite-edge-coordinator');
    assert.ok(claims.jti.startsWith('cap_'));
    assert.ok(claims.exp > claims.iat);
  });

  it('interoperates directly with WebCrypto SubtleCrypto (Cloudflare Worker runtime parity)', async () => {
    const service = new AsymmetricCapabilityService();
    const token = service.issueRoomCapability({
      sub: 'usr_worker_participant',
      roomId: 'room_edge_fast',
      role: 'participant',
      ttlSeconds: 60,
    });

    const jwk = service.getPublicKeyJwk();

    // Verify via SubtleCrypto (same API as Cloudflare Workers)
    const verifiedClaims = await AsymmetricCapabilityService.verifyWithWebCrypto(token, jwk, {
      expectedRoomId: 'room_edge_fast',
    });

    assert.equal(verifiedClaims.sub, 'usr_worker_participant');
    assert.equal(verifiedClaims.roomId, 'room_edge_fast');
    assert.equal(verifiedClaims.role, 'participant');
    assert.ok(verifiedClaims.permissions.includes('publish_audio'));
    assert.ok(verifiedClaims.permissions.includes('publish_video'));
    assert.ok(verifiedClaims.permissions.includes('subscribe'));
  });

  it('rejects tampered payload bytes (adversarial drill: role elevation attempt)', () => {
    const service = new AsymmetricCapabilityService();
    const token = service.issueRoomCapability({
      sub: 'usr_tamper',
      roomId: 'room_secure',
      role: 'viewer', // viewer cannot moderate or publish
      ttlSeconds: 300,
    });

    const [headerB64, payloadB64, sigB64] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    // Attacker modifies payload to grant themselves host role and all permissions
    payload.role = 'host';
    payload.permissions = ['publish_audio', 'publish_video', 'moderate', 'record'];
    const tamperedPayloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');

    const tamperedToken = `${headerB64}.${tamperedPayloadB64}.${sigB64}`;

    assert.throws(
      () => service.verifyRoomCapability(tamperedToken),
      (err: any) => err instanceof InvalidCapabilitySignatureError
    );
  });

  it('rejects corrupted signature bytes', () => {
    const service = new AsymmetricCapabilityService();
    const token = service.issueRoomCapability({
      sub: 'usr_sig_test',
      roomId: 'room_sig',
    });

    const [headerB64, payloadB64, sigB64] = token.split('.');
    // Corrupt signature in the middle of base64url payload
    const corruptedChar = sigB64[10] === 'x' ? 'y' : 'x';
    const corruptedSig = sigB64.slice(0, 10) + corruptedChar + sigB64.slice(11);
    const corruptedToken = `${headerB64}.${payloadB64}.${corruptedSig}`;

    assert.throws(
      () => service.verifyRoomCapability(corruptedToken),
      (err: any) => err instanceof InvalidCapabilitySignatureError
    );
  });

  it('rejects expired capability tokens', () => {
    const service = new AsymmetricCapabilityService();
    const token = service.issueRoomCapability({
      sub: 'usr_expired',
      roomId: 'room_exp',
      ttlSeconds: 10,
    });

    // Simulate verification 15 seconds later
    const futureTime = Math.floor(Date.now() / 1000) + 20;

    assert.throws(
      () => service.verifyRoomCapability(token, { nowSeconds: futureTime }),
      (err: any) => err instanceof ExpiredCapabilityError
    );
  });

  it('enforces room-scope isolation (rejects cross-room capability replay)', () => {
    const service = new AsymmetricCapabilityService();
    const token = service.issueRoomCapability({
      sub: 'usr_room_a',
      roomId: 'room_conf_alpha',
    });

    // Attacker tries to use room_conf_alpha capability to enter room_conf_beta
    assert.throws(
      () => service.verifyRoomCapability(token, { expectedRoomId: 'room_conf_beta' }),
      (err: any) => err instanceof RoomMismatchError
    );
  });

  it('rejects audience mismatch', () => {
    const service = new AsymmetricCapabilityService();
    const token = service.issueRoomCapability({
      sub: 'usr_aud',
      roomId: 'room_aud',
    });

    assert.throws(
      () => service.verifyRoomCapability(token, { expectedAudience: 'wrong-audience' }),
      (err: any) => err instanceof CapabilityTokenError && err.code === 'AUDIENCE_MISMATCH'
    );
  });

  it('rejects issuer mismatch even when signature and audience are valid', async () => {
    const keyPair = generateEd25519KeyPair('wrong-issuer-kid');
    const wrongIssuer = new AsymmetricCapabilityService({
      privateKeyPem: keyPair.privateKeyPem,
      issuer: 'untrusted-issuer',
    });
    const token = wrongIssuer.issueRoomCapability({
      sub: 'usr_wrong_issuer',
      roomId: 'room_secure',
    });

    assert.throws(
      () => wrongIssuer.verifyRoomCapability(token, { expectedIssuer: 'meetlite-origin' }),
      /Issuer mismatch/
    );
    await assert.rejects(
      AsymmetricCapabilityService.verifyWithWebCrypto(token, keyPair.publicKeyJwk),
      /Issuer mismatch/
    );
  });

  it('rejects malformed tokens', () => {
    const service = new AsymmetricCapabilityService();
    assert.throws(
      () => service.verifyRoomCapability('not-even-a-jwt'),
      (err: any) => err instanceof MalformedCapabilityError
    );
    assert.throws(
      () => service.verifyRoomCapability('part1.part2'),
      (err: any) => err instanceof MalformedCapabilityError
    );
    assert.throws(
      () => service.verifyRoomCapability(''),
      (err: any) => err instanceof MalformedCapabilityError
    );
  });

  it('exports compliant JWKS format for public key discovery by edge nodes', () => {
    const service = new AsymmetricCapabilityService({ keyId: 'edge-key-prod-1' });
    const jwks = service.exportJwks();

    assert.ok(Array.isArray(jwks.keys));
    assert.equal(jwks.keys.length, 1);
    const key = jwks.keys[0];
    assert.equal(key.kty, 'OKP');
    assert.equal(key.crv, 'Ed25519');
    assert.equal(key.kid, 'edge-key-prod-1');
    assert.equal(key.use, 'sig');
    assert.equal(key.alg, 'EdDSA');
    assert.ok(key.x.length > 20);
  });
});
