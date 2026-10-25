import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AsymmetricCapabilityService,
  createVerifiedPrincipal,
  generateEd25519KeyPair,
} from '@minimeet/shared';
import { issueRoomCapability, normalizeRoomTier } from './room-capability.service.js';

const originalPrivateKey = process.env.CAPABILITY_PRIVATE_KEY;

afterEach(() => {
  if (originalPrivateKey === undefined) delete process.env.CAPABILITY_PRIVATE_KEY;
  else process.env.CAPABILITY_PRIVATE_KEY = originalPrivateKey;
});

describe('room capability issuance boundary', () => {
  it('fails closed when the origin signing key is not configured', () => {
    delete process.env.CAPABILITY_PRIVATE_KEY;
    assert.throws(
      () => issueRoomCapability(createVerifiedPrincipal({ userId: 'usr_1' }), 'room_1', 'host', 'free'),
      /CAPABILITY_PRIVATE_KEY is required/
    );
  });

  it('issues a room-scoped Ed25519 capability from the verified principal', () => {
    const keyPair = generateEd25519KeyPair('room-origin-test');
    process.env.CAPABILITY_PRIVATE_KEY = keyPair.privateKeyPem.replace(/\n/g, '\\n');
    const principal = createVerifiedPrincipal({
      userId: 'usr_issuer',
      organizationId: 'org_issuer',
      role: 'member',
    });

    const token = issueRoomCapability(principal, 'room_issuer', 'moderator', 'pro');
    delete process.env.CAPABILITY_PRIVATE_KEY;
    const verifier = new AsymmetricCapabilityService({ publicKeyJwk: keyPair.publicKeyJwk });
    const claims = verifier.verifyRoomCapability(token, { expectedRoomId: 'room_issuer' });

    assert.equal(claims.sub, 'usr_issuer');
    assert.equal(claims.tenantId, 'org_issuer');
    assert.equal(claims.role, 'moderator');
    assert.equal(claims.tier, 'pro');
  });

  it('normalizes unknown billing plans to the restrictive free tier', () => {
    assert.equal(normalizeRoomTier('enterprise'), 'enterprise');
    assert.equal(normalizeRoomTier('pro'), 'pro');
    assert.equal(normalizeRoomTier('legacy'), 'free');
    assert.equal(normalizeRoomTier(undefined), 'free');
  });
});
