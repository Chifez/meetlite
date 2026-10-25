# P0-06: Token Lifetime & Revocation Semantics

- Phase / track: Phase 0 / S0 (Slice 6)
- Invariant: Access token lifetime MUST NOT exceed 15 minutes (`ACCESS_TOKEN_TTL_SECONDS = 900`). Plaintext refresh tokens MUST NEVER be persisted in data stores (only SHA-256 hashes). Refresh tokens MUST rotate on every refresh within a cryptographic session family (`familyId`). If a previously rotated refresh token is replayed (reuse detected), the entire session family MUST be immediately revoked. Normal access token verification MUST remain stateless without store lookups. Global logout / sensitive operations MUST support immediate invalidation via user `tokenVersion`.
- Scope and forbidden scope:
  - Scope:
    1. Implement centralized token infrastructure in `@minimeet/shared` (`TokenManager`, `InMemoryRefreshTokenStore`, `RedisRefreshTokenStore`, `TokenReuseError`, `TokenRevokedError`, `hashToken`, `generateOpaqueToken`, `ACCESS_TOKEN_TTL_SECONDS = 900`).
    2. Update token generation in `backend/packages/auth-service/src/utils/generate-token.ts` with 15-minute lifetime (`expiresIn: '15m'`), cryptographic `jti: crypto.randomUUID()`, and `familyId`.
    3. Instantiate Redis-backed (with in-memory fallback for test isolation) `TokenManager` in `backend/packages/auth-service/src/services/token.service.ts`.
    4. Update authentication handlers in `backend/packages/auth-service/src/controllers/auth.controller.ts`:
       - `signup` & `login`: Issue token pairs (`accessToken`, `refreshToken`, `expiresIn: 900`).
       - `refreshToken`: Rotates hashed refresh tokens by session family, detects token reuse, revokes family on reuse, and upgrades legacy tokens.
       - `logout`: Revokes refresh token and session family.
       - `logoutAll`: Increments `user.tokenVersion` in PostgreSQL and revokes all active session families.
    5. Wire routes in `backend/packages/auth-service/src/routes/v1/auth.route.ts` (`POST /logout`, `POST /logout-all`).
    6. Update `backend/packages/auth-service/src/middleware/authenticate-token.ts` with `tokenVersion` revocation check against PostgreSQL.
    7. Automated unit and contract test suites (`token-service.test.ts`, `generate-token.test.ts`, `token-semantics.test.ts`) covering all 7 cages of the verification methodology.
  - Forbidden scope:
    - Breaking existing room-service authentication contracts or client backward compatibility (payloads continue providing `token` alias).
    - Persisting plaintext refresh tokens in Redis or PostgreSQL.
    - Adding external store network lookups to the stateless access token verification fast path.
- Dependencies: jsonwebtoken, crypto (Node built-in), Redis (`ioredis` / `redis`), Prisma Client.
- Risk classification: medium (changes token lifetimes and authentication/refresh semantics).
- Rollback / kill switch: Git revert of token service and controller changes.
- Baseline commit and environment:
  - Commit: `2788e0c` (HEAD -> feature/cloudflare-scaling)
  - Environment: macOS (Darwin 24.6.0), Node v24.21.0, npm 11.19.0
- Pre-existing failures recorded:
  - Access tokens were previously issued with a 7-day expiration (`expiresIn: '7d'`), meaning a leaked access token remained valid for an entire week with no revocation mechanism.
  - Refresh tokens were either nonexistent or held no family tracking, preventing reuse detection.
  - No mechanism existed to invalidate all active sessions upon password reset, compromise, or logout-all.

## Red evidence
1. Legacy access tokens issued with 7-day expiration and no cryptographic `jti`:
```ts
// auth-service/src/utils/generate-token.ts (legacy)
export const generateJWTToken = (payload: JwtPayload): string => {
  return jwt.sign(
    payload,
    getRequiredEnv().JWT_SECRET,
    { expiresIn: '7d' } // Leaked tokens valid for 1 week
  );
};
```
2. Absence of refresh token rotation: Clients reused the same static credential without session family rotation.
3. Plaintext storage risk: Any stored credentials were vulnerable to credential dumping if data store snapshots were accessed.
4. Inability to invalidate sessions globally: Incrementing `user.tokenVersion` did not invalidate issued JWTs.

## Green evidence
1. **Centralized Token Infrastructure (`@minimeet/shared`)**:
- Implemented in `backend/packages/shared/src/auth/token-service.ts`:
  - `ACCESS_TOKEN_TTL_SECONDS = 900` (15 minutes).
  - `REFRESH_TOKEN_TTL_SECONDS = 2592000` (30 days).
  - `hashToken`: SHA-256 one-way hashing with constant-time equality comparisons.
  - `generateOpaqueToken`: 32-byte cryptographically secure random token string.
  - `TokenManager`: Implements `issueTokenPair`, `rotateRefreshToken`, `revokeToken`, `revokeFamily`, `isTokenRevoked`, `verifyAccessTokenStateless`.
  - `InMemoryRefreshTokenStore` & `RedisRefreshTokenStore`: Persistent store adapters tracking session families, rotation lineage, and revocation status.

