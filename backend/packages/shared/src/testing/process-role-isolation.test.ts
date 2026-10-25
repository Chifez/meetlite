import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../../../');

describe('P0-03: Process-Role Isolation Contract', () => {
  test('room-service HTTP entry point does not start workers or import crons', () => {
    const indexPath = path.join(repoRoot, 'backend/packages/room-service/src/index.ts');
    assert.ok(fs.existsSync(indexPath), 'room-service/src/index.ts must exist');
    const content = fs.readFileSync(indexPath, 'utf8');

    assert.ok(
      !content.includes('new NotificationWorker'),
      'room-service/src/index.ts must not instantiate NotificationWorker'
    );
    assert.ok(
      !content.includes('new VideoProcessingWorker'),
      'room-service/src/index.ts must not instantiate VideoProcessingWorker'
    );
    assert.ok(
      !content.includes("import './jobs/recurrence.job.js'"),
      'room-service/src/index.ts must not import recurrence cron on startup'
    );
  });

  test('auth-service HTTP entry point does not start workers or import crons', () => {
    const indexPath = path.join(repoRoot, 'backend/packages/auth-service/src/index.ts');
    assert.ok(fs.existsSync(indexPath), 'auth-service/src/index.ts must exist');
    const content = fs.readFileSync(indexPath, 'utf8');

    assert.ok(
      !content.includes('new EmailWorker'),
      'auth-service/src/index.ts must not instantiate EmailWorker'
    );
    assert.ok(
      !content.includes("import './jobs/usage-reset.job.js'"),
      'auth-service/src/index.ts must not import usage-reset cron on startup'
    );
    assert.ok(
      !content.includes("import './jobs/plan-expiration.job.js'"),
      'auth-service/src/index.ts must not import plan-expiration cron on startup'
    );
    assert.ok(
      !content.includes("import './jobs/plan-expiry-warning.job.js'"),
      'auth-service/src/index.ts must not import plan-expiry-warning cron on startup'
    );
  });

  test('dedicated worker and scheduler entry points exist for room-service and auth-service', () => {
    const roomWorker = path.join(repoRoot, 'backend/packages/room-service/src/worker.ts');
    const roomScheduler = path.join(repoRoot, 'backend/packages/room-service/src/scheduler.ts');
    const roomApp = path.join(repoRoot, 'backend/packages/room-service/src/app.ts');

    const authWorker = path.join(repoRoot, 'backend/packages/auth-service/src/worker.ts');
    const authScheduler = path.join(repoRoot, 'backend/packages/auth-service/src/scheduler.ts');
    const authApp = path.join(repoRoot, 'backend/packages/auth-service/src/app.ts');

    assert.ok(fs.existsSync(roomWorker), 'room-service worker.ts must exist');
    assert.ok(fs.existsSync(roomScheduler), 'room-service scheduler.ts must exist');
    assert.ok(fs.existsSync(roomApp), 'room-service app.ts must exist');

    assert.ok(fs.existsSync(authWorker), 'auth-service worker.ts must exist');
    assert.ok(fs.existsSync(authScheduler), 'auth-service scheduler.ts must exist');
    assert.ok(fs.existsSync(authApp), 'auth-service app.ts must exist');
  });

  test('cron jobs export explicit lifecycle functions rather than top-level side effects', () => {
    const recurrenceJob = fs.readFileSync(
      path.join(repoRoot, 'backend/packages/room-service/src/jobs/recurrence.job.ts'),
      'utf8'
    );
    assert.ok(
      recurrenceJob.includes('export function startRecurrenceScheduler'),
      'recurrence.job.ts must export startRecurrenceScheduler'
    );
    assert.ok(
      !recurrenceJob.match(/^cron\.schedule\(/m),
      'recurrence.job.ts must not execute top-level cron.schedule'
    );

    const usageResetJob = fs.readFileSync(
      path.join(repoRoot, 'backend/packages/auth-service/src/jobs/usage-reset.job.ts'),
      'utf8'
    );
    assert.ok(
      usageResetJob.includes('export function startUsageResetScheduler'),
      'usage-reset.job.ts must export startUsageResetScheduler'
    );

    const planExpirationJob = fs.readFileSync(
      path.join(repoRoot, 'backend/packages/auth-service/src/jobs/plan-expiration.job.ts'),
      'utf8'
    );
    assert.ok(
      planExpirationJob.includes('export function startPlanExpirationScheduler'),
      'plan-expiration.job.ts must export startPlanExpirationScheduler'
    );

    const planExpiryWarningJob = fs.readFileSync(
      path.join(repoRoot, 'backend/packages/auth-service/src/jobs/plan-expiry-warning.job.ts'),
      'utf8'
    );
    assert.ok(
      planExpiryWarningJob.includes('export function startPlanExpiryWarningScheduler'),
      'plan-expiry-warning.job.ts must export startPlanExpiryWarningScheduler'
    );
  });

  test('docker-compose.yml defines separate services for workers and schedulers with no port collisions', () => {
    const dockerComposePath = path.join(repoRoot, 'docker-compose.yml');
    const content = fs.readFileSync(dockerComposePath, 'utf8');

    assert.ok(content.includes('room-worker:'), 'docker-compose must define room-worker');
    assert.ok(content.includes('room-scheduler:'), 'docker-compose must define room-scheduler');
    assert.ok(content.includes('auth-worker:'), 'docker-compose must define auth-worker');
    assert.ok(content.includes('auth-scheduler:'), 'docker-compose must define auth-scheduler');

    // Verify workers and schedulers do not bind host ports
    const roomWorkerBlock = content.split('room-worker:')[1].split('\n\n')[0];
    assert.ok(!roomWorkerBlock.includes('ports:'), 'room-worker must not expose host ports');

    const authWorkerBlock = content.split('auth-worker:')[1].split('\n\n')[0];
    assert.ok(!authWorkerBlock.includes('ports:'), 'auth-worker must not expose host ports');
  });

  test('package manifests define role-specific start scripts', () => {
    const roomPkg = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'backend/packages/room-service/package.json'), 'utf8')
    );
    assert.ok(roomPkg.scripts['start:http'], 'room-service must have start:http');
    assert.ok(roomPkg.scripts['start:worker'], 'room-service must have start:worker');
    assert.ok(roomPkg.scripts['start:scheduler'], 'room-service must have start:scheduler');

    const authPkg = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'backend/packages/auth-service/package.json'), 'utf8')
    );
    assert.ok(authPkg.scripts['start:http'], 'auth-service must have start:http');
    assert.ok(authPkg.scripts['start:worker'], 'auth-service must have start:worker');
    assert.ok(authPkg.scripts['start:scheduler'], 'auth-service must have start:scheduler');
  });
});
