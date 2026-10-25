import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = fs.existsSync(path.join(process.cwd(), 'client'))
  ? path.resolve(process.cwd())
  : path.resolve(__dirname, '../../../../../');

describe('S1-01: Cloudflare Pages Static Delivery & Edge Caching Contract', () => {
  const clientPublicDir = path.join(repoRoot, 'client', 'public');
  const clientDir = path.join(repoRoot, 'client');

  test('client/public/_redirects defines valid SPA fallback rule without escape errors', () => {
    const redirectsPath = path.join(clientPublicDir, '_redirects');
    assert.ok(fs.existsSync(redirectsPath), 'client/public/_redirects must exist');

    const content = fs.readFileSync(redirectsPath, 'utf8');
    // Verify SPA fallback exists
    assert.match(
      content,
      /^\/\*\s+\/index\.html\s+200/m,
      'Must contain unescaped SPA fallback "/* /index.html 200"'
    );
    // Must NOT contain escaped backslash in fallback
    assert.doesNotMatch(
      content,
      /\\\/\\\*/,
      'Must not escape slash or asterisk in _redirects fallback'
    );
  });

  test('client/public/_headers defines immutable caching for assets and must-revalidate for HTML', () => {
    const headersPath = path.join(clientPublicDir, '_headers');
    assert.ok(fs.existsSync(headersPath), 'client/public/_headers must exist');

    const content = fs.readFileSync(headersPath, 'utf8');

    // Verify /assets/* immutable caching
    assert.match(
      content,
      /\/assets\/\*[\s\S]*?Cache-Control:\s*public,\s*max-age=31536000,\s*immutable/i,
      '/assets/* must specify 1-year immutable cache header'
    );

    // Verify /index.html must-revalidate
    assert.match(
      content,
      /\/index\.html[\s\S]*?Cache-Control:\s*public,\s*max-age=0,\s*must-revalidate/i,
      '/index.html must specify must-revalidate cache header'
    );
  });

  test('client/wrangler.toml declares Pages project targeting dist output directory', () => {
    const wranglerPath = path.join(clientDir, 'wrangler.toml');
    assert.ok(fs.existsSync(wranglerPath), 'client/wrangler.toml must exist');

    const content = fs.readFileSync(wranglerPath, 'utf8');
    assert.match(
      content,
      /name\s*=\s*["']meetlite-client["']/,
      'wrangler.toml must declare name = "meetlite-client"'
    );
    assert.match(
      content,
      /pages_build_output_dir\s*=\s*["']dist["']/,
      'wrangler.toml must declare pages_build_output_dir = "dist"'
    );
  });

  test('vite build output contains static delivery routing and caching rules', () => {
    const distDir = path.join(clientDir, 'dist');
    // If dist exists from prior build, verify _redirects and _headers are included
    if (fs.existsSync(distDir)) {
      const distRedirects = path.join(distDir, '_redirects');
      assert.ok(fs.existsSync(distRedirects), 'dist/_redirects must be copied from public');

      const distHeaders = path.join(distDir, '_headers');
      assert.ok(fs.existsSync(distHeaders), 'dist/_headers must be copied from public');

      const distIndex = path.join(distDir, 'index.html');
      assert.ok(fs.existsSync(distIndex), 'dist/index.html must exist');
    }
  });
});
