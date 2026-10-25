/**
 * Phase 4 / S4-01 / R4-01: Request-Bound Identity Assertion & Edge Ingress Contract
 *
 * Verifies Ed25519 request-bound assertion signing, path/method tampering rejection,
 * zero-downtime overlapping key rotation, and client identity header stripping.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateAssertionKeyPair,
  signInternalRequestAssertion,
  verifyInternalRequestAssertion,
  AssertionKeyStore,
  RequestIdentity,
  normalizeRequestPath,
  InMemoryAssertionReplayStore,
} from '../auth/request-assertion.js';
import { createVerifiedPrincipal } from '../auth/principal.js';
import {
  createIdentityStrippingMiddleware,
  stripHeadersFromProxyReq,
  UNTRUSTED_IDENTITY_HEADERS,
} from '../auth/identity-stripping.js';

describe('S4-01: Request-Bound Identity Assertion & Zero-Trust Ingress Contract', () => {
  const principal = createVerifiedPrincipal({
    id: 'usr-charlie-456',
    email: 'charlie@meetlite.dev',
    orgId: 'org-tenant-corp',
    role: 'admin',
    tokenVersion: 2,
  });

  const keyPair = generateAssertionKeyPair('key-2026-v1');
  const keyStore = new AssertionKeyStore();
  keyStore.setKey(keyPair.kid, keyPair.publicKeyPem, 'active');

  const baseRequest: RequestIdentity = {
    method: 'GET',
    path: '/api/v1/meetings/room-xyz',
    correlationId: 'req-corr-999-abc',
  };

  describe('Cryptographic Signing & Verification Parity', () => {
    test('signs and verifies assertion, reconstructing immutable VerifiedPrincipal', () => {
      const token = signInternalRequestAssertion(principal, baseRequest, keyPair.privateKeyPem, {
        kid: keyPair.kid,
        ttlSeconds: 60,
      });

      assert.ok(typeof token === 'string' && token.split('.').length === 3);

      const verified = verifyInternalRequestAssertion(token, baseRequest, keyStore);

      assert.equal(verified.userId, principal.userId);
      assert.equal(verified.email, principal.email);
      assert.equal(verified.orgId, principal.orgId);
      assert.equal(verified.role, principal.role);
      assert.equal(verified.tokenVersion, principal.tokenVersion);
    });

    test('path normalization strips query parameters, hashes, and trailing slashes', () => {
      assert.equal(normalizeRequestPath('/api/v1/rooms?filter=active#tag'), '/api/v1/rooms');
      assert.equal(normalizeRequestPath('/api/v1/rooms/'), '/api/v1/rooms');
      assert.equal(normalizeRequestPath('///api///v1//rooms//'), '/api/v1/rooms');
      assert.equal(normalizeRequestPath('/'), '/');
    });
  });

  describe('Adversarial Drills: Request-Binding & Tampering Defenses', () => {
    test('adversarial drill: method tampering (replaying GET assertion on DELETE) is rejected', () => {
      const token = signInternalRequestAssertion(principal, baseRequest, keyPair.privateKeyPem, {
        kid: keyPair.kid,
      });

      const tamperedRequest: RequestIdentity = {
        ...baseRequest,
        method: 'DELETE',
      };

      assert.throws(
        () => {
          verifyInternalRequestAssertion(token, tamperedRequest, keyStore);
        },
        /Request method tampering detected: assertion signed for GET, but request is DELETE/
      );
    });

    test('adversarial drill: path tampering (replaying assertion on unauthorized route) is rejected', () => {
      const token = signInternalRequestAssertion(principal, baseRequest, keyPair.privateKeyPem, {
        kid: keyPair.kid,
      });

      const tamperedRequest: RequestIdentity = {
        ...baseRequest,
        path: '/api/v1/admin/billing/elevate',
      };

      assert.throws(
        () => {
          verifyInternalRequestAssertion(token, tamperedRequest, keyStore);
        },
        /Request path tampering detected/
      );
    });

    test('adversarial drill: correlation ID tampering is rejected', () => {
      const token = signInternalRequestAssertion(principal, baseRequest, keyPair.privateKeyPem, {
        kid: keyPair.kid,
      });

      const tamperedRequest: RequestIdentity = {
        ...baseRequest,
        correlationId: 'attacker-forged-corr-id',
      };

      assert.throws(
        () => {
          verifyInternalRequestAssertion(token, tamperedRequest, keyStore);
        },
        /Request correlationId tampering detected/
      );
    });

    test('missing correlation ID fails closed instead of disabling request binding', () => {
      const token = signInternalRequestAssertion(principal, baseRequest, keyPair.privateKeyPem, {
        kid: keyPair.kid,
      });
      assert.throws(
        () => verifyInternalRequestAssertion(token, { ...baseRequest, correlationId: '' }, keyStore),
        /correlationId is required/
      );
      assert.throws(
        () => signInternalRequestAssertion(principal, { ...baseRequest, correlationId: '' }, keyPair.privateKeyPem),
        /without a correlation ID/
      );
    });

    test('adversarial drill: assertion replay within TTL is detected and rejected', () => {
      const token = signInternalRequestAssertion(principal, baseRequest, keyPair.privateKeyPem, {
        kid: keyPair.kid,
        ttlSeconds: 60,
      });

      const replayStore = new InMemoryAssertionReplayStore();

      // First verification succeeds
      const principal1 = verifyInternalRequestAssertion(token, baseRequest, keyStore, { replayStore });
      assert.equal(principal1.userId, principal.userId);

      // Replay attempt with exact same token is rejected
      assert.throws(
        () => {
          verifyInternalRequestAssertion(token, baseRequest, keyStore, { replayStore });
        },
        /Assertion replay detected: jti assert-.* has already been consumed/
      );
    });

    test('adversarial drill: expired assertion is rejected', () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredToken = signInternalRequestAssertion(principal, baseRequest, keyPair.privateKeyPem, {
        kid: keyPair.kid,
        ttlSeconds: 10,
        clockNowSeconds: now - 30, // Issued 30s ago with 10s TTL -> expired
      });

      assert.throws(
        () => {
          verifyInternalRequestAssertion(expiredToken, baseRequest, keyStore, { clockToleranceSeconds: 0 });
        },
        /Assertion has expired/
      );
    });

    test('adversarial drill: forged or corrupted signature is rejected', () => {
      const token = signInternalRequestAssertion(principal, baseRequest, keyPair.privateKeyPem, {
        kid: keyPair.kid,
      });

      const [header, payload, sig] = token.split('.');
      // Tamper signature byte
      const corruptedSig = sig.slice(0, 10) + (sig[10] === 'a' ? 'b' : 'a') + sig.slice(11);
      const forgedToken = `${header}.${payload}.${corruptedSig}`;

      assert.throws(
        () => {
          verifyInternalRequestAssertion(forgedToken, baseRequest, keyStore);
        },
        /Invalid assertion signature/
      );
    });

    test('adversarial drill: audience mismatch is rejected', () => {
      const token = signInternalRequestAssertion(principal, baseRequest, keyPair.privateKeyPem, {
        kid: keyPair.kid,
      });

      assert.throws(
        () => {
          verifyInternalRequestAssertion(token, baseRequest, keyStore, {
            allowedAudiences: ['meetlite-other-service'],
          });
        },
        /Audience mismatch/
      );
    });
  });

  describe('Zero-Downtime Overlapping Key Rotation', () => {
    test('supports seamless verification during key overlap and rejects after retirement', () => {
      const keyStoreRotating = new AssertionKeyStore();

      // Generation 1 key
      const keyPairGen1 = generateAssertionKeyPair('key-gen-1');
      keyStoreRotating.setKey(keyPairGen1.kid, keyPairGen1.publicKeyPem, 'active');

      const tokenGen1 = signInternalRequestAssertion(principal, baseRequest, keyPairGen1.privateKeyPem, {
        kid: keyPairGen1.kid,
      });
      assert.ok(verifyInternalRequestAssertion(tokenGen1, baseRequest, keyStoreRotating));

      // Phase 1 Rotation: Introduce Generation 2 as active, mark Generation 1 as retiring
      const keyPairGen2 = generateAssertionKeyPair('key-gen-2');
      keyStoreRotating.setKey(keyPairGen2.kid, keyPairGen2.publicKeyPem, 'active');
      keyStoreRotating.setKey(keyPairGen1.kid, keyPairGen1.publicKeyPem, 'retiring');

      const tokenGen2 = signInternalRequestAssertion(principal, baseRequest, keyPairGen2.privateKeyPem, {
        kid: keyPairGen2.kid,
      });

      // BOTH tokens valid during overlap window
      assert.ok(verifyInternalRequestAssertion(tokenGen1, baseRequest, keyStoreRotating));
      assert.ok(verifyInternalRequestAssertion(tokenGen2, baseRequest, keyStoreRotating));

      // Phase 2 Rotation: Retire Generation 1 completely
      keyStoreRotating.retireKey(keyPairGen1.kid);

      // Gen 2 still valid
      assert.ok(verifyInternalRequestAssertion(tokenGen2, baseRequest, keyStoreRotating));

      // Gen 1 is now rejected
      assert.throws(
        () => {
          verifyInternalRequestAssertion(tokenGen1, baseRequest, keyStoreRotating);
        },
        /Assertion signed with unknown or retired key ID: key-gen-1/
      );
    });
  });

  describe('Edge Ingress Header Stripping Middleware Contract', () => {
    test('createIdentityStrippingMiddleware removes all spoofable identity headers from req.headers', () => {
      const middleware = createIdentityStrippingMiddleware();

      const req: any = {
        headers: {
          'x-user-id': 'spoofed-attacker-id',
          'x-user-role': 'superadmin',
          'x-org-id': 'victim-org-123',
          'x-verified-principal': 'corrupted-payload',
          'x-meetlite-internal-assertion': 'forged-assertion',
          'content-type': 'application/json',
          'authorization': 'Bearer token123',
        },
      };
      const res: any = {};
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.ok(nextCalled);
      assert.equal(req.headers['x-user-id'], undefined);
      assert.equal(req.headers['x-user-role'], undefined);
      assert.equal(req.headers['x-org-id'], undefined);
      assert.equal(req.headers['x-verified-principal'], undefined);
      assert.equal(req.headers['x-meetlite-internal-assertion'], undefined);
      // Legitimate headers preserved
      assert.equal(req.headers['content-type'], 'application/json');
      assert.equal(req.headers['authorization'], 'Bearer token123');
    });

    test('stripHeadersFromProxyReq removes headers from outgoing proxy requests', () => {
      const removed: string[] = [];
      const fakeProxyReq: any = {
        removeHeader: (name: string) => {
          removed.push(name.toLowerCase());
        },
      };

      stripHeadersFromProxyReq(fakeProxyReq);

      for (const h of UNTRUSTED_IDENTITY_HEADERS) {
        assert.ok(removed.includes(h.toLowerCase()), `Expected ${h} to be removed by proxy hook`);
      }
    });
  });
});
