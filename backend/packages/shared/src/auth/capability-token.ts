import crypto from 'crypto';
import { VerifiedPrincipal } from './principal.js';

export type RoomPermission =
  | 'publish_audio'
  | 'publish_video'
  | 'publish_screen'
  | 'subscribe'
  | 'chat'
  | 'moderate'
  | 'record';

export type ParticipantRoomRole = 'host' | 'moderator' | 'participant' | 'viewer' | 'recorder';

export const ALL_ROOM_PERMISSIONS: readonly RoomPermission[] = Object.freeze([
  'publish_audio',
  'publish_video',
  'publish_screen',
  'subscribe',
  'chat',
  'moderate',
  'record',
]);

export const DEFAULT_ROLE_PERMISSIONS: Readonly<Record<ParticipantRoomRole, readonly RoomPermission[]>> = Object.freeze({
  host: ALL_ROOM_PERMISSIONS,
  moderator: Object.freeze<RoomPermission[]>([
    'publish_audio',
    'publish_video',
    'publish_screen',
    'subscribe',
    'chat',
    'moderate',
  ]),
  participant: Object.freeze<RoomPermission[]>([
    'publish_audio',
    'publish_video',
    'publish_screen',
    'subscribe',
    'chat',
  ]),
  viewer: Object.freeze<RoomPermission[]>(['subscribe', 'chat']),
  recorder: Object.freeze<RoomPermission[]>(['subscribe', 'record']),
});

export const CAPABILITY_ISSUER = 'meetlite-origin';
export const CAPABILITY_AUDIENCE = 'meetlite-edge-coordinator';
export const DEFAULT_CAPABILITY_TTL_SECONDS = 300; // 5 minutes

export type RoomTier = 'free' | 'pro' | 'enterprise';

export interface RoomCapabilityClaims {
  readonly sub: string; // userId
  readonly email?: string;
  readonly roomId: string;
  readonly tenantId: string | null;
  readonly role: ParticipantRoomRole;
  readonly permissions: readonly RoomPermission[];
  readonly tier?: RoomTier;
  readonly jti: string;
  readonly iat: number;
  readonly exp: number;
  readonly iss: string;
  readonly aud: string;
}

export interface Ed25519JwkPublicKey {
  kty: 'OKP';
  crv: 'Ed25519';
  x: string;
  kid?: string;
  use?: 'sig';
  alg?: 'EdDSA';
}

export interface JwksResponse {
  keys: Ed25519JwkPublicKey[];
}

export class CapabilityTokenError extends Error {
  readonly code: string;
  constructor(message: string, code = 'CAPABILITY_TOKEN_ERROR') {
    super(message);
    this.name = 'CapabilityTokenError';
    this.code = code;
  }
}

export class ExpiredCapabilityError extends CapabilityTokenError {
  constructor(message = 'Capability token has expired') {
    super(message, 'EXPIRED_CAPABILITY');
    this.name = 'ExpiredCapabilityError';
  }
}

export class InvalidCapabilitySignatureError extends CapabilityTokenError {
  constructor(message = 'Invalid capability token signature') {
    super(message, 'INVALID_SIGNATURE');
    this.name = 'InvalidCapabilitySignatureError';
  }
}

export class RoomMismatchError extends CapabilityTokenError {
  constructor(message = 'Capability token roomId does not match target room') {
    super(message, 'ROOM_MISMATCH');
    this.name = 'RoomMismatchError';
  }
}

export class MalformedCapabilityError extends CapabilityTokenError {
  constructor(message = 'Malformed capability token structure') {
    super(message, 'MALFORMED_CAPABILITY');
    this.name = 'MalformedCapabilityError';
  }
}

function base64UrlEncode(buffer: Buffer | Uint8Array): string {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): Buffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
}

export interface KeyPairResult {
  privateKeyPem: string;
  publicKeyPem: string;
  publicKeyJwk: Ed25519JwkPublicKey;
  keyId: string;
}

