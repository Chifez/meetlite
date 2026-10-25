# P0-07: Observability & Correlation ID Foundation

- Phase / track: Phase 0 / S0 (Slice 7: Operational baseline)
- Invariant:
  1. Every external request entering MeetLite (via API Gateway or direct service ingress) MUST be assigned or preserve an immutable, valid correlation ID (`x-request-id` / `x-correlation-id`).
  2. The correlation ID MUST be returned in the HTTP response headers (`x-request-id` and `x-correlation-id`).
  3. The correlation ID MUST be propagated across internal service calls (e.g. `api-gateway` proxying to `auth-service`, `room-service`, `mediasoup-service`).
  4. The correlation context MUST be maintained across asynchronous execution boundaries using `AsyncLocalStorage`.
  5. Structured JSON loggers MUST automatically enrich log entries with `correlationId`, `service`, and `timestamp` without manual argument passing.
  6. Request lifecycle middleware MUST log method, path, status, latency in milliseconds, and correlation ID upon completion, while omitting noisy health probes.
  7. Logging MUST NEVER log secrets, tokens, passwords, or raw Authorization headers.
- Scope and forbidden scope:
  - Scope:
    1. Create centralized telemetry module in `@minimeet/shared` (`src/telemetry/correlation.ts`):
       - `createCorrelationMiddleware(serviceName)`
       - `createRequestLoggingMiddleware(options)`
       - `correlationStorage` (`AsyncLocalStorage<CorrelationContext>`)
       - `getCorrelationId()`, `getCorrelationContext()`, `runWithCorrelationContext()`
       - `sanitizeCorrelationId()` (validates length <= 128, rejects CRLF, non-alphanumeric special characters)
    2. Enrich centralized logger in `@minimeet/shared` (`src/utils/logger.ts`):
       - Winston format enricher automatically extracting `correlationId` from active `AsyncLocalStorage` context.
    3. Update `backend/packages/api-gateway`:
       - Wire `setupCorrelationMiddleware` at the very beginning of the Express middleware pipeline (`src/index.ts`).
       - Wire `setupRequestLoggingMiddleware` with health check probe filtering (`src/middleware/index.ts`).
       - Forward `x-request-id` and `x-correlation-id` on proxy requests in `onProxyReq` (`src/routes/service-router.ts`).
    4. Update `backend/packages/room-service`:
       - Wire `createCorrelationMiddleware('room-service')` and `createRequestLoggingMiddleware` in `src/app.ts`.
    5. Update `backend/packages/auth-service`:
       - Wire `createCorrelationMiddleware('auth-service')` and `createRequestLoggingMiddleware` in `src/app.ts`.
    6. Update `backend/packages/mediasoup-service`:
       - Wire `createCorrelationMiddleware('mediasoup-service')` and `createRequestLoggingMiddleware` in `src/index.ts`.
    7. Automated contract test suite in `backend/packages/shared/src/testing/correlation-semantics.test.ts`.
  - Forbidden scope:
    - Altering authentication, authorization, or room logic.
    - Introducing heavy distributed tracing agents or external collector dependencies into the unit test harness.
    - Logging sensitive credentials, JWT secrets, authorization headers, or request bodies containing passwords.
- Dependencies: Express, Winston, Node.js `node:async_hooks`, `node:crypto`.
- Risk classification: low-to-medium (adds request middleware and header forwarding).
- Rollback / kill switch: Git revert of telemetry module, shared logger, and service middleware wiring.
- Baseline commit and environment:
  - Commit: `2788e0c` (HEAD -> feature/cloudflare-scaling)
  - Environment: macOS (Darwin 24.6.0), Node v24.21.0, npm 11.19.0
- Pre-existing failures recorded:
  - No correlation ID existed in request headers or log outputs.
  - API Gateway proxied requests to downstream services without tracing or correlation headers.
  - Loggers emitted uncoordinated text lines or JSON without request correlation context, making distributed debugging across gateway, auth, and room services impossible.
  - Health check probe requests produced log noise or were untracked.

## Red evidence
1. Missing module failure on test suite execution prior to implementation:
```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/emmanuel/Dev/meetlite/backend/packages/shared/src/telemetry/correlation.js' imported from /Users/emmanuel/Dev/meetlite/backend/packages/shared/src/testing/correlation-semantics.test.ts
    code: 'ERR_MODULE_NOT_FOUND'
✖ backend/packages/shared/src/testing/correlation-semantics.test.ts
```
2. Uncoordinated logs: Previously, `createLogger` only included `{ service: serviceName }` with no correlation ID across async call boundaries.
3. API Gateway request logging was disabled with a no-op placeholder:
```ts
// api-gateway/src/middleware/index.ts (legacy)
export function setupRequestLoggingMiddleware(app: Express) {
  // Request logging disabled for performance
  app.use((req: Request, res: Response, next: NextFunction) => {
    next();
  });
}
```

## Green evidence
1. **Centralized Correlation & Telemetry Infrastructure (`@minimeet/shared`)**:
- Implemented in `backend/packages/shared/src/telemetry/correlation.ts`:
  - `CORRELATION_HEADER = 'x-request-id'`
  - `ALT_CORRELATION_HEADER = 'x-correlation-id'`
  - `correlationStorage = new AsyncLocalStorage<CorrelationContext>()`
  - `sanitizeCorrelationId()`: Enforces length <= 128, alphanumeric + `_-.` regex, strips dangerous injection characters.
  - `createCorrelationMiddleware()`: Extracts or generates UUID, sets response headers, and wraps downstream handlers in `AsyncLocalStorage`.
  - `createRequestLoggingMiddleware()`: Measures latency with `process.hrtime.bigint()`, emits structured JSON telemetry, and filters out probe paths.

