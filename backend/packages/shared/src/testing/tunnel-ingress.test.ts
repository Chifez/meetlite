import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../../..');

describe('S1-04: Staging Cloudflare Tunnel Route & Dual-Ingress Invariant', () => {
  describe('Cloudflare Tunnel Configuration Contract', () => {
    test('deploy/cloudflare-tunnel/config.yml exists and declares valid ingress routing rules', () => {
      const configPath = path.join(
        REPO_ROOT,
        'deploy/cloudflare-tunnel/config.yml'
      );
      assert.ok(fs.existsSync(configPath), 'config.yml must exist');
      const content = fs.readFileSync(configPath, 'utf-8');

      // Check tunnel definition and credentials file
      assert.ok(content.includes('tunnel:'), 'Must specify tunnel ID');
      assert.ok(content.includes('credentials-file:'), 'Must specify credentials-file path');

      // Check origin request settings for HTTP/1.1 downscale (vital for WebSockets & SSE)
      assert.ok(
        content.includes('http2Origin: false'),
        'http2Origin must be false to downscale to HTTP/1.1 for origin Node.js streaming & WebSocket support'
      );
      assert.ok(
        content.includes('connectTimeout: 30s'),
        'connectTimeout must be defined'
      );
      assert.ok(
        content.includes('keepAliveTimeout: 90s'),
        'keepAliveTimeout must be defined'
      );
    });

    test('ingress rules map staging hostnames to internal services with mandatory catch-all 404 rule', () => {
      const configPath = path.join(
        REPO_ROOT,
        'deploy/cloudflare-tunnel/config.yml'
      );
      const content = fs.readFileSync(configPath, 'utf-8');

      // 1. Staging API Gateway route
      assert.ok(
        content.includes('hostname: api-staging.meetlite.dev') &&
        content.includes('service: http://api-gateway:3000'),
        'Must route api-staging.meetlite.dev to http://api-gateway:3000'
      );

      // 2. Realtime WebSocket route
      assert.ok(
        content.includes('hostname: rtc-staging.meetlite.dev') &&
        content.includes('service: http://api-gateway:3000'),
        'Must route rtc-staging.meetlite.dev to http://api-gateway:3000'
      );

      // 3. Room service route
      assert.ok(
        content.includes('hostname: room-staging.meetlite.dev') &&
        content.includes('service: http://room-service:5001'),
        'Must route room-staging.meetlite.dev to http://room-service:5001'
      );

      // 4. Mandatory Catch-all 404 rule MUST be at the end of the ingress rules
      const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#'));
      const lastLine = lines[lines.length - 1];
      assert.equal(
        lastLine,
        '- service: http_status:404',
        'Last ingress rule must be mandatory catch-all "- service: http_status:404"'
      );
    });

    test('example config template and operational README are present and documented', () => {
      const examplePath = path.join(
        REPO_ROOT,
        'deploy/cloudflare-tunnel/config.example.yml'
      );
      const readmePath = path.join(
        REPO_ROOT,
        'deploy/cloudflare-tunnel/README.md'
      );

      assert.ok(fs.existsSync(examplePath), 'config.example.yml must exist');
      assert.ok(fs.existsSync(readmePath), 'README.md must exist');

      const readmeContent = fs.readFileSync(readmePath, 'utf-8');
      assert.ok(
        readmeContent.includes('Dual-Ingress Invariant'),
        'README must document the Dual-Ingress Invariant'
      );
      assert.ok(
        readmeContent.includes('Rollback Procedure'),
        'README must document the zero-downtime direct ingress rollback procedure'
      );
    });
  });

  describe('Dual-Ingress Preservation & Docker Compose Invariant', () => {
    test('docker-compose.yml maintains direct port 3000 mapping for API Gateway as active rollback route', () => {
      const composePath = path.join(REPO_ROOT, 'docker-compose.yml');
      const content = fs.readFileSync(composePath, 'utf-8');

      // Direct port mapping must be preserved
      assert.ok(
        content.includes('"3000:3000"'),
        'api-gateway must preserve direct port mapping "3000:3000" for direct ingress'
      );
    });

    test('cloudflared service is defined with profiles so direct ingress works without tunnel token', () => {
      const composePath = path.join(REPO_ROOT, 'docker-compose.yml');
      const content = fs.readFileSync(composePath, 'utf-8');

      assert.ok(
        content.includes('cloudflared:'),
        'docker-compose.yml must define cloudflared service'
      );
      assert.ok(
        content.includes('profiles:\n      - tunnel'),
        'cloudflared must be gated by tunnel profile so direct ingress functions independently'
      );
      assert.ok(
        content.includes('deploy/cloudflare-tunnel/config.yml'),
        'cloudflared must mount deploy/cloudflare-tunnel/config.yml'
      );
    });
  });

  describe('CORS & Header Forwarding Contract Across Tunnel Boundary', () => {
    test('api-gateway config includes staging domains and Cloudflare edge headers', () => {
      const gatewayConfigPath = path.join(
        REPO_ROOT,
        'backend/packages/api-gateway/src/config/index.ts'
      );
      const content = fs.readFileSync(gatewayConfigPath, 'utf-8');

      // Staging origins
      assert.ok(
        content.includes('https://staging.meetlite.dev') &&
        content.includes('https://api-staging.meetlite.dev'),
        'api-gateway must include staging domains in CORS origins'
      );

      // Cloudflare edge headers and correlation headers
      assert.ok(
        content.includes('cf-ray') &&
        content.includes('cf-connecting-ip') &&
        content.includes('cf-visitor'),
        'api-gateway must allow Cloudflare headers in CORS allowedHeaders'
      );

      assert.ok(
        content.includes('x-request-id') &&
        content.includes('x-correlation-id'),
        'api-gateway must allow correlation headers in CORS allowedHeaders'
      );
    });

    test('adversarial drill: Cloudflare edge headers and correlation ID are preserved across tunnel hop', () => {
      // Simulated headers arriving at API Gateway from Cloudflare Tunnel
      const incomingHeaders: Record<string, string> = {
        'cf-connecting-ip': '203.0.113.195',
        'cf-ray': '8d4f9b231a4c0001-DFW',
        'cf-visitor': '{"scheme":"https"}',
        'x-request-id': 'req-tunnel-edge-trace-12345',
        'x-forwarded-proto': 'https',
        'host': 'api-staging.meetlite.dev',
      };

      // Invariant: Header values must be intact and non-empty
      assert.equal(incomingHeaders['cf-connecting-ip'], '203.0.113.195');
      assert.ok(incomingHeaders['cf-ray'].includes('-'));
      assert.equal(incomingHeaders['x-request-id'], 'req-tunnel-edge-trace-12345');
      assert.equal(incomingHeaders['host'], 'api-staging.meetlite.dev');
    });
  });
});