export function generateEd25519KeyPair(kid?: string): KeyPairResult {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const rawJwk = publicKey.export({ format: 'jwk' }) as { crv: string; x: string; kty: string };
  const keyId = kid || `key_${crypto.randomUUID().slice(0, 8)}`;

  const publicKeyJwk: Ed25519JwkPublicKey = {
    kty: 'OKP',
    crv: 'Ed25519',
    x: rawJwk.x,
    kid: keyId,
    use: 'sig',
    alg: 'EdDSA',
  };

  return {
    privateKeyPem,
    publicKeyPem,
    publicKeyJwk,
    keyId,
  };
}

export interface AsymmetricCapabilityOptions {
  privateKeyPem?: string;
  publicKeyPem?: string;
  publicKeyJwk?: Ed25519JwkPublicKey;
  keyId?: string;
  issuer?: string;
  audience?: string;
  defaultTtlSeconds?: number;
}

export interface IssueCapabilityInput {
  sub: string;
  email?: string;
  roomId: string;
  tenantId?: string | null;
  role?: ParticipantRoomRole;
  permissions?: readonly RoomPermission[];
  tier?: RoomTier;
  ttlSeconds?: number;
  jti?: string;
}

export interface VerifyCapabilityOptions {
  expectedRoomId?: string;
  expectedAudience?: string;
  expectedIssuer?: string;
  nowSeconds?: number;
}

function validateCapabilityClaims(payload: any, options: VerifyCapabilityOptions, now: number): void {
  const expectedIssuer = options.expectedIssuer ?? CAPABILITY_ISSUER;
  if (payload.iss !== expectedIssuer) {
    throw new CapabilityTokenError(
      `Issuer mismatch: expected ${expectedIssuer}, got ${payload.iss}`,
      'ISSUER_MISMATCH'
    );
  }
  if (typeof payload.iat !== 'number' || payload.iat > now + 30) {
    throw new CapabilityTokenError('Capability has an invalid issued-at time', 'INVALID_IAT');
  }
  if (typeof payload.sub !== 'string' || !payload.sub || typeof payload.jti !== 'string' || !payload.jti) {
    throw new MalformedCapabilityError('Capability requires non-empty sub and jti claims');
  }
  if (typeof payload.roomId !== 'string' || !payload.roomId || !Array.isArray(payload.permissions)) {
    throw new MalformedCapabilityError('Capability requires roomId and permissions claims');
  }
}

/**
 * Asymmetric Capability Service utilizing Ed25519 (EdDSA) RFC 8037 signatures.
 * Enables zero-origin-roundtrip validation by Cloudflare Workers & Durable Objects.
 */
export class AsymmetricCapabilityService {
  private readonly privateKeyObject?: crypto.KeyObject;
  private readonly publicKeyObject: crypto.KeyObject;
  private readonly keyId: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly defaultTtlSeconds: number;
  private readonly jwkPublicKey: Ed25519JwkPublicKey;
  private readonly publicKeyPem: string;

  constructor(options: AsymmetricCapabilityOptions = {}) {
    this.issuer = options.issuer || CAPABILITY_ISSUER;
    this.audience = options.audience || CAPABILITY_AUDIENCE;
    this.defaultTtlSeconds = options.defaultTtlSeconds || DEFAULT_CAPABILITY_TTL_SECONDS;

    let privPem = options.privateKeyPem || process.env.CAPABILITY_PRIVATE_KEY;
    let pubPem = options.publicKeyPem || process.env.CAPABILITY_PUBLIC_KEY;

    if (!privPem && !pubPem && !options.publicKeyJwk) {
      // Ephemeral dev/test keypair
      const generated = generateEd25519KeyPair(options.keyId);
      privPem = generated.privateKeyPem;
      pubPem = generated.publicKeyPem;
      this.keyId = generated.keyId;
      this.jwkPublicKey = generated.publicKeyJwk;
      this.publicKeyPem = generated.publicKeyPem;
      this.privateKeyObject = crypto.createPrivateKey(privPem);
      this.publicKeyObject = crypto.createPublicKey(pubPem);
      return;
    }

    if (privPem) {
      this.privateKeyObject = crypto.createPrivateKey(privPem);
      this.publicKeyObject = crypto.createPublicKey(this.privateKeyObject as any);
      this.publicKeyPem = this.publicKeyObject.export({ type: 'spki', format: 'pem' }).toString();
    } else if (pubPem) {
      this.publicKeyObject = crypto.createPublicKey(pubPem);
      this.publicKeyPem = pubPem;
    } else if (options.publicKeyJwk) {
      this.publicKeyObject = crypto.createPublicKey({
        key: options.publicKeyJwk as any,
        format: 'jwk',
      });
      this.publicKeyPem = this.publicKeyObject.export({ type: 'spki', format: 'pem' }).toString();
    } else {
      throw new Error('AsymmetricCapabilityService requires at least a public or private key');
    }

    const exportedJwk = this.publicKeyObject.export({ format: 'jwk' }) as any;
    this.keyId = options.keyId || options.publicKeyJwk?.kid || `key_${crypto.createHash('sha256').update(this.publicKeyPem).digest('hex').slice(0, 8)}`;
    this.jwkPublicKey = {
      kty: 'OKP',
      crv: 'Ed25519',
      x: exportedJwk.x,
      kid: this.keyId,
      use: 'sig',
      alg: 'EdDSA',
    };
  }

