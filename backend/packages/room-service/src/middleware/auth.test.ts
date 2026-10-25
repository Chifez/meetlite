import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { verifyToken, AuthenticatedRequest } from './auth.js';

describe('Room-Service Characterization: verifyToken middleware', () => {
  const TEST_SECRET = 'room_service_test_secret_9876543210';
  let originalSecret: string | undefined;

  before(() => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_SECRET;
  });

  after(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  function createMockRes() {
    const res: any = {
      statusCode: 200,
      body: null,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: any) {
        this.body = data;
        return this;
      },
    };
    return res;
  }

  it('authenticates valid token from Authorization Bearer header', () => {
    const payload = { userId: 'u123', email: 'u123@meetlite.dev', role: 'member' };
    const token = jwt.sign(payload, TEST_SECRET);

    const req: any = {
      headers: { authorization: `Bearer ${token}` },
      query: {},
    };
    const res = createMockRes();
    let nextCalled = false;

    verifyToken(req as AuthenticatedRequest, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.user.userId, 'u123');
    assert.equal(req.user.email, 'u123@meetlite.dev');
    assert.equal(req.user.role, 'member');
  });

  it('authenticates token from query parameter when header is absent', () => {
    const payload = { userId: 'u456', email: 'guest@meetlite.dev' };
    const token = jwt.sign(payload, TEST_SECRET);

    const req: any = {
      headers: {},
      query: { token },
    };
    const res = createMockRes();
    let nextCalled = false;

    verifyToken(req as AuthenticatedRequest, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.user.userId, 'u456');
  });

  it('returns 401 when no token is provided', () => {
    const req: any = {
      headers: {},
      query: {},
    };
    const res = createMockRes();
    let nextCalled = false;

    verifyToken(req as AuthenticatedRequest, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { message: 'No token provided' });
  });

  it('returns 401 when token is invalid or tampered', () => {
    const req: any = {
      headers: { authorization: 'Bearer invalid.tampered.token' },
      query: {},
    };
    const res = createMockRes();
    let nextCalled = false;

    verifyToken(req as AuthenticatedRequest, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { message: 'Invalid token' });
  });

  it('returns 401 when token is expired', () => {
    const expiredToken = jwt.sign({ userId: 'u789' }, TEST_SECRET, { expiresIn: '0s' });
    const req: any = {
      headers: { authorization: `Bearer ${expiredToken}` },
      query: {},
    };
    const res = createMockRes();
    let nextCalled = false;

    verifyToken(req as AuthenticatedRequest, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { message: 'Invalid token' });
  });
});
