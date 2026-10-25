import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateRequiredEnv,
  ConfigValidationError,
  PROCESS_ENV_SPECS,
  ProcessRole,
} from '../config/required-env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../../..');

describe('P0-04: Configuration Hardening & Secret Fail-Fast Contract', () => {
  const BANNED_SECRETS = [
    'meetlite_secure_password_2026',
    'meetlite_super_secret_jwt_key_2026',
    'meetlite_session_secret_key_2026',
    'admin123',
  ];

  it('docker-compose.yml must not contain hardcoded fallback secrets', () => {
    const composePath = path.join(REPO_ROOT, 'docker-compose.yml');
    assert.ok(fs.existsSync(composePath), 'docker-compose.yml must exist');
    const composeContent = fs.readFileSync(composePath, 'utf-8');

    for (const banned of BANNED_SECRETS) {
      assert.ok(
        !composeContent.includes(banned),
        `docker-compose.yml must not contain hardcoded secret: ${banned}`
      );
    }

    // Must enforce required variables via :? syntax
    assert.match(composeContent, /POSTGRES_PASSWORD:\s*\$\{POSTGRES_PASSWORD:\?/);
    assert.match(composeContent, /JWT_SECRET:\s*\$\{JWT_SECRET:\?/);
    assert.match(composeContent, /SESSION_SECRET:\s*\$\{SESSION_SECRET:\?/);
  });

  it('environment example templates must not contain hardcoded fallback secrets', () => {
    const templates = ['.env.docker.example', '.env.example'];
    for (const tpl of templates) {
      const fullPath = path.join(REPO_ROOT, tpl);
      if (!fs.existsSync(fullPath)) continue;
      const content = fs.readFileSync(fullPath, 'utf-8');
      for (const banned of BANNED_SECRETS) {
        assert.ok(
          !content.includes(banned),
          `${tpl} must not contain hardcoded secret: ${banned}`
        );
      }
    }
  });

  it('session config files must not fall back to "secret"', () => {
    const sessionFiles = [
      'backend/packages/auth-service/src/config/session.ts',
      'backend/packages/room-service/src/config/session.ts',
    ];

    for (const relPath of sessionFiles) {
      const fullPath = path.join(REPO_ROOT, relPath);
      assert.ok(fs.existsSync(fullPath), `${relPath} must exist`);
      const content = fs.readFileSync(fullPath, 'utf-8');
      assert.ok(
        !content.includes("|| 'secret'"),
        `${relPath} must not contain || 'secret' fallback`
      );
    }
  });

  it('all deployable roles have defined environment specs and fail fast if invalid', () => {
    const roles: ProcessRole[] = [
      'auth-http',
      'auth-worker',
      'auth-scheduler',
      'room-http',
      'room-worker',
      'room-scheduler',
      'mediasoup',
    ];

    for (const role of roles) {
      assert.ok(PROCESS_ENV_SPECS[role], `Role spec must exist for ${role}`);

      // Missing env must throw ConfigValidationError
      assert.throws(
        () => validateRequiredEnv(role, {}),
        (err: unknown) => err instanceof ConfigValidationError && err.role === role,
        `Role ${role} must throw ConfigValidationError on empty env`
      );
    }
  });

  it('service entry points must invoke validateRequiredEnv before starting', () => {
    const entryPoints: Record<string, string> = {
      'auth-service/src/index.ts': 'auth-http',
      'auth-service/src/worker.ts': 'auth-worker',
      'auth-service/src/scheduler.ts': 'auth-scheduler',
      'room-service/src/index.ts': 'room-http',
      'room-service/src/worker.ts': 'room-worker',
      'room-service/src/scheduler.ts': 'room-scheduler',
      'mediasoup-service/src/index.ts': 'mediasoup',
    };

    for (const [entryFile, role] of Object.entries(entryPoints)) {
      const fullPath = path.join(REPO_ROOT, 'backend/packages', entryFile);
      assert.ok(fs.existsSync(fullPath), `Entry point ${entryFile} must exist`);
      const content = fs.readFileSync(fullPath, 'utf-8');
      assert.ok(
        content.includes('validateRequiredEnv'),
        `Entry point ${entryFile} must call validateRequiredEnv`
      );
      assert.ok(
        content.includes(`'${role}'`),
        `Entry point ${entryFile} must validate role '${role}'`
      );
    }
  });
});
