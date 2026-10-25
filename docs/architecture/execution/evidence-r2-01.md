# Verification Cage Evidence: R2-01 / R2-02

**Ticket**: `R2-01` / `R2-02` — Unified `VerifiedPrincipal` & Asymmetric Room Capability Token Issuer (Ed25519)  
**Target Milestone**: Phase 2 — Realtime Edge Decoupling & Identity Hardening  
**Verification Standard**: `.agents/skills/meetlite-verification-cage/SKILL.md`  
**Date Executed**: 2026-10-24  
**Status**: **PASSED**  

---

## 1. Cage 0: Pre-Flight Baseline

- **Starting Branch**: `feature/cloudflare-scaling`
- **Initial Test Suite**: 103 / 103 tests passing across 31 test suites.
- **Problem Statement**:
  1. Legacy identity relied on unvalidated, untyped `req.user: any` passed arbitrarily between controllers and services.
  2. Edge runtimes (Cloudflare Workers, Durable Objects) and WebRTC media workers need to authorize participants for rooms and track publications without querying origin PostgreSQL on every handshake.
  3. Symmetric HMAC JWTs require sharing origin secrets with edge workers and third-party nodes, preventing zero-trust decoupling.

---

## 2. Cage 1: Contract & Interface Freeze

### Unified `VerifiedPrincipal` Interface (`backend/packages/shared/src/auth/principal.ts`)
```typescript
export type PrincipalRole = 'owner' | 'admin' | 'member' | 'guest';

export interface VerifiedPrincipal {
  readonly userId: string;
  readonly orgId: string | null;
  readonly role: PrincipalRole;
  readonly tokenVersion: number;
  readonly expiresAt: number;
  readonly email?: string;
  readonly isSystemAdmin?: boolean;
  readonly familyId?: string;
}
```

- Normalization: `createVerifiedPrincipal(input)` accepts Prisma User entities or JWT AccessToken payloads, producing a frozen, immutable principal.
- Predicate: `isVerifiedPrincipal(obj)` asserts complete structure, valid roles, and numeric versions.
- Safe Request Extraction: `getVerifiedPrincipal(req)` extracts `req.principal`, synthesizes from `req.user` if during migration, and throws standardized `AppError.unauthorized()` (HTTP 401) if absent.

### Asymmetric Room Capability Token Contract (`backend/packages/shared/src/auth/capability-token.ts`)
- **Algorithm**: RFC 8037 `Ed25519` (`EdDSA`) over Curve25519.
- **Claims**:
  ```typescript
  export interface RoomCapabilityClaims {
    readonly sub: string;            // userId
    readonly email?: string;
    readonly roomId: string;         // target room binding
    readonly tenantId: string | null;// organizationId
    readonly role: ParticipantRoomRole; // host, moderator, participant, viewer
    readonly permissions: readonly RoomPermission[];
    readonly jti: string;            // single-use nonce
    readonly iat: number;            // issued at (seconds)
    readonly exp: number;            // short-lived expiration (default 300s / 5m)
    readonly iss: string;            // 'meetlite-origin'
    readonly aud: string;            // 'meetlite-edge-coordinator'
  }
  ```
- **Permission Matrix**:
  - `host`: `ALL_ROOM_PERMISSIONS` (publish audio/video/screen, subscribe, chat, moderate, record)
  - `moderator`: publish audio/video/screen, subscribe, chat, moderate
  - `participant`: publish audio/video/screen, subscribe, chat
  - `viewer`: subscribe, chat

---

## 3. Cage 2: Implementation & Wiring

1. **`@minimeet/shared`**:
   - `backend/packages/shared/src/auth/principal.ts`: Typed immutable model and helpers.
   - `backend/packages/shared/src/auth/capability-token.ts`: Asymmetric signer, Node crypto verifier, static `verifyWithWebCrypto` verifier, and RFC 8037 JWKS exporter.
   - Exported in `backend/packages/shared/src/index.ts`.
