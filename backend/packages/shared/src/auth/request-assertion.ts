/**
 * Request-Bound Internal Assertion Engine
 *
 * Implements S4-01 / R4-01: Cryptographically signed, short-lived, request-bound
 * assertions between Cloudflare Edge Workers / Tunnels and origin backend services.
 * Binds identity strictly to HTTP method, normalized path, correlation ID, and audience.
 */

import crypto from 'crypto';
import { VerifiedPrincipal, createVerifiedPrincipal } from './principal.js';

export const ASSERTION_ISSUER = 'meetlite-edge';
export const ASSERTION_AUDIENCE = 'meetlite-origin';
export const DEFAULT_ASSERTION_TTL_SECONDS = 60; // 1-minute lifetime
export const DEFAULT_CLOCK_TOLERANCE_SECONDS = 10;

export interface RequestIdentity {
  readonly method: string;
  readonly path: string;
  readonly correlationId: string;
  readonly clientIp?: string;
}

export interface InternalAssertionClaims {
  readonly iss: string;
  readonly aud: string;
  readonly sub: string; // userId
  readonly email?: string;
  readonly orgId?: string | null;
  readonly role?: string;
  readonly tokenVersion?: number;
  readonly method: string; // uppercase HTTP method e.g. 'GET', 'POST'
  readonly path: string; // normalized path e.g. '/api/v1/rooms'
  readonly reqId: string; // correlation ID
  readonly jti: string; // unique assertion ID
  readonly iat: number; // unix timestamp in seconds
  readonly exp: number; // unix timestamp in seconds
  readonly kid?: string; // Key ID for zero-downtime key rotation
}

export interface IAssertionReplayStore {
  /**
   * Checks whether the given jti has been consumed, and marks it as consumed if fresh.
   * Returns true if newly consumed (fresh assertion), false if already seen (replay attempt).
   */
  checkAndSet(jti: string, expTimestampSeconds: number): boolean;
}

export class InMemoryAssertionReplayStore implements IAssertionReplayStore {
  private readonly seen = new Map<string, number>();

  public checkAndSet(jti: string, expTimestampSeconds: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    this.cleanup(now);
    if (this.seen.has(jti)) {
      return false;
    }
    this.seen.set(jti, expTimestampSeconds);
    return true;
  }

  public cleanup(nowSeconds = Math.floor(Date.now() / 1000)): void {
    for (const [jti, exp] of this.seen.entries()) {
      if (exp <= nowSeconds) {
        this.seen.delete(jti);
      }
    }
  }

  public clear(): void {
    this.seen.clear();
  }
}

export interface AssertionVerifyOptions {
  readonly clockToleranceSeconds?: number;
  readonly allowedAudiences?: readonly string[];
  readonly replayStore?: IAssertionReplayStore;
}

export type KeyStatus = 'active' | 'retiring' | 'retired';

export interface KeyEntry {
  readonly kid: string;
  readonly key: string | crypto.KeyObject;
  readonly status: KeyStatus;
  readonly addedAt: number;
}

/**
 * Key store supporting overlapping key rotation
 */
export class AssertionKeyStore {
  private readonly keys = new Map<string, KeyEntry>();

  public setKey(kid: string, key: string | crypto.KeyObject, status: KeyStatus = 'active'): void {
    this.keys.set(kid, {
      kid,
      key,
      status,
      addedAt: Date.now(),
    });
  }

  public getKey(kid: string): KeyEntry | undefined {
    return this.keys.get(kid);
  }

  public retireKey(kid: string): void {
    const entry = this.keys.get(kid);
    if (entry) {
      this.keys.set(kid, { ...entry, status: 'retired' });
    }
  }

  public removeKey(kid: string): boolean {
    return this.keys.delete(kid);
  }

  public getActiveOrRetiringKey(kid: string): (string | crypto.KeyObject) | null {
    const entry = this.keys.get(kid);
    if (!entry || entry.status === 'retired') {
      return null;
    }
    return entry.key;
  }
}

/**
 * Normalizes HTTP paths for deterministic request-binding
 * Strips query parameters, trailing slashes, and redundant slashes
 */
