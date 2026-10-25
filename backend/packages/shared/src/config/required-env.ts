/**
 * Required configuration validation per deployable process role.
 *
 * Invariant: a process MUST NOT bind a port or accept a queue job when a
 * required secret/connection setting is missing, empty, or a known insecure
 * default. Error messages name keys only and never echo values.
 *
 * Scope note (P0-04): this validates the startup-critical keys. Migrating all
 * remaining feature-level `process.env` reads into typed config is tracked as
 * an R1 follow-up and is intentionally not done here.
 */

export type ProcessRole =
  | 'auth-http'
  | 'auth-worker'
  | 'auth-scheduler'
  | 'room-http'
  | 'room-worker'
  | 'room-scheduler'
  | 'mediasoup';

type RequiredKey = 'DATABASE_URL' | 'JWT_SECRET' | 'SESSION_SECRET';

interface ProcessEnvSpec {
  /** Keys that must be present and non-empty. */
  readonly required: readonly RequiredKey[];
  /** Requires REDIS_HOST or REDIS_URL. */
  readonly redis: boolean;
}

export const PROCESS_ENV_SPECS: Readonly<Record<ProcessRole, ProcessEnvSpec>> = Object.freeze({
  'auth-http': { required: ['DATABASE_URL', 'JWT_SECRET', 'SESSION_SECRET'], redis: true },
  'auth-worker': { required: ['DATABASE_URL'], redis: true },
  'auth-scheduler': { required: ['DATABASE_URL'], redis: true },
  'room-http': { required: ['DATABASE_URL', 'JWT_SECRET', 'SESSION_SECRET'], redis: true },
  'room-worker': { required: ['DATABASE_URL'], redis: true },
  'room-scheduler': { required: ['DATABASE_URL'], redis: false },
  mediasoup: { required: ['JWT_SECRET'], redis: true },
});

const SECRET_KEYS: ReadonlySet<RequiredKey> = new Set(['JWT_SECRET', 'SESSION_SECRET']);
const MIN_SECRET_LENGTH = 32;

/** Values previously used as hardcoded fallbacks in code, templates, or docker-compose. */
const KNOWN_INSECURE_SECRETS: ReadonlySet<string> = new Set([
  'secret',
  'meetlite_super_secret_jwt_key_2026',
  'meetlite_session_secret_key_2026',
  'super_secret_jwt_key_for_meetlite_production_2026',
  'super_secret_session_key_for_meetlite_production_2026',
  'replace_with_strong_jwt_secret_minimum_32_characters',
  'replace_with_strong_session_secret_minimum_32_char',
  'your_super_secret_jwt_key_here',
  'your_session_secret_here',
]);

export class ConfigValidationError extends Error {
  readonly code = 'CONFIG_INVALID' as const;

  constructor(
    readonly role: ProcessRole,
    readonly missing: readonly string[],
    readonly invalid: readonly string[]
  ) {
    const parts: string[] = [];
    if (missing.length > 0) {
      parts.push(
        `missing: ${missing
          .map((k) => (k === 'REDIS_HOST' ? 'REDIS_HOST (or REDIS_URL)' : k))
          .join(', ')}`
      );
    }
    if (invalid.length > 0) {
      parts.push(
        `invalid (shorter than ${MIN_SECRET_LENGTH} chars or a known insecure default): ${invalid.join(', ')}`
      );
    }
    super(`[${role}] configuration rejected; ${parts.join('; ')}`);
    this.name = 'ConfigValidationError';
  }
}

export type RequiredEnv = Readonly<Record<string, string>>;

function present(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateRequiredEnv(
  role: ProcessRole,
  env: Readonly<Record<string, string | undefined>>
): RequiredEnv {
  const spec = PROCESS_ENV_SPECS[role];
  const missing: string[] = [];
  const invalid: string[] = [];
  const result: Record<string, string> = {};

  for (const key of spec.required) {
    const value = env[key];
    if (!present(value)) {
      missing.push(key);
      continue;
    }
    if (
      SECRET_KEYS.has(key) &&
      (value.length < MIN_SECRET_LENGTH || KNOWN_INSECURE_SECRETS.has(value))
    ) {
      invalid.push(key);
      continue;
    }
    result[key] = value;
  }

  if (spec.redis) {
    const host = env.REDIS_HOST;
    const url = env.REDIS_URL;
    if (!present(host) && !present(url)) {
      missing.push('REDIS_HOST');
    } else {
      if (present(host)) result.REDIS_HOST = host;
      if (present(url)) result.REDIS_URL = url;
    }
  }

  if (present(env.DIRECT_URL)) {
    result.DIRECT_URL = env.DIRECT_URL;
  }

  if (missing.length > 0 || invalid.length > 0) {
    throw new ConfigValidationError(role, missing, invalid);
  }

  return Object.freeze(result);
}
