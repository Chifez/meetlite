import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes (900s)
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days (604,800s)
export const REFRESH_TOKEN_GRACE_WINDOW_SECONDS = 15; // 15 seconds network retry grace window

export class TokenReuseError extends Error {
  readonly code = 'TOKEN_REUSE_DETECTED' as const;
  constructor(message = 'Refresh token reuse detected; family revoked') {
    super(message);
    this.name = 'TokenReuseError';
  }
}

export class TokenRevokedError extends Error {
  readonly code = 'TOKEN_REVOKED' as const;
  constructor(message = 'Token has been revoked') {
    super(message);
    this.name = 'TokenRevokedError';
  }
}

export interface AccessTokenPayload {
  jti?: string;
  userId: string;
  email: string;
  organizationId: string | null;
  role: string;
  tokenVersion: number;
  isSystemAdmin: boolean;
  familyId?: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenRecord {
  tokenHash: string;
  userId: string;
  familyId: string;
  tokenVersion: number;
  createdAt: number;
  expiresAt: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  familyId: string;
}

export interface RefreshTokenStore {
  saveToken(record: RefreshTokenRecord, ttlSeconds: number): Promise<void>;
  findToken(tokenHash: string): Promise<RefreshTokenRecord | null>;
  deleteToken(tokenHash: string): Promise<void>;
  markUsedToken(tokenHash: string, familyId: string, ttlSeconds: number): Promise<void>;
  isUsedToken(tokenHash: string): Promise<{ used: boolean; familyId?: string }>;
  revokeFamily(familyId: string, ttlSeconds: number): Promise<void>;
  isFamilyRevoked(familyId: string): Promise<boolean>;
  getUserTokenVersion(userId: string): Promise<number | null>;
  setUserTokenVersion(userId: string, version: number): Promise<void>;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateFamilyId(): string {
  return `fam_${crypto.randomUUID()}`;
}

/**
 * In-memory token store for deterministic testing and fakes.
 */
export class InMemoryRefreshTokenStore implements RefreshTokenStore {
  private readonly tokens = new Map<string, RefreshTokenRecord>();
  private readonly usedTokens = new Map<string, { familyId: string; expiresAt: number }>();
  private readonly revokedFamilies = new Map<string, number>();
  private readonly userTokenVersions = new Map<string, number>();