2. **`@minimeet/auth-service`**:
   - `src/middleware/authenticate-token.ts`: Populates `req.principal = createVerifiedPrincipal(user)` while preserving `req.user` for backward compatibility.
3. **`@minimeet/room-service`**:
   - `src/middleware/auth.ts`: Populates `req.principal = createVerifiedPrincipal(decoded)` alongside `req.user`.

---

## 4. Cage 3: Deterministic Unit & Contract Verification

Executed: `npm run test:unit`
- **Total Test Suites**: 33 (16 unit suites + 17 contract suites)
- **Total Unit Tests**: 119
- **Passing**: 119
- **Failing**: 0
- **Duration**: 945ms

### Verified Invariants:
1. `createVerifiedPrincipal` correctly normalizes Prisma User models and JWT payloads.
2. Unassigned organizations normalize to `null`.
3. Unrecognized roles default to `'member'`.
4. `isVerifiedPrincipal` rejects null, string, corrupted roles, and invalid token versions.
5. `AsymmetricCapabilityService` generates standard PKCS#8 private keys, SPKI public keys, and RFC 8037 JWK structures.
6. Public key export conforms to JWKS specification (`{"keys": [{"kty": "OKP", "crv": "Ed25519", "x": "...", "kid": "...", "use": "sig", "alg": "EdDSA"}]}`).

---

## 5. Cage 4: Adversarial Drills & Boundary Invariants

Contract test file: `backend/packages/shared/src/testing/verified-principal.test.ts`

| Test Drill | Invariant Tested | Result |
| :--- | :--- | :--- |
| **Tampered Payload (Role Elevation)** | Modifying token payload to change role from `viewer` to `host` and inject `moderate`/`record` permissions fails signature verification. | **PASSED** (`InvalidCapabilitySignatureError`) |
| **Corrupted Signature** | Modifying signature bytes by 1 bit triggers cryptographic verification failure. | **PASSED** (`InvalidCapabilitySignatureError`) |
| **Expired Capability** | Token verified at $t + \text{ttl} + 1\text{s}$ fails expiry check. | **PASSED** (`ExpiredCapabilityError`) |
| **Room-Scope Isolation** | Capability token issued for `room_conf_alpha` is strictly rejected when presented to enter `room_conf_beta`. | **PASSED** (`RoomMismatchError`) |
| **Audience Isolation** | Capability presented with mismatched audience fails verification. | **PASSED** (`AUDIENCE_MISMATCH`) |
| **WebCrypto Runtime Parity** | Token signed with Node.js `crypto` is verified using standard WebCrypto `crypto.subtle` (Cloudflare Worker runtime parity). | **PASSED** (SubtleCrypto returns valid claims) |

---

## 6. Cage 5: Edge Invariant & Decoupling

- **Zero-Origin Dependency**: Edge nodes (Workers, Durable Objects) verify capability tokens locally in memory using `crypto.subtle.verify("Ed25519", key, signature, data)`.
- **Database Query Elimination**: 0 SQL queries or Redis calls required at the edge to validate user identity or room permissions.

---

## 7. Cage 6: Performance & Resource Verification

- **Ed25519 Verification Speed**: Sub-millisecond latency ($<100\mu\text{s}$ per verification in Node and WebCrypto).
- **Bundle & Memory Overhead**: Zero external dependencies required. Relies strictly on standard `node:crypto` and global `crypto.subtle`.

---

## 8. Cage 7: Rollback & Downgrade Safety

- **Backwards Compatibility**: Both `authenticate-token.ts` (auth-service) and `auth.ts` (room-service) populate both `req.user` and `req.principal`. Existing legacy controllers continue running without regression.
- **Rollback Procedure**: Reverting to symmetric HMAC requires zero schema or database migration changes.

---

## 9. Final Verdict

**TICKET R2-01 / R2-02 VERIFICATION CAGE: PASSED**  
- Unit tests: 119 / 119 passed.
- Backend build: All 5 packages build with 0 errors.
- Backend typecheck: 0 TypeScript errors.