2. **Session Family Rotation & Reuse Detection**:
- Every refresh operation rotates the refresh token while preserving the `familyId`.
- The previous token is marked `revoked: true`.
- If an already-revoked refresh token is presented again (indicating token theft or replay), `TokenReuseError` is raised and the entire family is immediately revoked:
```ts
if (record.revoked) {
  await this.revokeFamily(record.familyId);
  throw new TokenReuseError(
    `Refresh token reuse detected for family ${record.familyId}. Entire family has been revoked.`
  );
}
```

3. **Auth Service Integration**:
- `backend/packages/auth-service/src/utils/generate-token.ts`:
  - Enforces `ACCESS_TOKEN_TTL_SECONDS = 900`.
  - Injects `jti: crypto.randomUUID()` for token uniqueness.
  - Encodes `familyId` and `tokenVersion`.
- `backend/packages/auth-service/src/controllers/auth.controller.ts`:
  - `signup` / `login`: Generates full token pair via `tokenManager.issueTokenPair()`.
  - `refreshToken`: Rotates refresh token within session family; rejects replayed tokens with HTTP 403.
  - `logout`: Revokes refresh token and family.
  - `logoutAll`: Increments `user.tokenVersion` in PostgreSQL and revokes all active session families in Redis.
- `backend/packages/auth-service/src/middleware/authenticate-token.ts`:
  - Fast-path verification: Decodes JWT statelessly.
  - Token version check: Validates `decoded.tokenVersion === user.tokenVersion`.

4. **Automated Unit & Contract Test Suite**:
```bash
$ npm run test:unit
▶ P0-06: Token Lifetime & Revocation Semantics
  ✔ access tokens have a 15-minute expiration (900 seconds) (3.03ms)
  ✔ hashToken computes deterministic SHA-256 and never matches raw token (0.25ms)
  ✔ issueTokenPair creates an access token and a hashed refresh token in a new family (0.51ms)
  ✔ rotateRefreshToken rotates the refresh token within the same family (0.52ms)
  ✔ detects token reuse and immediately revokes the entire family (1.33ms)
  ✔ user tokenVersion bump invalidates sessions during immediate revocation check (0.96ms)
  ✔ stateless token verification runs without touching the store (0.32ms)
✔ P0-06: Token Lifetime & Revocation Semantics (7.86ms)

▶ P0-06: Token Lifetime & Revocation Semantics Contract
  ✔ static source verification: auth-service wires 15m lifetime and family rotation routes (1.59ms)
  ✔ adversarial drill: multi-step session rotation preserves familyId across rotations (2.97ms)
  ✔ adversarial drill: replaying old rotated token revokes family and locks out attacker and victim (1.30ms)
  ✔ adversarial drill: global logout invalidates all sessions when tokenVersion is incremented (1.42ms)
  ✔ stateless access token verification is performant and requires zero store operations (0.29ms)
✔ P0-06: Token Lifetime & Revocation Semantics Contract (8.74ms)
ℹ tests 62, suites 11, pass 62, fail 0 (duration: 878ms)
```

5. **Static Checks & Build**:
- `npm run typecheck`: clean exit 0 across all 5 backend workspaces.
- `npm run build`: clean exit 0 across all backend workspaces.

## Adversarial cases
1. **Adversarial Token Reuse Drill**:
- Scenario: Legitimate user refreshes token `R1 -> R2`. Attacker intercepts `R1` and later attempts to refresh with `R1`.
- Outcome: `TokenManager` detects that `R1` is already revoked, immediately invokes `revokeFamily(familyId)`, and throws `TokenReuseError`.
- Consequence: Both attacker and victim are locked out of the compromised session family, requiring fresh authentication.
2. **Global Logout Invalidation Drill**:
- Scenario: User logs out of all devices via `POST /logout-all`.
- Outcome: Database increments `user.tokenVersion`. Existing 15-minute access tokens with stale `tokenVersion` are immediately rejected upon authoritative lookup, preventing window-of-vulnerability exploits.
3. **Stateless Access Token Performance Benchmark**:
- Scenario: Verifying access tokens under high concurrency.
- Outcome: `verifyAccessTokenStateless` requires 0 store lookups and runs 100 iterations in <3ms (<0.03ms per verification), completely isolating the token fast-path from Redis or PostgreSQL latency.
4. **Hashed Refresh Token Security Drill**:
- Scenario: Refresh tokens inspected in store.
- Outcome: Stores record only SHA-256 hex digests (`sha256(rawToken)`). Raw tokens are never logged or stored.

## Canary
N/A (authentication backend token infrastructure; covered by 12 comprehensive unit and adversarial contract tests).

## Residual risks and follow-ups
- With token semantics (P0-06) complete, Phase 0 (Production Readiness Baseline) security gates have been satisfied.
- Next Phase 0 follow-up: **Ticket `P0-07`: Observability & Correlation ID Foundation** (Phase 0 / S0 Slice 7: distributed trace/correlation ID propagation via `x-request-id`, structured JSON logging, standard HTTP request/response telemetry).
