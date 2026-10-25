import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HealthManager,
  createPrismaProbe,
  createRedisProbe,
  createHttpProbe,
} from './health-manager.js';

describe('P0-05: Health Semantics & Probe Manager', () => {
  it('startup probe returns DOWN before markStarted() and UP after', () => {
    const manager = new HealthManager();
    const initialReport = manager.getStartupReport();
    assert.equal(initialReport.status, 'DOWN');
    assert.equal(initialReport.startup, false);

    manager.markStarted();

    const startedReport = manager.getStartupReport();
    assert.equal(startedReport.status, 'UP');
    assert.equal(startedReport.startup, true);
  });

  it('liveness probe returns UP and does not execute dependency probes', async () => {
    const manager = new HealthManager();
    let probeCalled = false;
    manager.registerProbe('db', async () => {
      probeCalled = true;
      return true;
    });

    const report = manager.getLivenessReport();
    assert.equal(report.status, 'UP');
    assert.equal(typeof report.uptime, 'number');
    assert.equal(probeCalled, false, 'Liveness probe must never execute dependency probes');
  });

  it('readiness probe returns UP when all critical probes pass', async () => {
    const manager = new HealthManager({ cacheTtlMs: 0 });
    manager.registerProbe('db', async () => ({ status: 'UP', latencyMs: 5 }), { critical: true });
    manager.registerProbe('redis', async () => ({ status: 'UP', latencyMs: 2 }), { critical: true });

    const report = await manager.getReadinessReport();
    assert.equal(report.status, 'UP');
    assert.equal(report.checks.db.status, 'UP');
    assert.equal(report.checks.redis.status, 'UP');
  });

  it('readiness probe returns DOWN when a critical probe fails', async () => {
    const manager = new HealthManager({ cacheTtlMs: 0 });
    manager.registerProbe('db', async () => ({ status: 'DOWN', error: 'Connection refused' }), {
      critical: true,
    });
    manager.registerProbe('redis', async () => ({ status: 'UP', latencyMs: 2 }), { critical: true });

    const report = await manager.getReadinessReport();
    assert.equal(report.status, 'DOWN');
    assert.equal(report.checks.db.status, 'DOWN');
    assert.equal(report.checks.db.error, 'Connection refused');
    assert.equal(report.checks.redis.status, 'UP');
  });

  it('non-critical probe failure does not bring overall readiness DOWN', async () => {
    const manager = new HealthManager({ cacheTtlMs: 0 });
    manager.registerProbe('db', async () => ({ status: 'UP', latencyMs: 3 }), { critical: true });
    manager.registerProbe('optional-cache', async () => ({ status: 'DOWN', error: 'Cache unavailable' }), {
      critical: false,
    });

    const report = await manager.getReadinessReport();
    assert.equal(report.status, 'UP');
    assert.equal(report.checks['optional-cache'].status, 'DOWN');
  });

  it('enforces probe timeout and marks timed-out probe DOWN', async () => {
    const manager = new HealthManager({ cacheTtlMs: 0, defaultTimeoutMs: 100 });
    manager.registerProbe(
      'hanging-service',
      () => new Promise((resolve) => setTimeout(() => resolve(true), 500)),
      { critical: true, timeoutMs: 50 }
    );

    const start = Date.now();
    const report = await manager.getReadinessReport();
    const elapsed = Date.now() - start;

    assert.equal(report.status, 'DOWN');
    assert.equal(report.checks['hanging-service'].status, 'DOWN');
    assert.match(report.checks['hanging-service'].error || '', /timed out/i);
    assert.ok(elapsed < 300, `Timeout must resolve quickly, took ${elapsed}ms`);
  });

  it('caches readiness result to protect against probe storms', async () => {
    const manager = new HealthManager({ cacheTtlMs: 500 });
    let executionCount = 0;
    manager.registerProbe('expensive-check', async () => {
      executionCount++;
      return { status: 'UP', latencyMs: 1 };
    });

    await manager.getReadinessReport();
    await manager.getReadinessReport();
    await manager.getReadinessReport();

    assert.equal(executionCount, 1, 'Within cacheTtlMs, probe must only execute once');
  });

  it('createPrismaProbe executes query and reports latency or sanitized failure', async () => {
    const mockPrismaSuccess = {
      $queryRaw: async () => [{ '?column?': 1 }],
    };
    const successProbe = createPrismaProbe(mockPrismaSuccess as any, { timeoutMs: 1000 });
    const successResult = await successProbe();
    assert.equal(typeof successResult, 'object');
    if (typeof successResult === 'object') {
      assert.equal(successResult.status, 'UP');
      assert.equal(typeof successResult.latencyMs, 'number');
    }

    const mockPrismaFail = {
      $queryRaw: async () => {
        throw new Error('Connection refused at postgresql://user:secretpassword@localhost:5432/db');
      },
    };
    const failProbe = createPrismaProbe(mockPrismaFail as any, { timeoutMs: 1000 });
    const failResult = await failProbe();
    assert.equal(typeof failResult, 'object');
    if (typeof failResult === 'object') {
      assert.equal(failResult.status, 'DOWN');
      assert.ok(!failResult.error?.includes('secretpassword'), 'Error must not leak database password');
    }
  });

  it('createRedisProbe executes ping and reports latency or failure', async () => {
    const mockRedisSuccess = {
      ping: async () => 'PONG',
    };
    const successProbe = createRedisProbe(mockRedisSuccess, { timeoutMs: 1000 });
    const successResult = await successProbe();
    assert.equal(typeof successResult, 'object');
    if (typeof successResult === 'object') {
      assert.equal(successResult.status, 'UP');
      assert.equal(typeof successResult.latencyMs, 'number');
    }

    const mockRedisFail = {
      ping: async () => {
        throw new Error('Redis connection closed');
      },
    };
    const failProbe = createRedisProbe(mockRedisFail, { timeoutMs: 1000 });
    const failResult = await failProbe();
    assert.equal(typeof failResult, 'object');
    if (typeof failResult === 'object') {
      assert.equal(failResult.status, 'DOWN');
      assert.match(failResult.error || '', /Redis connection closed/);
    }
  });
});
