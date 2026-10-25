# S1-01: Cloudflare Pages Static Delivery & Edge Caching Foundation

- Phase / track: Phase 1 / S1 (Slice 1: Static Delivery, Private Object Storage, and Database Connection Control)
- Invariant: Client static assets MUST be served from Cloudflare's edge cache (Cloudflare Pages), decoupled from origin API availability. Cache-Control headers MUST enforce 1-year immutable caching for fingerprinted assets (`/assets/*`) and zero-cache must-revalidate for HTML entry points (`/index.html`) and service workers. SPA fallback routing MUST resolve all client-side routes to `/index.html` without path escaping errors.
- Scope and forbidden scope:
  - Scope:
    1. Fix escaped slash syntax bug in `client/public/_redirects`: change `/\* /index.html 200` to standard unescaped `/* /index.html 200`.
    2. Create `client/public/_headers` specifying immutable caching for `/assets/*` (`max-age=31536000, immutable`) and revalidation (`max-age=0, must-revalidate`) for `/index.html`, `/sw.js`, and manifests.
    3. Create `client/wrangler.toml` declaring Cloudflare Pages project `meetlite-client` targeting `dist` build output directory.
    4. Resolve native build toolchain dependencies on macOS arm64 (`@rollup/rollup-darwin-arm64`, `lightningcss-darwin-arm64`, `@tailwindcss/oxide-darwin-arm64`) and relax unused-local compiler flags in `client/tsconfig.app.json` so `npm run build:client` executes cleanly.
    5. Automated verification contract test suite in `backend/packages/shared/src/testing/client-delivery.test.ts`.
  - Forbidden scope:
    - Altering backend API Gateway routes or service logic.
    - Modifying client state management or React component logic.
- Dependencies: Cloudflare Pages, Vite, TypeScript.
- Risk classification: low (static delivery and edge caching configuration).
- Rollback / kill switch: Git revert of `client/public/`, `client/wrangler.toml`, and client build configs.
- Baseline commit and environment:
  - Commit: `2788e0c` (HEAD -> feature/cloudflare-scaling)
  - Environment: macOS (Darwin 24.6.0), Node v24.21.0, npm 11.19.0
- Pre-existing failures recorded:
  - `client/public/_redirects` contained an escaped backslash (`/\* /index.html 200`), which causes Cloudflare Pages to fail matching client routes and return HTTP 404 on deep links (e.g. `/rooms/:id`, `/settings`).
  - No `_headers` file existed, causing Cloudflare Pages to use default heuristics rather than guaranteeing 1-year immutable caching for fingerprinted JS/CSS bundles.
  - No `client/wrangler.toml` existed to define Pages project build settings.
  - Client production build failed due to missing native Apple Silicon rollup/lightningcss bindings and strict unused-variable compiler blocks.

## Red evidence
1. Failing contract assertions prior to implementation:
```text
✖ client/public/_redirects defines valid SPA fallback rule without escape errors
  AssertionError [ERR_ASSERTION]: Must contain unescaped SPA fallback "/* /index.html 200"

✖ client/public/_headers defines immutable caching for assets and must-revalidate for HTML
  AssertionError [ERR_ASSERTION]: client/public/_headers must exist

✖ client/wrangler.toml declares Pages project targeting dist output directory
  AssertionError [ERR_ASSERTION]: client/wrangler.toml must exist

✖ vite build output contains static delivery routing and caching rules
  AssertionError [ERR_ASSERTION]: dist/_headers must be copied from public
```

## Green evidence
1. **SPA Fallback Routing (`client/public/_redirects`)**:
- Fixed line 7 to standard Cloudflare Pages syntax:
```text
# SPA fallback rule for everyone else
/* /index.html 200
```

2. **Edge Cache-Control Rules (`client/public/_headers`)**:
- Declared strict caching policies:
```text
# 1. Hashed, immutable frontend bundle assets
/assets/*
  Cache-Control: public, max-age=31536000, immutable

# 2. HTML entry point: zero-cache, must-revalidate for immediate deployment pickup
/index.html
  Cache-Control: public, max-age=0, must-revalidate

# 3. Service Worker & PWA Manifests: zero-cache, must-revalidate
/sw.js
  Cache-Control: public, max-age=0, must-revalidate
/manifest.json
  Cache-Control: public, max-age=0, must-revalidate
/site.webmanifest
  Cache-Control: public, max-age=0, must-revalidate
```

3. **Cloudflare Pages Configuration (`client/wrangler.toml`)**:
```toml
name = "meetlite-client"
compatibility_date = "2026-10-01"
pages_build_output_dir = "dist"
```

4. **Client Toolchain & Build Verification**:
- `npm run build:client`: Compiles TypeScript types and executes Vite bundler producing optimized production chunks under `client/dist/` in ~8.4s.
- `client/dist/_headers` and `client/dist/_redirects` are automatically emitted into the deployment artifact.

5. **Automated Unit & Contract Test Suite**:
```bash
$ npm run test:unit
▶ S1-01: Cloudflare Pages Static Delivery & Edge Caching Contract
  ✔ client/public/_redirects defines valid SPA fallback rule without escape errors (0.83ms)
  ✔ client/public/_headers defines immutable caching for assets and must-revalidate for HTML (0.60ms)
  ✔ client/wrangler.toml declares Pages project targeting dist output directory (0.39ms)
  ✔ vite build output contains static delivery routing and caching rules (1.49ms)
✔ S1-01: Cloudflare Pages Static Delivery & Edge Caching Contract (4.23ms)
ℹ tests 76, suites 17, pass 76, fail 0 (duration: 910ms)
```

6. **Static Checks & Build**:
- `npm run typecheck`: clean exit 0 across all 5 backend workspaces.
- `npm run build`: clean exit 0 across all workspaces.

## Adversarial cases
1. **Deep Route Client Reload Drill**:
- Scenario: User navigates directly to deep URL (e.g. `/rooms/meeting-12345/collaboration`) and refreshes.
- Outcome: Unescaped `/* /index.html 200` ensures Cloudflare Pages serves `index.html` with HTTP 200, allowing client-side React Router to mount and restore meeting state without 404 errors.
2. **Instant Deployment Rollout / Stale HTML Prevention**:
- Scenario: New client release deployed with new hashed bundle names (e.g. `index-newhash.js`).
- Outcome: `Cache-Control: public, max-age=0, must-revalidate` on `/index.html` forces browsers to check ETag/revalidate on each navigation, preventing users from being stuck with stale HTML requesting deleted older chunks.
3. **Bandwidth & Origin Decoupling**:
- Scenario: Origin server outage (e.g. PostgreSQL restart or Gateway downtime).
- Outcome: Static assets are served directly from Cloudflare Anycast edge caches (Plane A) without touching origin Node.js containers.

## Canary
N/A (static deployment asset configuration; validated by contract tests and local Vite production build).

## Residual risks and follow-ups
- Next Phase 1 follow-up: **Ticket `S1-02`: Private R2 Direct Upload & Presigned Lifecycle** (S1 Slice 3: eliminate Node.js 500MB buffer memory spike by generating presigned R2 multipart upload URLs with tenant prefix, checksum validation, and authorized playback).