  getKeyId(): string {
    return this.keyId;
  }

  getPublicKeyPem(): string {
    return this.publicKeyPem;
  }

  getPublicKeyJwk(): Ed25519JwkPublicKey {
    return { ...this.jwkPublicKey };
  }

  exportJwks(): JwksResponse {
    return {
      keys: [{ ...this.jwkPublicKey }],
    };
  }

  /**
   * Issues an Ed25519-signed capability token for a VerifiedPrincipal to enter a room.
   */
  issueRoomCapabilityFromPrincipal(
    principal: VerifiedPrincipal,
    roomId: string,
    role: ParticipantRoomRole = 'participant',
    customPermissions?: readonly RoomPermission[],
    ttlSeconds?: number,
    tier?: RoomTier
  ): string {
    return this.issueRoomCapability({
      sub: principal.userId,
      email: principal.email,
      roomId,
      tenantId: principal.orgId,
      role,
      permissions: customPermissions,
      ttlSeconds,
      tier,
    });
  }

  /**
   * Issues an Ed25519-signed capability token with room permissions.
   */
  issueRoomCapability(input: IssueCapabilityInput): string {
    if (!this.privateKeyObject) {
      throw new CapabilityTokenError(
        'Cannot issue capability tokens: private key not configured',
        'MISSING_PRIVATE_KEY'
      );
    }

    if (!input.sub || typeof input.sub !== 'string') {
      throw new CapabilityTokenError('Capability claims require a valid sub (userId)');
    }
    if (!input.roomId || typeof input.roomId !== 'string') {
      throw new CapabilityTokenError('Capability claims require a valid roomId');
    }

    const role = input.role || 'participant';
    const permissions = input.permissions || DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.participant;
    const now = Math.floor(Date.now() / 1000);
    const ttl = input.ttlSeconds || this.defaultTtlSeconds;
    const exp = now + ttl;
    const jti = input.jti || `cap_${crypto.randomUUID()}`;

    const header = {
      alg: 'EdDSA',
      typ: 'JWT',
      kid: this.keyId,
    };

    const payload: RoomCapabilityClaims = {
      sub: input.sub,
      ...(input.email ? { email: input.email } : {}),
      roomId: input.roomId,
      tenantId: input.tenantId !== undefined ? input.tenantId : null,
      role,
      permissions,
      ...(input.tier ? { tier: input.tier } : {}),
      jti,
      iat: now,
      exp,
      iss: this.issuer,
      aud: this.audience,
    };

    const headerEncoded = base64UrlEncode(Buffer.from(JSON.stringify(header)));
    const payloadEncoded = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
    const signingInput = `${headerEncoded}.${payloadEncoded}`;

    const signature = crypto.sign(null, Buffer.from(signingInput), this.privateKeyObject);
    const signatureEncoded = base64UrlEncode(signature);

    return `${signingInput}.${signatureEncoded}`;
  }

