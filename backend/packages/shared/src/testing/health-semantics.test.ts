import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import {
  HealthManager,
  createHealthRouter,
} from '../health/health-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../../..');

async function withTestServer(
  app: express.Application,
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('P0-05: Health Semantics Contract (Live, Ready, Startup)', () => {
  it('static source verification: all 4 HTTP services wire createHealthRouter and lifecycle hooks', () => {
    const serviceFiles = [
      'backend/packages/room-service/src/app.ts',
      'backend/packages/room-service/src/index.ts',
      'backend/packages/auth-service/src/app.ts',
      'backend/packages/auth-service/src/index.ts',
      'backend/packages/mediasoup-service/src/index.ts',
      'backend/packages/api-gateway/src/middleware/index.ts',
      'backend/packages/api-gateway/src/index.ts',
    ];

    for (const rel of serviceFiles) {
      const full = path.join(REPO_ROOT, rel);
      assert.ok(fs.existsSync(full), `File ${rel} must exist`);
      const content = fs.readFileSync(full, 'utf-8');
      assert.ok(
        content.includes('HealthManager') || content.includes('createHealthRouter'),
        `${rel} must reference health probe abstractions`
      );
    }
  });

  it('HTTP probe router satisfies live, ready, startup, and DB failure isolation', async () => {
    let dbHealthy = true;
    let redisHealthy = true;

    const testManager = new HealthManager({ cacheTtlMs: 0 });
    testManager.registerProbe(
      'postgres',
      async () => {
        if (!dbHealthy) throw new Error('Database connection refused');
        return { status: 'UP', latencyMs: 2 };
      },
      { critical: true, timeoutMs: 500 }
    );
    testManager.registerProbe(
      'redis',
      async () => {
        if (!redisHealthy) throw new Error('Redis connection timed out');
        return { status: 'UP', latencyMs: 1 };
      },
      { critical: true, timeoutMs: 500 }
    );

    const app = express();
    app.use('/health', createHealthRouter(testManager));

    await withTestServer(app, async (baseUrl) => {
      // 1. Before startup is marked, /health/startup must return 503
      const preStartupRes = await fetch(`${baseUrl}/health/startup`);
      assert.equal(preStartupRes.status, 503);
      const preStartupJson = (await preStartupRes.json()) as { status: string; startup: boolean };
      assert.equal(preStartupJson.status, 'DOWN');
      assert.equal(preStartupJson.startup, false);

      // 2. Mark startup complete
      testManager.markStarted();
      const postStartupRes = await fetch(`${baseUrl}/health/startup`);
      assert.equal(postStartupRes.status, 200);
      const postStartupJson = (await postStartupRes.json()) as { status: string; startup: boolean };
      assert.equal(postStartupJson.status, 'UP');
      assert.equal(postStartupJson.startup, true);

      // 3. /health/live must always be 200
      const liveRes = await fetch(`${baseUrl}/health/live`);
      assert.equal(liveRes.status, 200);
      const liveJson = (await liveRes.json()) as { status: string };
      assert.equal(liveJson.status, 'UP');

      // 4. /health/ready must return 200 when dependencies are healthy
      const readyRes = await fetch(`${baseUrl}/health/ready`);
      assert.equal(readyRes.status, 200);
      const readyJson = (await readyRes.json()) as {
        status: string;
        checks: Record<string, { status: string }>;
      };
      assert.equal(readyJson.status, 'UP');
      assert.equal(readyJson.checks.postgres.status, 'UP');
      assert.equal(readyJson.checks.redis.status, 'UP');

      // 5. /health (legacy root) returns 200
      const rootRes = await fetch(`${baseUrl}/health`);
      assert.equal(rootRes.status, 200);

      // 6. KILL POSTGRESQL SIMULATION:
      // Invariant: /health/ready returns 503 within <= 2s, but /health/live REMAINS 200!
      dbHealthy = false;
      const startFail = Date.now();
      const dbDownReadyRes = await fetch(`${baseUrl}/health/ready`);
      const failDuration = Date.now() - startFail;

      assert.equal(dbDownReadyRes.status, 503);
      const dbDownReadyJson = (await dbDownReadyRes.json()) as {
        status: string;
        checks: Record<string, { status: string }>;
      };
      assert.equal(dbDownReadyJson.status, 'DOWN');
      assert.equal(dbDownReadyJson.checks.postgres.status, 'DOWN');
      assert.ok(failDuration < 2000, `Readiness failure response took ${failDuration}ms (< 2s)`);

      // Liveness MUST stay 200 to prevent orchestrator restart loop
      const isolatedLiveRes = await fetch(`${baseUrl}/health/live`);
      assert.equal(isolatedLiveRes.status, 200);
      const isolatedLiveJson = (await isolatedLiveRes.json()) as { status: string };
      assert.equal(isolatedLiveJson.status, 'UP');

      // 7. Legacy /health also returns 503 during DB failure
      const rootDownRes = await fetch(`${baseUrl}/health`);
      assert.equal(rootDownRes.status, 503);

      // 8. Recovery: DB comes back online
      dbHealthy = true;
      const recoveredReadyRes = await fetch(`${baseUrl}/health/ready`);
      assert.equal(recoveredReadyRes.status, 200);
    });
  });

  it('Redis failure brings readiness down to 503 while preserving 200 on liveness', async () => {
    let redisHealthy = true;

    const testManager = new HealthManager({ cacheTtlMs: 0 });
    testManager.registerProbe('redis', async () => {
      if (!redisHealthy) throw new Error('Redis connection refused');
      return { status: 'UP', latencyMs: 1 };
    });

    const app = express();
    app.use('/health', createHealthRouter(testManager));

    await withTestServer(app, async (baseUrl) => {
      assert.equal((await fetch(`${baseUrl}/health/ready`)).status, 200);

      redisHealthy = false;
      const readyRes = await fetch(`${baseUrl}/health/ready`);
      assert.equal(readyRes.status, 503);

      const liveRes = await fetch(`${baseUrl}/health/live`);
      assert.equal(liveRes.status, 200);
    });
  });
});
