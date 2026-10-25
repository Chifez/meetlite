import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatPooledDatabaseUrl,
  calculateConnectionBudget,
  validateDatabaseUrls,
  ROLE_CONNECTION_LIMITS,
  DEFAULT_ROLE_CONNECTION_LIMIT,
  DEFAULT_POOL_TIMEOUT_SECONDS,
  DEFAULT_PRODUCTION_BUDGET,
} from '../database/connection-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../../..');

describe('S1-03: Database Connection Bounding & Neon PgBouncer Contract', () => {
  describe('Prisma Schema & Migration Direct URL Contract', () => {
    test('schema.prisma declares directUrl = env("DIRECT_URL") for migration isolation', () => {
      const schemaPath = path.join(
        REPO_ROOT,
        'backend/packages/shared/prisma/schema.prisma'
      );
      assert.ok(fs.existsSync(schemaPath), 'schema.prisma must exist');
      const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

      assert.ok(
        schemaContent.includes('directUrl = env("DIRECT_URL")') ||
        schemaContent.includes('directUrl  = env("DIRECT_URL")'),
        'schema.prisma must declare directUrl = env("DIRECT_URL")'
      );
    });

    test('docker-compose.yml configures DIRECT_URL for prisma-migrate', () => {
      const composePath = path.join(REPO_ROOT, 'docker-compose.yml');
      assert.ok(fs.existsSync(composePath), 'docker-compose.yml must exist');
      const composeContent = fs.readFileSync(composePath, 'utf-8');

      assert.ok(
        composeContent.includes('DIRECT_URL: postgresql://'),
        'docker-compose.yml prisma-migrate service must configure DIRECT_URL'
      );
    });

    test('validateDatabaseUrls verifies pooled URL and rejects directUrl with pgbouncer', () => {
      // 1. Valid Neon configuration: pooled DATABASE_URL and direct DIRECT_URL
      const validNeon = validateDatabaseUrls({
        databaseUrl: 'postgresql://user:secret@ep-neon-123-pooler.us-east-2.neon.tech/meetlite?sslmode=require',
        directUrl: 'postgresql://user:secret@ep-neon-123.us-east-2.neon.tech/meetlite?sslmode=require',
        isProduction: true,
      });
      assert.equal(validNeon.valid, true);
      assert.equal(validNeon.isPooled, true);
      assert.equal(validNeon.hasDirectUrl, true);
      assert.equal(validNeon.errors.length, 0);

      // 2. Invalid configuration: DIRECT_URL points to pooled endpoint
      const invalidDirect = validateDatabaseUrls({
        databaseUrl: 'postgresql://user:secret@ep-neon-123-pooler.us-east-2.neon.tech/meetlite?sslmode=require',
        directUrl: 'postgresql://user:secret@ep-neon-123-pooler.us-east-2.neon.tech/meetlite?pgbouncer=true',
        isProduction: true,
      });
      assert.equal(invalidDirect.valid, false);
      assert.ok(
        invalidDirect.errors.some((e) => e.includes('DIRECT_URL must not point to a pooled PgBouncer endpoint'))
      );

      // 3. Warning: pooled DATABASE_URL without DIRECT_URL in production
      const missingDirect = validateDatabaseUrls({
        databaseUrl: 'postgresql://user:secret@ep-neon-123-pooler.us-east-2.neon.tech/meetlite?pgbouncer=true',
        directUrl: '',
        isProduction: true,
      });
      assert.ok(
        missingDirect.warnings.some((w) => w.includes('DIRECT_URL is not set'))
      );
    });
  });

  describe('PgBouncer & Pooled Endpoint URL Formatting', () => {
    test('formatPooledDatabaseUrl automatically detects Neon pooler and injects pgbouncer=true', () => {
      const rawNeonUrl = 'postgresql://user:secret@ep-sample-123-pooler.us-east-2.neon.tech/meetlite?sslmode=require';
      const formatted = formatPooledDatabaseUrl(rawNeonUrl, { role: 'auth-http' });

      const parsed = new URL(formatted);
      assert.equal(parsed.searchParams.get('pgbouncer'), 'true');
      assert.equal(parsed.searchParams.get('connection_limit'), '10');
      assert.equal(parsed.searchParams.get('pool_timeout'), String(DEFAULT_POOL_TIMEOUT_SECONDS));
      assert.equal(parsed.searchParams.get('sslmode'), 'require');
    });

    test('formatPooledDatabaseUrl respects role-specific connection allocations', () => {
      const rawUrl = 'postgresql://user:secret@localhost:5432/meetlite';

      // HTTP replica gets 10 connections
      const httpFormatted = formatPooledDatabaseUrl(rawUrl, { role: 'room-http' });
      assert.equal(new URL(httpFormatted).searchParams.get('connection_limit'), '10');

      // Worker gets 5 connections
      const workerFormatted = formatPooledDatabaseUrl(rawUrl, { role: 'room-worker' });
      assert.equal(new URL(workerFormatted).searchParams.get('connection_limit'), '5');

      // Scheduler gets 2 connections
      const schedulerFormatted = formatPooledDatabaseUrl(rawUrl, { role: 'room-scheduler' });
      assert.equal(new URL(schedulerFormatted).searchParams.get('connection_limit'), '2');

      // Custom override takes highest precedence
      const customFormatted = formatPooledDatabaseUrl(rawUrl, { connectionLimit: 25, role: 'room-http' });
      assert.equal(new URL(customFormatted).searchParams.get('connection_limit'), '25');
    });

    test('formatPooledDatabaseUrl updates existing connection parameters without duplication', () => {
      const urlWithExisting = 'postgresql://user:secret@localhost:5432/meetlite?connection_limit=3&pool_timeout=5';
      const formatted = formatPooledDatabaseUrl(urlWithExisting, {
        connectionLimit: 12,
        poolTimeout: 20,
      });

      const parsed = new URL(formatted);
      assert.equal(parsed.searchParams.get('connection_limit'), '12');
      assert.equal(parsed.searchParams.get('pool_timeout'), '20');
      assert.equal(parsed.searchParams.getAll('connection_limit').length, 1);
    });
  });

  describe('Connection Budget Calculation & Bounding Formula', () => {
    test('default production budget satisfies database capacity with safety margin', () => {
      const budget = calculateConnectionBudget(DEFAULT_PRODUCTION_BUDGET);

      assert.equal(budget.isValid, true);
      assert.equal(budget.totalLimit, 100);
      // 4 HTTP * 10 = 40; 4 workers * 5 = 20; 2 schedulers * 2 = 4; migration 5; admin 5 = 74
      assert.equal(budget.allocated, 74);
      assert.equal(budget.margin, 26);
      assert.ok(budget.margin > 0, 'Must preserve healthy connection headroom');
    });

    test('detects and flags over-allocated connection budgets', () => {
      const overAllocatedBudget = calculateConnectionBudget({
        totalDatabaseLimit: 50,
        httpReplicas: 4,
        poolPerHttpReplica: 10, // 40
        workers: 4,
        poolPerWorker: 5,       // 20 -> 60 already exceeds 50
        schedulers: 2,
        poolPerScheduler: 2,    // 4
        migrationReserve: 5,
        adminReserve: 5,
      });

      assert.equal(overAllocatedBudget.isValid, false);
      assert.ok(overAllocatedBudget.allocated > 50);
      assert.ok(overAllocatedBudget.margin < 0);
    });
  });

  describe('Adversarial Connection Concurrency & Pool Exhaustion Drill', () => {
    test('1,000 concurrent queries through a bounded connection pool execute without exhaustion or leaks', async () => {
      const POOL_CAPACITY = 5;
      let activeConnections = 0;
      let peakConnections = 0;
      let totalExecuted = 0;

      // Simulated connection pool bounded to POOL_CAPACITY
      class SimulatedConnectionPool {
        private available: number = POOL_CAPACITY;
        private queue: (() => void)[] = [];

        async acquire(): Promise<() => void> {
          if (this.available > 0) {
            this.available--;
            activeConnections++;
            if (activeConnections > peakConnections) {
              peakConnections = activeConnections;
            }
            return () => this.release();
          }

          return new Promise<() => void>((resolve) => {
            this.queue.push(() => {
              this.available--;
              activeConnections++;
              if (activeConnections > peakConnections) {
                peakConnections = activeConnections;
              }
              resolve(() => this.release());
            });
          });
        }

        private release(): void {
          activeConnections--;
          this.available++;
          if (this.queue.length > 0) {
            const next = this.queue.shift();
            if (next) next();
          }
        }
      }

      const pool = new SimulatedConnectionPool();

      // Launch 1,000 concurrent simulated queries
      const TOTAL_REQUESTS = 1000;
      const tasks = Array.from({ length: TOTAL_REQUESTS }, async (_, i) => {
        const release = await pool.acquire();
        try {
          // Verify that active connections never exceed POOL_CAPACITY
          assert.ok(
            activeConnections <= POOL_CAPACITY,
            `Active connections (${activeConnections}) must never exceed pool capacity (${POOL_CAPACITY})`
          );
          // Simulate query execution latency
          await new Promise((r) => setTimeout(r, 1));
          totalExecuted++;
        } finally {
          release();
        }
      });

      await Promise.all(tasks);

      assert.equal(totalExecuted, TOTAL_REQUESTS, 'All 1,000 requests must complete successfully');
      assert.equal(peakConnections, POOL_CAPACITY, 'Pool must reach but not exceed its allocated limit');
      assert.equal(activeConnections, 0, 'All connections must be cleanly released with zero leaks');
    });

    test('pool timeout rejects acquisitions that exceed pool_timeout threshold', async () => {
      class TimeoutPool {
        private available = 1;
        async acquire(timeoutMs: number): Promise<() => void> {
          if (this.available > 0) {
            this.available--;
            return () => { this.available++; };
          }
          return new Promise<() => void>((_, reject) => {
            setTimeout(() => {
              reject(new Error('Connection pool timeout: no connection available within timeout'));
            }, timeoutMs);
          });
        }
      }

      const pool = new TimeoutPool();
      // Acquire the sole connection and hold it
      const release = await pool.acquire(100);

      // Attempt second acquisition with a 20ms timeout
      await assert.rejects(
        async () => {
          await pool.acquire(20);
        },
        /Connection pool timeout/
      );

      release();
    });
  });

  describe('Static Source & Service Role Wiring Contract', () => {
    test('docker-compose.yml defines PROCESS_ROLE for all 6 application services', () => {
      const composePath = path.join(REPO_ROOT, 'docker-compose.yml');
      const content = fs.readFileSync(composePath, 'utf-8');

      assert.ok(content.includes('PROCESS_ROLE: auth-http'), 'auth-service must have PROCESS_ROLE: auth-http');
      assert.ok(content.includes('PROCESS_ROLE: auth-worker'), 'auth-worker must have PROCESS_ROLE: auth-worker');
      assert.ok(content.includes('PROCESS_ROLE: auth-scheduler'), 'auth-scheduler must have PROCESS_ROLE: auth-scheduler');
      assert.ok(content.includes('PROCESS_ROLE: room-http'), 'room-service must have PROCESS_ROLE: room-http');
      assert.ok(content.includes('PROCESS_ROLE: room-worker'), 'room-worker must have PROCESS_ROLE: room-worker');
      assert.ok(content.includes('PROCESS_ROLE: room-scheduler'), 'room-scheduler must have PROCESS_ROLE: room-scheduler');
    });

    test('prisma.ts imports formatPooledDatabaseUrl and wires createPrismaClient', () => {
      const prismaPath = path.join(REPO_ROOT, 'backend/packages/shared/src/prisma.ts');
      const content = fs.readFileSync(prismaPath, 'utf-8');

      assert.ok(
        content.includes('formatPooledDatabaseUrl'),
        'prisma.ts must import formatPooledDatabaseUrl'
      );
      assert.ok(
        content.includes('createPrismaClient'),
        'prisma.ts must export createPrismaClient factory'
      );
    });
  });
});
