import { Request } from 'express';
import { AppError } from '../utils/app-error.js';

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

export interface AuthenticatedPrincipalRequest extends Request {
  principal?: VerifiedPrincipal;
  user?: any;
}

/**
 * Validates whether an unknown object satisfies the VerifiedPrincipal contract.
 */
export function isVerifiedPrincipal(obj: unknown): obj is VerifiedPrincipal {
  if (!obj || typeof obj !== 'object') {
    return false;
  }
  const candidate = obj as Record<string, unknown>;

  const hasUserId = typeof candidate.userId === 'string' && candidate.userId.trim().length > 0;
  const hasValidOrg = candidate.orgId === null || typeof candidate.orgId === 'string';
  const hasValidRole =
    typeof candidate.role === 'string' &&
    ['owner', 'admin', 'member', 'guest'].includes(candidate.role);
  const hasValidTokenVersion =
    typeof candidate.tokenVersion === 'number' && Number.isInteger(candidate.tokenVersion);
  const hasValidExpiresAt =
    typeof candidate.expiresAt === 'number' && Number.isFinite(candidate.expiresAt);

  return hasUserId && hasValidOrg && hasValidRole && hasValidTokenVersion && hasValidExpiresAt;
}

/**
 * Normalizes user claims or Prisma User entities into an immutable VerifiedPrincipal.
 */
export function createVerifiedPrincipal(input: any): VerifiedPrincipal {
  if (!input || typeof input !== 'object') {
    throw AppError.validation('Invalid principal input: expected non-null object');
  }

  const userId = input.userId || input.id || input.sub;
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    throw AppError.validation('Invalid principal: missing or invalid userId');
  }

  // Normalize organization ID: accept orgId or organizationId; undefined/empty becomes null
  let orgId: string | null = null;
  if (typeof input.orgId === 'string' && input.orgId.trim().length > 0) {
    orgId = input.orgId.trim();
  } else if (typeof input.organizationId === 'string' && input.organizationId.trim().length > 0) {
    orgId = input.organizationId.trim();
  }

  // Normalize role
  let role: PrincipalRole = 'member';
  const rawRole = (input.role || '').toString().toLowerCase();
  if (rawRole === 'owner') role = 'owner';
  else if (rawRole === 'admin') role = 'admin';
  else if (rawRole === 'guest') role = 'guest';
  else if (rawRole === 'member') role = 'member';

  // Normalize tokenVersion
  const tokenVersion =
    typeof input.tokenVersion === 'number' && Number.isInteger(input.tokenVersion)
      ? input.tokenVersion
      : 1;

  // Normalize expiresAt (supports JWT exp in seconds or expiresAt in ms)
  let expiresAt: number;
  if (typeof input.exp === 'number' && input.exp > 0) {
    expiresAt = input.exp * 1000;
  } else if (typeof input.expiresAt === 'number' && input.expiresAt > 0) {
    expiresAt = input.expiresAt;
  } else {
    // Default fallback: 15 minutes from now
    expiresAt = Date.now() + 15 * 60 * 1000;
  }

  const principal: VerifiedPrincipal = Object.freeze({
    userId: userId.trim(),
    orgId,
    role,
    tokenVersion,
    expiresAt,
    ...(typeof input.email === 'string' ? { email: input.email.trim() } : {}),
    ...(input.isSystemAdmin !== undefined ? { isSystemAdmin: Boolean(input.isSystemAdmin) } : {}),
    ...(typeof input.familyId === 'string' ? { familyId: input.familyId } : {}),
  });

  return principal;
}

/**
 * Extracts and asserts the VerifiedPrincipal from an Express request.
 * If req.principal is not yet set, attempts to synthesize from req.user if present.
 * Throws 401 AppError if unauthenticated.
 */
export function getVerifiedPrincipal(req: Request): VerifiedPrincipal {
  const authReq = req as AuthenticatedPrincipalRequest;
  if (authReq.principal && isVerifiedPrincipal(authReq.principal)) {
    return authReq.principal;
  }

  if (authReq.user) {
    const principal = createVerifiedPrincipal(authReq.user);
    authReq.principal = principal;
    return principal;
  }

  throw AppError.unauthorized('Authentication required: no verified principal present');
}