2. **Zero-Parameter Logger Enrichment (`@minimeet/shared`)**:
- Implemented in `backend/packages/shared/src/utils/logger.ts`:
  - `correlationEnricher`: Winston format plugin that automatically queries `getCorrelationId()` and enriches log entries with `correlationId` without explicit logger invocation arguments.

3. **API Gateway & Service Integration**:
- `backend/packages/api-gateway/src/routes/service-router.ts`:
  - `onProxyReq`: Explicitly forwards `x-request-id` and `x-correlation-id` to downstream backend services.
- `backend/packages/api-gateway/src/index.ts`:
  - `setupCorrelationMiddleware`: Mounted at composition root.
  - `setupRequestLoggingMiddleware`: Mounted with structured JSON logger and probe filtering.
- `backend/packages/room-service/src/app.ts`:
  - Mounted `createCorrelationMiddleware('room-service')` and `createRequestLoggingMiddleware`.
- `backend/packages/auth-service/src/app.ts`:
  - Mounted `createCorrelationMiddleware('auth-service')` and `createRequestLoggingMiddleware`.
- `backend/packages/mediasoup-service/src/index.ts`:
  - Mounted `createCorrelationMiddleware('mediasoup-service')` and `createRequestLoggingMiddleware`.

4. **Automated Unit & Contract Test Suite**:
```bash
$ npm run test:unit
▶ P0-07: Observability & Correlation ID Foundation
  ▶ Header sanitization and generation
    ✔ generates valid UUID v4 when no correlation header is provided (29.05ms)
    ✔ preserves incoming x-request-id header across request and response (10.34ms)
    ✔ preserves incoming x-correlation-id when x-request-id is absent (6.71ms)
    ✔ sanitizes malicious or oversized correlation headers and falls back to clean UUID (0.18ms)
  ✔ Header sanitization and generation (47.01ms)
  ▶ AsyncLocalStorage Context Isolation
    ✔ isolates correlation context between concurrent requests without leakage (37.06ms)
    ✔ runWithCorrelationContext binds context to nested synchronous and asynchronous calls (0.25ms)
  ✔ AsyncLocalStorage Context Isolation (37.47ms)
  ▶ Structured Logger & Request Telemetry
    ✔ logger automatically enriches log entries with active correlationId (3.72ms)
    ✔ request logging middleware records latency and skips health check probes (27.87ms)
  ✔ Structured Logger & Request Telemetry (31.85ms)
  ▶ Static Source & Gateway Forwarding Verification
    ✔ static source verification: all 4 HTTP services wire correlation and telemetry middleware (0.64ms)
    ✔ adversarial drill: end-to-end proxy correlation header forwarding (4.43ms)
  ✔ Static Source & Gateway Forwarding Verification (5.21ms)
✔ P0-07: Observability & Correlation ID Foundation (121.98ms)
ℹ tests 72, suites 16, pass 72, fail 0 (duration: 843ms)
```

5. **Static Checks & Build**:
- `npm run typecheck`: clean exit 0 across all 5 backend workspaces.
- `npm run build`: clean exit 0 across all backend workspaces.

## Adversarial cases
1. **CRLF Header Injection & Oversized Header Drill**:
- Scenario: Client attempts header injection (`evil-id\r\nX-Injected: true`) or oversized strings (> 128 characters).
- Outcome: `sanitizeCorrelationId` returns `null` and `createCorrelationMiddleware` generates a fresh, clean UUID v4 fallback, preventing HTTP response splitting and buffer abuse.
2. **Concurrent Request Context Isolation Drill**:
- Scenario: Multiple simultaneous requests with different correlation IDs process asynchronous workloads.
- Outcome: `AsyncLocalStorage` maintains complete isolation across parallel promise chains. No correlation ID leakage occurs between requests.
3. **End-to-End Proxy Header Forwarding Drill**:
- Scenario: Gateway receives an incoming request with `x-request-id: adversarial-trace-e2e-888` and proxies to a downstream service.
- Outcome: Downstream service receives both `x-request-id` and `x-correlation-id` matching the client trace ID, and the gateway returns matching response headers.
4. **Probe Storm Log Flood Prevention**:
- Scenario: High-frequency container health probes pinging `/health/live` or `/health/ready`.
- Outcome: Telemetry middleware silently skips requests matching `skipPaths`, preventing log volume explosion while preserving telemetry on all business endpoints.

## Canary
N/A (backend observability and correlation infrastructure; covered by 10 comprehensive unit, static, and adversarial proxy contract tests).

## Residual risks and follow-ups
- All 7 Phase 0 (Production Readiness Baseline) tickets are now **COMPLETE**:
  - `P0-01`: Script contracts, test harness, deterministic fakes
  - `P0-02`: Safe database delivery, baseline Prisma migration, startup migration container
  - `P0-03`: Process-role isolation (HTTP, workers, schedulers)
  - `P0-04`: Configuration hardening & secret fail-fast
  - `P0-05`: Health semantics (`/health/live`, `/health/ready`, `/health/startup`)
  - `P0-06`: Token lifetime (15m), hashed refresh tokens, session family rotation, reuse revocation
  - `P0-07`: Observability & Correlation ID foundation (`x-request-id`, `AsyncLocalStorage`, request telemetry)
- Next milestone: **Phase 0 Exit Gate Review & Transition to Phase 1 (S1 / R1)**.
