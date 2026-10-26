# CAL-04: Non-Blocking Calendar Cache Invalidation

- Phase / track: Phase P5 — Security, Calendar, and Scheduling Closure
- Invariant: Calendar event cache invalidation operates in O(1) time without executing blocking `KEYS *` scans on the Redis keyspace, preventing thread-blocking latency spikes and denial of service.
- Scope: `backend/packages/room-service/src/services/calendar-cache.service.ts`.
- Forbidden scope: No unbounded `KEYS` commands in production cache operations.
- Dependencies: Redis client.
- Risk classification: medium
- Rollback / kill switch: Revert `calendar-cache.service.ts`.
- Baseline commit and environment: Commit `d165212`, Redis 7.2.
- Pre-existing failures: `invalidateCalendarCache` executed `redis.keys('calendar:events:${userId}:*')`, which performs a full keyspace scan across all stored Redis keys.

## Red evidence
Prior to this implementation:
`calendar-cache.service.ts` line 142:
```typescript
const pattern = `${CACHE_PREFIX}:${userId}:*`;
const keys = await redisClient.getClient().keys(pattern);
if (keys.length > 0) {
  await redisClient.getClient().del(...keys);
}
```
Blocking keyspace scan violating execution plan hard-stop rules.

## Green evidence
With set-based key tracking:
1. When a date range is cached, its exact key is added to `calendar:user_keys:${userId}` with matching TTL:
   `await client.sadd(userSetKey, cacheKey)`
2. Invalidation queries only the user's specific set:
   `const keys = await client.smembers(userSetKey)`
   `await client.del(...keys)`
   `await client.del(userSetKey)`
3. Zero keyspace scanning; O(1) operation regardless of total Redis keys count.
