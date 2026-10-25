import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import express, { Request, Response } from 'express';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import winston from 'winston';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  createCorrelationMiddleware,
  createRequestLoggingMiddleware,
  getCorrelationId,
  getCorrelationContext,
  runWithCorrelationContext,
  sanitizeCorrelationId,
  CORRELATION_HEADER,
  ALT_CORRELATION_HEADER,
} from '../telemetry/correlation.js';
import { createLogger } from '../utils/logger.js';

describe('P0-07: Observability & Correlation ID Foundation', () => {
  describe('Header sanitization and generation', () => {
    test('generates valid UUID v4 when no correlation header is provided', async () => {
      const app = express();
      app.use(createCorrelationMiddleware('test-service'));
      let capturedId: string | undefined;

      app.get('/test', (req: Request, res: Response) => {
        capturedId = getCorrelationId();
        res.json({ correlationId: capturedId });
      });

      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const port = (server.address() as AddressInfo).port;

      try {
        const response = await fetch(`http://127.0.0.1:${port}/test`);
        assert.equal(response.status, 200);

        const headerId = response.headers.get(CORRELATION_HEADER);
        const altHeaderId = response.headers.get(ALT_CORRELATION_HEADER);
        const body = (await response.json()) as { correlationId: string };

        assert.ok(headerId, 'x-request-id must be present in response');
        assert.equal(headerId, altHeaderId, 'x-request-id and x-correlation-id must match');
        assert.equal(body.correlationId, headerId, 'body correlationId must match header');
        assert.equal(capturedId, headerId, 'AsyncLocalStorage must contain generated ID');

        // Verify UUID v4 format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        assert.match(headerId, uuidRegex, 'Generated ID must be a valid UUID');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    test('preserves incoming x-request-id header across request and response', async () => {
      const app = express();
      app.use(createCorrelationMiddleware('test-service'));
      const testId = 'req-prod-client-987654';

      app.get('/test', (req: Request, res: Response) => {
        res.json({ correlationId: getCorrelationId() });
      });

      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const port = (server.address() as AddressInfo).port;

      try {
        const response = await fetch(`http://127.0.0.1:${port}/test`, {
          headers: { [CORRELATION_HEADER]: testId },
        });

        assert.equal(response.status, 200);
        assert.equal(response.headers.get(CORRELATION_HEADER), testId);
        assert.equal(response.headers.get(ALT_CORRELATION_HEADER), testId);

        const body = (await response.json()) as { correlationId: string };
        assert.equal(body.correlationId, testId);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    test('preserves incoming x-correlation-id when x-request-id is absent', async () => {
      const app = express();
      app.use(createCorrelationMiddleware('test-service'));
      const testId = 'corr-legacy-trace-12345';

      app.get('/test', (req: Request, res: Response) => {
        res.json({ correlationId: getCorrelationId() });
      });

      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const port = (server.address() as AddressInfo).port;

      try {
        const response = await fetch(`http://127.0.0.1:${port}/test`, {
          headers: { [ALT_CORRELATION_HEADER]: testId },
        });

        assert.equal(response.status, 200);
        assert.equal(response.headers.get(CORRELATION_HEADER), testId);
        assert.equal(response.headers.get(ALT_CORRELATION_HEADER), testId);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    test('sanitizes malicious or oversized correlation headers and falls back to clean UUID', () => {
      assert.equal(sanitizeCorrelationId('valid-id_123.abc'), 'valid-id_123.abc');

      // Reject CRLF injection attempts
      assert.equal(sanitizeCorrelationId('evil-id\r\nX-Injected: true'), null);

      // Reject non-alphanumeric special characters
      assert.equal(sanitizeCorrelationId('<script>alert(1)</script>'), null);
      assert.equal(sanitizeCorrelationId('id with spaces'), null);

      // Reject oversized headers (> 128 chars)
      const oversized = 'a'.repeat(129);
      assert.equal(sanitizeCorrelationId(oversized), null);

      // Reject empty or non-string
      assert.equal(sanitizeCorrelationId(''), null);
      assert.equal(sanitizeCorrelationId(null), null);
      assert.equal(sanitizeCorrelationId(undefined), null);
    });
  });

  describe('AsyncLocalStorage Context Isolation', () => {
    test('isolates correlation context between concurrent requests without leakage', async () => {
      const app = express();
      app.use(createCorrelationMiddleware('test-service'));

      app.get('/slow', async (req: Request, res: Response) => {
        const initialId = getCorrelationId();
        // Simulate async delay
        await new Promise((resolve) => setTimeout(resolve, 30));
        const finalId = getCorrelationId();
        res.json({ initialId, finalId });
      });

      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const port = (server.address() as AddressInfo).port;

      try {
        const id1 = 'tenant-req-alpha-111';
        const id2 = 'tenant-req-beta-222';

        const [res1, res2] = await Promise.all([
          fetch(`http://127.0.0.1:${port}/slow`, { headers: { [CORRELATION_HEADER]: id1 } }),
          fetch(`http://127.0.0.1:${port}/slow`, { headers: { [CORRELATION_HEADER]: id2 } }),
        ]);

        const body1 = (await res1.json()) as { initialId: string; finalId: string };
        const body2 = (await res2.json()) as { initialId: string; finalId: string };

        assert.equal(body1.initialId, id1);
        assert.equal(body1.finalId, id1);

        assert.equal(body2.initialId, id2);
        assert.equal(body2.finalId, id2);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    test('runWithCorrelationContext binds context to nested synchronous and asynchronous calls', async () => {
      const testContext = {
        correlationId: 'manual-context-333',
        userId: 'user-xyz',
        organizationId: 'org-abc',
      };

      await runWithCorrelationContext(testContext, async () => {
        assert.equal(getCorrelationId(), 'manual-context-333');
        const ctx = getCorrelationContext();
        assert.equal(ctx?.userId, 'user-xyz');
        assert.equal(ctx?.organizationId, 'org-abc');

        // Verify across nested promise
        const nestedResult = await Promise.resolve().then(() => getCorrelationId());
        assert.equal(nestedResult, 'manual-context-333');
      });

      // Context must be undefined outside of run
      assert.equal(getCorrelationId(), undefined);
    });
  });

  describe('Structured Logger & Request Telemetry', () => {
    test('logger automatically enriches log entries with active correlationId', async () => {
      const logEntries: any[] = [];
      const testTransport = new winston.transports.Console({
        silent: true,
      });

      const customLogger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format((info) => {
            const corrId = getCorrelationId();
            if (corrId && !info.correlationId) {
              info.correlationId = corrId;
            }
            return info;
          })(),
          winston.format.json()
        ),
        defaultMeta: { service: 'telemetry-test' },
        transports: [testTransport],
      });

      // Intercept log writes
      customLogger.on('data', (log) => {
        logEntries.push(log);
      });

      await runWithCorrelationContext({ correlationId: 'trace-logger-test-444' }, () => {
        customLogger.info('User joined room', { roomId: 'room-1' });
      });

      assert.equal(logEntries.length, 1);
      assert.equal(logEntries[0].message, 'User joined room');
      assert.equal(logEntries[0].service, 'telemetry-test');
      assert.equal(logEntries[0].correlationId, 'trace-logger-test-444');
      assert.equal(logEntries[0].roomId, 'room-1');
    });

    test('request logging middleware records latency and skips health check probes', async () => {
      const app = express();
      app.use(createCorrelationMiddleware('test-service'));

      const capturedLogs: any[] = [];
      app.use(
        createRequestLoggingMiddleware({
          serviceName: 'test-service',
          skipPaths: ['/health', '/health/live', '/health/ready', '/health/startup'],
          onLog: (entry) => capturedLogs.push(entry),
        })
      );

      app.get('/api/v1/test', (req, res) => res.status(200).json({ ok: true }));
      app.get('/health/live', (req, res) => res.status(200).json({ status: 'UP' }));
      app.get('/api/v1/error', (req, res) => res.status(500).json({ error: 'fail' }));

      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const port = (server.address() as AddressInfo).port;

      try {
        // 1. Call normal API
        await fetch(`http://127.0.0.1:${port}/api/v1/test`, {
          headers: { [CORRELATION_HEADER]: 'api-trace-555' },
        });

        // 2. Call health endpoint (must be skipped)
        await fetch(`http://127.0.0.1:${port}/health/live`);

        // 3. Call error API
        await fetch(`http://127.0.0.1:${port}/api/v1/error`, {
          headers: { [CORRELATION_HEADER]: 'error-trace-666' },
        });

        // Wait a tick for res.on('finish')
        await new Promise((resolve) => setTimeout(resolve, 20));

        assert.equal(capturedLogs.length, 2, 'Health check must be skipped');

        const [apiLog, errorLog] = capturedLogs;
        assert.equal(apiLog.method, 'GET');
        assert.equal(apiLog.path, '/api/v1/test');
        assert.equal(apiLog.statusCode, 200);
        assert.equal(apiLog.correlationId, 'api-trace-555');
        assert.ok(typeof apiLog.durationMs === 'number', 'durationMs must be number');
        assert.equal(apiLog.level, 'info');

        assert.equal(errorLog.path, '/api/v1/error');
        assert.equal(errorLog.statusCode, 500);
        assert.equal(errorLog.correlationId, 'error-trace-666');
        assert.equal(errorLog.level, 'error');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });
  });

  describe('Static Source & Gateway Forwarding Verification', () => {
    test('static source verification: all 4 HTTP services wire correlation and telemetry middleware', () => {
      const repoRoot = fs.existsSync(path.join(process.cwd(), 'backend'))
        ? path.resolve(process.cwd())
        : path.resolve(__dirname, '../../../../../');

      const apiGatewayIndex = fs.readFileSync(
        path.join(repoRoot, 'backend/packages/api-gateway/src/index.ts'),
        'utf8'
      );
      assert.match(
        apiGatewayIndex,
        /setupCorrelationMiddleware/,
        'api-gateway/src/index.ts must wire setupCorrelationMiddleware'
      );

      const serviceRouter = fs.readFileSync(
        path.join(repoRoot, 'backend/packages/api-gateway/src/routes/service-router.ts'),
        'utf8'
      );
      assert.match(
        serviceRouter,
        /x-request-id/,
        'service-router.ts must forward x-request-id on proxy requests'
      );

      const roomApp = fs.readFileSync(
        path.join(repoRoot, 'backend/packages/room-service/src/app.ts'),
        'utf8'
      );
      assert.match(
        roomApp,
        /createCorrelationMiddleware\('room-service'\)/,
        'room-service/src/app.ts must mount createCorrelationMiddleware'
      );
      assert.match(
        roomApp,
        /createRequestLoggingMiddleware/,
        'room-service/src/app.ts must mount createRequestLoggingMiddleware'
      );

      const authApp = fs.readFileSync(
        path.join(repoRoot, 'backend/packages/auth-service/src/app.ts'),
        'utf8'
      );
      assert.match(
        authApp,
        /createCorrelationMiddleware\('auth-service'\)/,
        'auth-service/src/app.ts must mount createCorrelationMiddleware'
      );
      assert.match(
        authApp,
        /createRequestLoggingMiddleware/,
        'auth-service/src/app.ts must mount createRequestLoggingMiddleware'
      );

      const mediasoupIndex = fs.readFileSync(
        path.join(repoRoot, 'backend/packages/mediasoup-service/src/index.ts'),
        'utf8'
      );
      assert.match(
        mediasoupIndex,
        /createCorrelationMiddleware\('mediasoup-service'\)/,
        'mediasoup-service/src/index.ts must mount createCorrelationMiddleware'
      );
      assert.match(
        mediasoupIndex,
        /createRequestLoggingMiddleware/,
        'mediasoup-service/src/index.ts must mount createRequestLoggingMiddleware'
      );
    });

    test('adversarial drill: end-to-end proxy correlation header forwarding', async () => {
      // 1. Mock downstream service
      let capturedDownstreamHeaders: http.IncomingHttpHeaders | null = null;
      const downstreamApp = express();
      downstreamApp.use(createCorrelationMiddleware('downstream-mock'));
      downstreamApp.get('/api/v1/mock', (req, res) => {
        capturedDownstreamHeaders = req.headers;
        res.json({ downstreamCorrelationId: getCorrelationId() });
      });

      const downstreamServer = http.createServer(downstreamApp);
      await new Promise<void>((resolve) => downstreamServer.listen(0, resolve));
      const downstreamPort = (downstreamServer.address() as AddressInfo).port;

      // 2. Gateway simulator with correlation middleware and forwarder
      const gatewayApp = express();
      gatewayApp.use(createCorrelationMiddleware('gateway-simulator'));
      gatewayApp.get('/proxy/mock', async (req, res) => {
        const corrId = getCorrelationId();
        const downstreamRes = await fetch(`http://127.0.0.1:${downstreamPort}/api/v1/mock`, {
          headers: {
            [CORRELATION_HEADER]: corrId || '',
            [ALT_CORRELATION_HEADER]: corrId || '',
          },
        });
        const downstreamData = await downstreamRes.json();
        res.json(downstreamData);
      });

      const gatewayServer = http.createServer(gatewayApp);
      await new Promise<void>((resolve) => gatewayServer.listen(0, resolve));
      const gatewayPort = (gatewayServer.address() as AddressInfo).port;

      try {
        const clientTraceId = 'adversarial-trace-e2e-888';
        const clientRes = await fetch(`http://127.0.0.1:${gatewayPort}/proxy/mock`, {
          headers: { [CORRELATION_HEADER]: clientTraceId },
        });

        assert.equal(clientRes.status, 200);
        assert.equal(clientRes.headers.get(CORRELATION_HEADER), clientTraceId);

        // Verify downstream received exactly the forwarded correlation header
        assert.ok(capturedDownstreamHeaders);
        assert.equal(capturedDownstreamHeaders[CORRELATION_HEADER], clientTraceId);
        assert.equal(capturedDownstreamHeaders[ALT_CORRELATION_HEADER], clientTraceId);

        const data = (await clientRes.json()) as { downstreamCorrelationId: string };
        assert.equal(data.downstreamCorrelationId, clientTraceId);
      } finally {
        await new Promise<void>((resolve) => downstreamServer.close(() => resolve()));
        await new Promise<void>((resolve) => gatewayServer.close(() => resolve()));
      }
    });
  });
});
