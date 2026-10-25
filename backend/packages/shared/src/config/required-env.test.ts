import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateRequiredEnv,
  ConfigValidationError,
  PROCESS_ENV_SPECS,
} from './required-env.js';

const SECRET_VALUE = 'a'.repeat(40);

describe('P0-04: Required configuration fail-fast', () => {
  test('returns a frozen typed object when all required keys are present', () => {
    const cfg = validateRequiredEnv('room-http', {
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      JWT_SECRET: SECRET_VALUE,
      SESSION_SECRET: SECRET_VALUE,
      REDIS_HOST: 'localhost',
    });
    assert.equal(cfg.JWT_SECRET, SECRET_VALUE);
    assert.ok(Object.isFrozen(cfg));
  });

  test('throws listing every missing key for the process role', () => {
    assert.throws(
      () => validateRequiredEnv('auth-http', {}),
      (err: unknown) => {
        assert.ok(err instanceof ConfigValidationError);
        assert.equal(err.code, 'CONFIG_INVALID');
        assert.deepEqual(
          [...err.missing].sort(),
          ['DATABASE_URL', 'JWT_SECRET', 'REDIS_HOST', 'SESSION_SECRET']
        );
        return true;
      }
    );
  });

  test('treats empty and whitespace-only values as missing', () => {
    assert.throws(
      () =>
        validateRequiredEnv('room-scheduler', { DATABASE_URL: '   ' }),
      (err: unknown) =>
        err instanceof ConfigValidationError && err.missing.includes('DATABASE_URL')
    );
  });

  test('rejects known insecure fallback secrets', () => {
    for (const weak of [
      'secret',
      'meetlite_super_secret_jwt_key_2026',
      'meetlite_session_secret_key_2026',
      'super_secret_jwt_key_for_meetlite_production_2026',
      'super_secret_session_key_for_meetlite_production_2026',
      'replace_with_strong_jwt_secret_minimum_32_characters',
      'replace_with_strong_session_secret_minimum_32_char',
      'your_super_secret_jwt_key_here',
      'your_session_secret_here',
    ]) {
      assert.throws(
        () =>
          validateRequiredEnv('room-http', {
            DATABASE_URL: 'postgresql://u:p@h:5432/db',
            JWT_SECRET: weak,
            SESSION_SECRET: SECRET_VALUE,
            REDIS_HOST: 'h',
          }),
        (err: unknown) =>
          err instanceof ConfigValidationError && err.invalid.includes('JWT_SECRET'),
        `expected ${weak.length}-char weak secret to be rejected`
      );
    }
  });

  test('rejects secrets shorter than 32 characters', () => {
    assert.throws(
      () =>
        validateRequiredEnv('mediasoup', {
          JWT_SECRET: 'short-but-not-a-known-default',
          REDIS_URL: 'redis://h:6379',
        }),
      (err: unknown) =>
        err instanceof ConfigValidationError && err.invalid.includes('JWT_SECRET')
    );
  });

  test('error message names keys but never echoes values', () => {
    const leaked = 'postgresql://user:SUPER_PRIVATE_PW@db:5432/x';
    try {
      validateRequiredEnv('auth-http', { DATABASE_URL: leaked, JWT_SECRET: 'secret' });
      assert.fail('expected throw');
    } catch (err) {
      assert.ok(err instanceof ConfigValidationError);
      assert.ok(!err.message.includes('SUPER_PRIVATE_PW'));
      assert.ok(!err.message.includes(leaked));
      assert.ok(err.message.includes('JWT_SECRET'));
    }
  });

  test('accepts REDIS_URL as an alternative to REDIS_HOST', () => {
    const cfg = validateRequiredEnv('room-worker', {
      DATABASE_URL: 'postgresql://u:p@h:5432/db',
      REDIS_URL: 'redis://h:6379',
    });
    assert.equal(cfg.REDIS_URL, 'redis://h:6379');
  });

  test('workers and schedulers do not require HTTP-only secrets', () => {
    assert.ok(!PROCESS_ENV_SPECS['auth-scheduler'].required.includes('SESSION_SECRET'));
    assert.ok(!PROCESS_ENV_SPECS['room-worker'].required.includes('SESSION_SECRET'));
  });
});
