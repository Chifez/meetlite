import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Root of repository is 5 levels up from backend/packages/shared/src/testing
const repoRoot = path.resolve(__dirname, '../../../../../');

describe('P0-02: Safe Database Delivery & Migration Contract', () => {
  test('docker-compose.yml must not use destructive db push or --accept-data-loss', () => {
    const dockerComposePath = path.join(repoRoot, 'docker-compose.yml');
    assert.ok(fs.existsSync(dockerComposePath), 'docker-compose.yml must exist');
    const content = fs.readFileSync(dockerComposePath, 'utf8');

    assert.ok(
      !content.includes('prisma db push'),
      'docker-compose.yml must not use prisma db push'
    );
    assert.ok(
      !content.includes('--accept-data-loss'),
      'docker-compose.yml must not accept data loss'
    );
    assert.ok(
      content.includes('prisma migrate deploy'),
      'docker-compose.yml must run prisma migrate deploy'
    );
  });

  test('dependent services must wait for prisma-migrate to complete successfully', () => {
    const dockerComposePath = path.join(repoRoot, 'docker-compose.yml');
    const content = fs.readFileSync(dockerComposePath, 'utf8');

    const authDependsMatch = content.includes('prisma-migrate:\n        condition: service_completed_successfully');
    assert.ok(
      authDependsMatch,
      'Services must depend on prisma-migrate with condition service_completed_successfully'
    );
  });

  test('baseline migration 0_init exists and defines canonical tables', () => {
    const migrationPath = path.join(
      repoRoot,
      'backend/packages/shared/prisma/migrations/0_init/migration.sql'
    );
    assert.ok(fs.existsSync(migrationPath), 'Baseline migration 0_init/migration.sql must exist');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    assert.ok(sql.length > 5000, 'Baseline migration should be substantial DDL');
    assert.ok(sql.includes('CREATE TABLE "users"'), 'Must define users table');
    assert.ok(sql.includes('CREATE TABLE "organizations"'), 'Must define organizations table');
    assert.ok(sql.includes('CREATE TABLE "meetings"'), 'Must define meetings table');
    assert.ok(sql.includes('CREATE TABLE "rooms"'), 'Must define rooms table');
    assert.ok(sql.includes('CREATE TABLE "teams"'), 'Must define teams table');
    assert.ok(sql.includes('CREATE TABLE "activities"'), 'Must define activities table');
  });

  test('package manifests define canonical migration script contracts', () => {
    const sharedPkg = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'backend/packages/shared/package.json'), 'utf8')
    );
    assert.ok(sharedPkg.scripts['prisma:migrate:deploy'], 'shared must have prisma:migrate:deploy');
    assert.ok(sharedPkg.scripts['prisma:migrate:status'], 'shared must have prisma:migrate:status');

    const rootPkg = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
    );
    assert.ok(rootPkg.scripts['db:migrate:deploy'], 'root must have db:migrate:deploy');
    assert.ok(rootPkg.scripts['db:migrate:status'], 'root must have db:migrate:status');
  });

  test('MLTR expand migration preserves legacy recurrence data', () => {
    const migrationPath = path.join(
      repoRoot,
      'backend/packages/shared/prisma/migrations/20261028164500_mltr02_expand_persistence_model/migration.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');

    assert.doesNotMatch(sql, /DROP COLUMN[^;]*(parent_meeting_id|exception_date|action|modified_meeting_id)/i);
    assert.match(sql, /ADD COLUMN "series_id" UUID[,;]/);
    assert.doesNotMatch(sql, /ADD COLUMN "series_id" UUID NOT NULL/);
  });
});
