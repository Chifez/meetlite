/**
 * Database connection bounding and Neon PgBouncer configuration.
 *
 * Implements S1-03:
 * - Moves origin Prisma traffic to Neon's pooled endpoint (pgbouncer=true).
 * - Binds per-process connection limits to satisfy explicit database connection budget:
 *   totalDatabaseLimit >= sum(replicas * pool_per_replica) + workers + migration/admin reserve.
 * - Reserves direct connections (DIRECT_URL) exclusively for migrations and administrative tooling.
 */

export const ROLE_CONNECTION_LIMITS: Readonly<Record<string, number>> = Object.freeze({
  'auth-http': 10,
  'room-http': 10,
  'auth-worker': 5,
  'room-worker': 5,
  'auth-scheduler': 2,
  'room-scheduler': 2,
  mediasoup: 2,
  migration: 2,
  default: 5,
});

export const DEFAULT_ROLE_CONNECTION_LIMIT = 5;
export const DEFAULT_POOL_TIMEOUT_SECONDS = 15;

/**
 * Explicit connection budget specification.
 */
export interface ConnectionBudgetConfig {
  totalDatabaseLimit: number;
  httpReplicas: number;
  poolPerHttpReplica: number;
  workers: number;
  poolPerWorker: number;
  schedulers: number;
  poolPerScheduler: number;
  migrationReserve: number;
  adminReserve: number;
}

export const DEFAULT_PRODUCTION_BUDGET: ConnectionBudgetConfig = Object.freeze({
  totalDatabaseLimit: 100, // Standard Neon allocation or PostgreSQL max_connections
  httpReplicas: 4,         // 2 auth-http replicas + 2 room-http replicas
  poolPerHttpReplica: 10,  // Max 10 connections per HTTP replica
  workers: 4,              // 2 auth-workers + 2 room-workers
  poolPerWorker: 5,        // Max 5 connections per worker
  schedulers: 2,           // 1 auth-scheduler + 1 room-scheduler
  poolPerScheduler: 2,     // Max 2 connections per scheduler
  migrationReserve: 5,     // Dedicated reserve for direct migration jobs
  adminReserve: 5,         // Dedicated reserve for operator/admin CLI connections
});

/**
 * Calculates connection allocation against the configured database capacity.
 */
export function calculateConnectionBudget(config: ConnectionBudgetConfig = DEFAULT_PRODUCTION_BUDGET) {
  const httpTotal = config.httpReplicas * config.poolPerHttpReplica;
  const workerTotal = config.workers * config.poolPerWorker;
  const schedulerTotal = config.schedulers * config.poolPerScheduler;
  const allocated =
    httpTotal +
    workerTotal +
    schedulerTotal +
    config.migrationReserve +
    config.adminReserve;
  const margin = config.totalDatabaseLimit - allocated;

  return {
    totalLimit: config.totalDatabaseLimit,
    allocated,
    margin,
    isValid: margin >= 0,
    breakdown: {
      httpTotal,
      workerTotal,
      schedulerTotal,
      migrationReserve: config.migrationReserve,
      adminReserve: config.adminReserve,
    },
  };
}

/**
 * Formats a database connection URL with explicit connection bounding and PgBouncer parameters.
 */
export function formatPooledDatabaseUrl(
  rawUrl: string,
  options: {
    connectionLimit?: number;
    poolTimeout?: number;
    isPgBouncer?: boolean;
    role?: string;
  } = {}
): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return rawUrl;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  const role = options.role || process.env.PROCESS_ROLE || 'default';
  const connectionLimit =
    options.connectionLimit ||
    (process.env.DATABASE_CONNECTION_LIMIT
      ? parseInt(process.env.DATABASE_CONNECTION_LIMIT, 10)
      : ROLE_CONNECTION_LIMITS[role] || DEFAULT_ROLE_CONNECTION_LIMIT);

  const poolTimeout =
    options.poolTimeout ||
    (process.env.DATABASE_POOL_TIMEOUT
      ? parseInt(process.env.DATABASE_POOL_TIMEOUT, 10)
      : DEFAULT_POOL_TIMEOUT_SECONDS);

  // Check if host or port indicates Neon pooler or PgBouncer
  const isNeonPoolerHost =
    parsed.hostname.includes('-pooler') ||
    parsed.port === '6543';

  const shouldEnablePgBouncer =
    options.isPgBouncer ??
    (isNeonPoolerHost ||
      process.env.PG_BOUNCER === 'true' ||
      parsed.searchParams.get('pgbouncer') === 'true');

  parsed.searchParams.set('connection_limit', String(connectionLimit));
  parsed.searchParams.set('pool_timeout', String(poolTimeout));

  if (shouldEnablePgBouncer) {
    parsed.searchParams.set('pgbouncer', 'true');
  }

  return parsed.toString();
}

/**
 * Validates that DATABASE_URL and DIRECT_URL are properly configured.
 */
export function validateDatabaseUrls(options: {
  databaseUrl?: string;
  directUrl?: string;
  isProduction?: boolean;
} = {}): {
  valid: boolean;
  isPooled: boolean;
  hasDirectUrl: boolean;
  warnings: string[];
  errors: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const databaseUrl = options.databaseUrl || process.env.DATABASE_URL || '';
  const directUrl = options.directUrl || process.env.DIRECT_URL || '';
  const isProduction = options.isProduction ?? (process.env.NODE_ENV === 'production');

  if (!databaseUrl) {
    errors.push('DATABASE_URL is missing or empty');
    return { valid: false, isPooled: false, hasDirectUrl: false, warnings, errors };
  }

  let dbUrlParsed: URL | null = null;
  try {
    dbUrlParsed = new URL(databaseUrl);
  } catch {
    errors.push('DATABASE_URL is not a valid URI');
    return { valid: false, isPooled: false, hasDirectUrl: false, warnings, errors };
  }

  const isPooled =
    dbUrlParsed.searchParams.get('pgbouncer') === 'true' ||
    dbUrlParsed.hostname.includes('-pooler') ||
    dbUrlParsed.port === '6543';

  const hasDirectUrl = !!directUrl && directUrl.trim().length > 0;

  if (isProduction && isPooled && !hasDirectUrl) {
    warnings.push(
      'DATABASE_URL points to a pooled endpoint (PgBouncer) but DIRECT_URL is not set. Migrations require a direct unpooled connection.'
    );
  }

  if (hasDirectUrl) {
    try {
      const directParsed = new URL(directUrl);
      if (
        directParsed.searchParams.get('pgbouncer') === 'true' ||
        directParsed.hostname.includes('-pooler') ||
        directParsed.port === '6543'
      ) {
        errors.push(
          'DIRECT_URL must not point to a pooled PgBouncer endpoint; migrations require a direct connection.'
        );
      }
    } catch {
      errors.push('DIRECT_URL is not a valid URI');
    }
  }

  return {
    valid: errors.length === 0,
    isPooled,
    hasDirectUrl,
    warnings,
    errors,
  };
}