export function normalizeRequestPath(rawPath: string): string {
  if (!rawPath) return '/';
  const withoutQuery = rawPath.split('?')[0].split('#')[0];
  const collapsed = withoutQuery.replace(/\/+/g, '/');
  if (collapsed.length > 1 && collapsed.endsWith('/')) {
    return collapsed.slice(0, -1);
  }
  return collapsed;
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(input: string): Buffer {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
}

/**
 * Generates an Ed25519 key pair for internal assertion signing
 */
export function generateAssertionKeyPair(kid?: string): {
  kid: string;
  publicKeyPem: string;
  privateKeyPem: string;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  return {
    kid: kid || `assert-key-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    publicKeyPem: publicKey,
    privateKeyPem: privateKey,
  };
}

/**
 * Signs an internal request-bound assertion
 */
export function signInternalRequestAssertion(
  principal: VerifiedPrincipal,
  request: RequestIdentity,
  privateKeyPem: string,
  options?: {
    kid?: string;
    ttlSeconds?: number;
    clockNowSeconds?: number;
  }
): string {
  if (!request.correlationId || !request.correlationId.trim()) {
    throw new Error('Cannot sign internal assertion without a correlation ID');
  }
  const now = options?.clockNowSeconds !== undefined ? options.clockNowSeconds : Math.floor(Date.now() / 1000);
  const ttl = options?.ttlSeconds || DEFAULT_ASSERTION_TTL_SECONDS;
  const kid = options?.kid;

  const header = {
    alg: 'EdDSA',
    typ: 'JWT',
    kid,
  };

  const claims: InternalAssertionClaims = {
    iss: ASSERTION_ISSUER,
    aud: ASSERTION_AUDIENCE,
    sub: principal.userId,
    email: principal.email,
    orgId: principal.orgId,
    role: principal.role,
    tokenVersion: principal.tokenVersion,
    method: request.method.toUpperCase(),
    path: normalizeRequestPath(request.path),
    reqId: request.correlationId,
    jti: `assert-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
    iat: now,
    exp: now + ttl,
    kid,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = crypto.sign(null, Buffer.from(signingInput, 'utf8'), privateKeyPem);
  const signatureB64 = base64UrlEncode(signature);

  return `${signingInput}.${signatureB64}`;
}

/**
 * Verifies an internal request-bound assertion and checks all request-binding constraints
 */
export function verifyInternalRequestAssertion(
  token: string,
  request: RequestIdentity,
  keyStore: AssertionKeyStore,
  options?: AssertionVerifyOptions
): VerifiedPrincipal {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid assertion: token must be a non-empty string');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed assertion: expected 3 JWT components');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string; typ?: string; kid?: string };
  let claims: InternalAssertionClaims;

  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString('utf8'));
    claims = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'));
  } catch {
    throw new Error('Malformed assertion: header or payload is not valid JSON');
  }

  if (header.alg !== 'EdDSA') {
    throw new Error(`Unsupported algorithm: ${header.alg}`);
  }

  if (!header.kid) {
    throw new Error('Missing key ID (kid) in assertion header');
  }

  const key = keyStore.getActiveOrRetiringKey(header.kid);
  if (!key) {
    throw new Error(`Assertion signed with unknown or retired key ID: ${header.kid}`);
  }

  // Cryptographic signature verification
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = base64UrlDecode(signatureB64);
  const isValidSig = crypto.verify(null, Buffer.from(signingInput, 'utf8'), key, signature);

  if (!isValidSig) {
    throw new Error('Invalid assertion signature');
  }

  // Audience verification
  const allowedAudiences = options?.allowedAudiences || [ASSERTION_AUDIENCE];
  if (!allowedAudiences.includes(claims.aud)) {
    throw new Error(`Audience mismatch: expected ${allowedAudiences.join(', ')}, got ${claims.aud}`);
  }

  // Issuer verification
  if (claims.iss !== ASSERTION_ISSUER) {
    throw new Error(`Issuer mismatch: expected ${ASSERTION_ISSUER}, got ${claims.iss}`);
  }

  // Expiration check
  const now = Math.floor(Date.now() / 1000);
  const tolerance = options?.clockToleranceSeconds ?? DEFAULT_CLOCK_TOLERANCE_SECONDS;

  if (claims.exp + tolerance < now) {
    throw new Error('Assertion has expired');
  }

  if (claims.iat - tolerance > now) {
    throw new Error('Assertion issued in the future (clock skew violation)');
  }

  // HTTP Method binding check
  const normalizedMethod = request.method.toUpperCase();
  if (claims.method !== normalizedMethod) {
    throw new Error(`Request method tampering detected: assertion signed for ${claims.method}, but request is ${normalizedMethod}`);
  }

  // Path binding check
  const normalizedPath = normalizeRequestPath(request.path);
  if (claims.path !== normalizedPath) {
    throw new Error(`Request path tampering detected: assertion signed for ${claims.path}, but request path is ${normalizedPath}`);
  }

  // Correlation ID binding check
  if (!request.correlationId || !request.correlationId.trim()) {
    throw new Error('Request correlationId is required for assertion verification');
  }
  if (claims.reqId !== request.correlationId) {
    throw new Error(`Request correlationId tampering detected: assertion signed for ${claims.reqId}, but request correlationId is ${request.correlationId}`);
  }

  // Replay check
  if (options?.replayStore) {
    const isFresh = options.replayStore.checkAndSet(claims.jti, claims.exp);
    if (!isFresh) {
      throw new Error(`Assertion replay detected: jti ${claims.jti} has already been consumed`);
    }
  }

  // Map to immutable VerifiedPrincipal
  return createVerifiedPrincipal({
    id: claims.sub,
    email: claims.email || '',
    orgId: claims.orgId || null,
    role: claims.role || 'member',
    tokenVersion: claims.tokenVersion || 1,
  });
}
