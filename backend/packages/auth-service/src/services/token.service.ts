import {
  TokenManager,
  RedisRefreshTokenStore,
  InMemoryRefreshTokenStore,
  RefreshTokenStore,
} from '@minimeet/shared';
import redisClient from '../config/redis.js';

export function createAuthTokenStore(): RefreshTokenStore {
  // If in isolated unit testing without a connected Redis instance, use in-memory store
  if (process.env.NODE_ENV === 'test' && !redisClient.isReady()) {
    return new InMemoryRefreshTokenStore();
  }

  const redisStore = new RedisRefreshTokenStore(() => {
    try {
      return redisClient.getClient();
    } catch {
      return null;
    }
  });

  return redisStore;
}

export const tokenStore = createAuthTokenStore();

export const tokenManager = new TokenManager(
  process.env.JWT_SECRET || 'fallback_secret_for_characterization_1234567890',
  tokenStore
);