  /**
   * Verifies an Ed25519-signed capability token against the public key.
   * Enforces algorithm (EdDSA), expiry, signature validity, and optional room/audience constraints.
   */
  verifyRoomCapability(token: string, options: VerifyCapabilityOptions = {}): RoomCapabilityClaims {
    if (!token || typeof token !== 'string') {
      throw new MalformedCapabilityError('Token must be a non-empty string');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new MalformedCapabilityError(`Expected 3 segments in JWT, found ${parts.length}`);
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    let header: any;
    let payload: any;
    try {
      header = JSON.parse(base64UrlDecode(headerB64).toString('utf8'));
      payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'));
    } catch {
      throw new MalformedCapabilityError('Failed to parse token header or payload JSON');
    }

    if (header.alg !== 'EdDSA') {
      throw new InvalidCapabilitySignatureError(`Unsupported token algorithm: ${header.alg}`);
    }

    const signingInput = `${headerB64}.${payloadB64}`;
    const signatureBuffer = base64UrlDecode(signatureB64);

    const isValid = crypto.verify(
      null,
      Buffer.from(signingInput),
      this.publicKeyObject,
      signatureBuffer
    );

    if (!isValid) {
      throw new InvalidCapabilitySignatureError();
    }

    // Expiry verification
    const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= now) {
      throw new ExpiredCapabilityError(
        `Capability expired at ${payload.exp}, current time is ${now}`
      );
    }
    validateCapabilityClaims(payload, options, now);

    // Audience verification
    const expectedAudience = options.expectedAudience ?? this.audience;
    if (payload.aud !== expectedAudience) {
      throw new CapabilityTokenError(
        `Audience mismatch: expected ${expectedAudience}, got ${payload.aud}`,
        'AUDIENCE_MISMATCH'
      );
    }

    // Room constraint verification
    if (options.expectedRoomId && payload.roomId !== options.expectedRoomId) {
      throw new RoomMismatchError(
        `Token room ${payload.roomId} does not match expected room ${options.expectedRoomId}`
      );
    }

    return payload as RoomCapabilityClaims;
  }

  /**
   * Static Edge-compatible WebCrypto verifier.
   * Can run in Cloudflare Workers and Durable Objects using global `crypto.subtle`.
   */
  static async verifyWithWebCrypto(
    token: string,
    publicKeyJwk: Ed25519JwkPublicKey,
    options: VerifyCapabilityOptions = {}
  ): Promise<RoomCapabilityClaims> {
    if (!token || typeof token !== 'string') {
      throw new MalformedCapabilityError('Token must be a non-empty string');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new MalformedCapabilityError(`Expected 3 segments in JWT, found ${parts.length}`);
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    let header: any;
    let payload: any;
    try {
      header = JSON.parse(base64UrlDecode(headerB64).toString('utf8'));
      payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'));
    } catch {
      throw new MalformedCapabilityError('Failed to parse token header or payload JSON');
    }

    if (header.alg !== 'EdDSA') {
      throw new InvalidCapabilitySignatureError(`Unsupported token algorithm: ${header.alg}`);
    }

    const subtle = (globalThis.crypto as any)?.subtle;
    if (!subtle) {
      throw new CapabilityTokenError('SubtleCrypto is not available in current runtime');
    }

    const cryptoKey = await subtle.importKey(
      'jwk',
      publicKeyJwk,
      { name: 'Ed25519' },
      false,
      ['verify']
    );

    const signingInputBytes = Buffer.from(`${headerB64}.${payloadB64}`);
    const signatureBytes = base64UrlDecode(signatureB64);

    const verified = await subtle.verify(
      'Ed25519',
      cryptoKey,
      signatureBytes,
      signingInputBytes
    );

    if (!verified) {
      throw new InvalidCapabilitySignatureError();
    }

    const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= now) {
      throw new ExpiredCapabilityError(
        `Capability expired at ${payload.exp}, current time is ${now}`
      );
    }

    validateCapabilityClaims(payload, options, now);

    const expectedAudience = options.expectedAudience ?? CAPABILITY_AUDIENCE;
    if (payload.aud !== expectedAudience) {
      throw new CapabilityTokenError(
        `Audience mismatch: expected ${expectedAudience}, got ${payload.aud}`,
        'AUDIENCE_MISMATCH'
      );
    }

    if (options.expectedRoomId && payload.roomId !== options.expectedRoomId) {
      throw new RoomMismatchError(
        `Token room ${payload.roomId} does not match expected room ${options.expectedRoomId}`
      );
    }

    return payload as RoomCapabilityClaims;
  }
}
