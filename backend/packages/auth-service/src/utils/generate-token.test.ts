import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { generateJWTToken } from './generate-token.js';

describe('Auth Characterization: generateJWTToken', () => {
  const TEST_SECRET = 'test_secret_for_characterization_1234567890';
  let originalSecret: string | undefined;

  before(() => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_SECRET;
  });

  after(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it('generates a valid JWT token with default fallback claims', () => {
    const user = {
      id: 'usr_test_123',
      email: 'test@meetlite.dev',
    };

    const token = generateJWTToken(user);
    assert.ok(typeof token === 'string' && token.length > 0, 'Token should be a non-empty string');

    const decoded = jwt.verify(token, TEST_SECRET) as any;
    assert.strictEqual(decoded.userId, 'usr_test_123');
    assert.strictEqual(decoded.email, 'test@meetlite.dev');
    assert.strictEqual(decoded.organizationId, null);
    assert.strictEqual(decoded.role, 'owner');
    assert.strictEqual(decoded.tokenVersion, 1);
    assert.strictEqual(decoded.isSystemAdmin, false);
    assert.ok(decoded.exp > decoded.iat, 'Token should have future expiration');
    assert.strictEqual(decoded.exp - decoded.iat, 900, 'Token must expire in exactly 15 minutes (900 seconds)');
  });

  it('preserves custom role, organizationId, tokenVersion, and system admin flag', () => {
    const user = {
      _id: 'usr_mongo_style_456',
      email: 'admin@meetlite.dev',
      organizationId: 'org_enterprise_789',
      role: 'admin',
      tokenVersion: 3,
      isSystemAdmin: true,
    };

    const token = generateJWTToken(user);
    const decoded = jwt.verify(token, TEST_SECRET) as any;

    assert.strictEqual(decoded.userId, 'usr_mongo_style_456');
    assert.strictEqual(decoded.email, 'admin@meetlite.dev');
    assert.strictEqual(decoded.organizationId, 'org_enterprise_789');
    assert.strictEqual(decoded.role, 'admin');
    assert.strictEqual(decoded.tokenVersion, 3);
    assert.strictEqual(decoded.isSystemAdmin, true);
  });

  it('rejects verification if signed with a different secret', () => {
    const token = generateJWTToken({ id: 'usr_test_123', email: 'test@meetlite.dev' });
    assert.throws(
      () => jwt.verify(token, 'wrong_secret_1234567890'),
      /invalid signature/
    );
  });
});
