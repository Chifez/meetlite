import crypto from 'crypto';
import redisClient from '../config/redis.js';

export interface OAuthStatePayload {
  userId: string;
  email: string;
  provider: string;
  nonce: string;
  redirectUri?: string;
  expiresAt: number;
}

const STATE_TTL_SECONDS = 600; // 10 minutes
const memoryNonceStore = new Map<
  string,
  { payload: OAuthStatePayload; expiresAt: number }
>();

function getSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('OAuth state signing secret is not configured');
  }
  return secret;
}

function mayUseMemoryStore(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Clean expired in-memory nonces periodically
 */
function cleanMemoryStore() {
  const now = Date.now();
  for (const [nonce, data] of memoryNonceStore.entries()) {
    if (data.expiresAt < now) {
      memoryNonceStore.delete(nonce);
    }
  }
}

/**
 * Generate an opaque, cryptographically signed, expiring, one-time OAuth state
 */
export async function generateOAuthState(
  userId: string,
  email: string,
  provider = 'google',
  redirectUri?: string
): Promise<string> {
  const nonce = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const expiresAt = now + STATE_TTL_SECONDS * 1000;

  const payload: OAuthStatePayload = {
    userId,
    email,
    provider,
    nonce,
    redirectUri,
    expiresAt,
  };

  const payloadString = JSON.stringify(payload);
  const secret = getSecret();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(nonce)
    .digest('hex');

  // Atomically store nonce for one-time replay prevention
  if (redisClient.isReady()) {
    try {
      await redisClient
        .getClient()
        .set(`oauth:state:${nonce}`, payloadString, 'EX', STATE_TTL_SECONDS);
    } catch (err) {
      if (!mayUseMemoryStore()) {
        throw new Error('OAuth state store is unavailable');
      }
      console.warn(
        '[OAuth State] Redis write failed; using local development store'
      );
      memoryNonceStore.set(nonce, { payload, expiresAt });
    }
  } else if (mayUseMemoryStore()) {
    memoryNonceStore.set(nonce, { payload, expiresAt });
  } else {
    throw new Error('OAuth state store is unavailable');
  }

  return `${nonce}.${signature}`;
}

/**
 * Verify and atomically consume an OAuth state
 * Ensures:
 * 1. Valid HMAC signature (cannot be forged or modified)
 * 2. Not expired (within 10 minutes)
 * 3. Not replayed (one-time nonce consumed atomically)
 * 4. Bound to original initiating user
 */
export async function verifyAndConsumeOAuthState(
  stateString: string
): Promise<OAuthStatePayload> {
  if (!stateString || typeof stateString !== 'string') {
    throw new Error('Missing or invalid OAuth state parameter');
  }

  const parts = stateString.split('.');
  if (parts.length !== 2) {
    throw new Error('Malformed OAuth state format');
  }

  const [nonce, signature] = parts;
  if (!/^[0-9a-f]{32}$/i.test(nonce) || !/^[0-9a-f]{64}$/i.test(signature)) {
    throw new Error('Malformed OAuth state format');
  }

  const secret = getSecret();
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(nonce)
    .digest('hex');

  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSig, 'hex');

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    throw new Error(
      'OAuth state signature verification failed (tampered state)'
    );
  }

  // Atomically consume nonce
  let storedPayload: OAuthStatePayload | null = null;
  if (redisClient.isReady()) {
    try {
      const client = redisClient.getClient();
      // Using multi to get and delete atomically
      const results = await client
        .multi()
        .get(`oauth:state:${nonce}`)
        .del(`oauth:state:${nonce}`)
        .exec();
      if (results && results[0] && results[0][1]) {
        storedPayload = JSON.parse(results[0][1] as string);
      }
    } catch (err) {
      if (!mayUseMemoryStore()) {
        throw new Error('OAuth state store is unavailable');
      }
      console.warn(
        '[OAuth State] Redis lookup failed; checking local development store'
      );
    }
  }

  if (!storedPayload && mayUseMemoryStore()) {
    const mem = memoryNonceStore.get(nonce);
    if (mem) {
      storedPayload = mem.payload;
      memoryNonceStore.delete(nonce);
    }
  }

  if (!storedPayload || storedPayload.nonce !== nonce) {
    throw new Error(
      'OAuth state has already been consumed or is invalid (replay denied)'
    );
  }

  if (Date.now() > storedPayload.expiresAt) {
    cleanMemoryStore();
    throw new Error('OAuth state has expired');
  }

  return storedPayload;
}