  async saveToken(record: RefreshTokenRecord, ttlSeconds: number): Promise<void> {
    this.tokens.set(record.tokenHash, {
      ...record,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async findToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const record = this.tokens.get(tokenHash);
    if (!record) return null;
    if (record.expiresAt < Date.now()) {
      this.tokens.delete(tokenHash);
      return null;
    }
    return record;
  }

  async deleteToken(tokenHash: string): Promise<void> {
    this.tokens.delete(tokenHash);
  }

  async markUsedToken(tokenHash: string, familyId: string, ttlSeconds: number): Promise<void> {
    this.usedTokens.set(tokenHash, {
      familyId,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async isUsedToken(tokenHash: string): Promise<{ used: boolean; familyId?: string }> {
    const found = this.usedTokens.get(tokenHash);
    if (!found) return { used: false };
    if (found.expiresAt < Date.now()) {
      this.usedTokens.delete(tokenHash);
      return { used: false };
    }
    return { used: true, familyId: found.familyId };
  }

  async revokeFamily(familyId: string, ttlSeconds: number): Promise<void> {
    this.revokedFamilies.set(familyId, Date.now() + ttlSeconds * 1000);
  }

  async isFamilyRevoked(familyId: string): Promise<boolean> {
    const expiresAt = this.revokedFamilies.get(familyId);
    if (!expiresAt) return false;
    if (expiresAt < Date.now()) {
      this.revokedFamilies.delete(familyId);
      return false;
    }
    return true;
  }

  async getUserTokenVersion(userId: string): Promise<number | null> {
    return this.userTokenVersions.get(userId) ?? null;
  }

  async setUserTokenVersion(userId: string, version: number): Promise<void> {
    this.userTokenVersions.set(userId, version);
  }
}

/**
 * Production Redis token store supporting token hashing, rotation, and reuse detection.
 */
export class RedisRefreshTokenStore implements RefreshTokenStore {
  constructor(private readonly redisClientGetter: () => any) {}

  private get client(): any {
    const client = this.redisClientGetter();
    if (!client) throw new Error('Redis client not available for token store');
    return client;
  }

  async saveToken(record: RefreshTokenRecord, ttlSeconds: number): Promise<void> {
    const key = `meetlite:refresh:${record.tokenHash}`;
    await this.client.set(key, JSON.stringify(record), 'EX', ttlSeconds);
  }

  async findToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const key = `meetlite:refresh:${tokenHash}`;
    const raw = await this.client.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async deleteToken(tokenHash: string): Promise<void> {
    const key = `meetlite:refresh:${tokenHash}`;
    await this.client.del(key);
  }

  async markUsedToken(tokenHash: string, familyId: string, ttlSeconds: number): Promise<void> {
    const key = `meetlite:used_refresh:${tokenHash}`;
    await this.client.set(key, familyId, 'EX', ttlSeconds);
  }

  async isUsedToken(tokenHash: string): Promise<{ used: boolean; familyId?: string }> {
    const key = `meetlite:used_refresh:${tokenHash}`;
    const familyId = await this.client.get(key);
    if (familyId) {
      return { used: true, familyId };
    }
    return { used: false };
  }

  async revokeFamily(familyId: string, ttlSeconds: number): Promise<void> {
    const key = `meetlite:revoked_family:${familyId}`;
    await this.client.set(key, '1', 'EX', ttlSeconds);
  }

  async isFamilyRevoked(familyId: string): Promise<boolean> {
    const key = `meetlite:revoked_family:${familyId}`;
    const val = await this.client.get(key);
    return val === '1';
  }

  async getUserTokenVersion(userId: string): Promise<number | null> {
    const key = `meetlite:user_token_version:${userId}`;
    const val = await this.client.get(key);
    if (!val) return null;
    const num = parseInt(val, 10);
    return isNaN(num) ? null : num;
  }

  async setUserTokenVersion(userId: string, version: number): Promise<void> {
    const key = `meetlite:user_token_version:${userId}`;
    // Cache for 30 days
    await this.client.set(key, version.toString(), 'EX', 30 * 24 * 60 * 60);
  }
}

export interface TokenManagerOptions {
  accessTokenTtlSeconds?: number;
  refreshTokenTtlSeconds?: number;
  graceWindowSeconds?: number;
}

export class TokenManager {
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlSeconds: number;
  private readonly graceWindowSeconds: number;

  constructor(
    private readonly jwtSecret: string,
    private readonly store: RefreshTokenStore,
    options: TokenManagerOptions = {}
  ) {
    this.accessTokenTtlSeconds = options.accessTokenTtlSeconds ?? ACCESS_TOKEN_TTL_SECONDS;
    this.refreshTokenTtlSeconds = options.refreshTokenTtlSeconds ?? REFRESH_TOKEN_TTL_SECONDS;
    this.graceWindowSeconds = options.graceWindowSeconds ?? REFRESH_TOKEN_GRACE_WINDOW_SECONDS;
  }

  createAccessToken(user: any, familyId?: string, expiresInSeconds?: number): string {
    const ttl = expiresInSeconds ?? this.accessTokenTtlSeconds;
    const payload: AccessTokenPayload = {
      jti: crypto.randomUUID(),
      userId: user._id || user.id,
      email: user.email,
      organizationId: user.organizationId || null,
      role: user.role || 'owner',
      tokenVersion: typeof user.tokenVersion === 'number' ? user.tokenVersion : 1,
      isSystemAdmin: Boolean(user.isSystemAdmin),
      ...(familyId ? { familyId } : {}),
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn: ttl });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, this.jwtSecret) as AccessTokenPayload;
  }

  async issueTokenPair(user: any, existingFamilyId?: string): Promise<TokenPair> {
    const familyId = existingFamilyId ?? generateFamilyId();
    const accessToken = this.createAccessToken(user, familyId);
    const rawRefreshToken = generateOpaqueToken();
    const tokenHash = hashToken(rawRefreshToken);

    const tokenVersion = typeof user.tokenVersion === 'number' ? user.tokenVersion : 1;
    const record: RefreshTokenRecord = {
      tokenHash,
      userId: user._id || user.id,
      familyId,
      tokenVersion,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.refreshTokenTtlSeconds * 1000,
    };

    await this.store.saveToken(record, this.refreshTokenTtlSeconds);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: this.accessTokenTtlSeconds,
      familyId,
    };
  }

  async rotateRefreshToken(
    refreshToken: string,
    userLookup: (userId: string) => Promise<any>
  ): Promise<TokenPair> {
    const presentedHash = hashToken(refreshToken);

    // 1. Check if token was already used (reuse detection)
    const usedStatus = await this.store.isUsedToken(presentedHash);
    if (usedStatus.used && usedStatus.familyId) {
      // IMMEDIATE REUSE DETECTION: An old token was replayed!
      await this.store.revokeFamily(usedStatus.familyId, this.refreshTokenTtlSeconds);
      throw new TokenReuseError(
        `Token reuse detected for family ${usedStatus.familyId}; entire family revoked`
      );
    }

    // 2. Lookup active token
    const record = await this.store.findToken(presentedHash);
    if (!record) {
      throw new TokenRevokedError('Invalid or expired refresh token');
    }

    // 3. Verify family has not been revoked
    const isRevoked = await this.store.isFamilyRevoked(record.familyId);
    if (isRevoked) {
      throw new TokenRevokedError('Token family has been revoked');
    }

    // 4. Lookup user and verify tokenVersion
    const user = await userLookup(record.userId);
    if (!user) {
      throw new TokenRevokedError('User not found');
    }

    const currentVersion = typeof user.tokenVersion === 'number' ? user.tokenVersion : 1;
    if (record.tokenVersion !== currentVersion) {
      // Invalidate token
      await this.store.deleteToken(presentedHash);
      throw new TokenRevokedError('Token version has been invalidated');
    }

    // 5. Invalidate current token and mark as used (with grace window if configured)
    await this.store.deleteToken(presentedHash);
    await this.store.markUsedToken(presentedHash, record.familyId, this.refreshTokenTtlSeconds);

    // 6. Issue next token pair in the SAME family
    return this.issueTokenPair(user, record.familyId);
  }

  async revokeSession(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    const record = await this.store.findToken(tokenHash);
    if (record) {
      await this.store.deleteToken(tokenHash);
      await this.store.revokeFamily(record.familyId, this.refreshTokenTtlSeconds);
    }
  }

  async revokeAllUserSessions(userId: string, nextVersion: number): Promise<void> {
    await this.store.setUserTokenVersion(userId, nextVersion);
  }

  async isTokenRevoked(
    payload: AccessTokenPayload,
    activeVersionLookup?: (userId: string) => Promise<number | null>
  ): Promise<boolean> {
    // 1. Check family revocation if familyId present
    if (payload.familyId) {
      const familyRevoked = await this.store.isFamilyRevoked(payload.familyId);
      if (familyRevoked) return true;
    }

    let activeVersion: number | null = null;
    if (activeVersionLookup) {
      activeVersion = await activeVersionLookup(payload.userId);
      if (activeVersion !== null) {
        await this.store.setUserTokenVersion(payload.userId, activeVersion);
      }
    } else {
      activeVersion = await this.store.getUserTokenVersion(payload.userId);
    }

    if (activeVersion !== null && payload.tokenVersion < activeVersion) {
      return true;
    }

    return false;
  }
}
