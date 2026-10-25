// Helper function to generate JWT tokens with organization context
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { ACCESS_TOKEN_TTL_SECONDS } from '@minimeet/shared';

export const generateJWTToken = (user: any, familyId?: string): string => {
  return jwt.sign(
    {
      jti: crypto.randomUUID(),
      userId: user._id || user.id,
      email: user.email,
      organizationId: user.organizationId || null,
      role: user.role || 'owner',
      tokenVersion: user.tokenVersion || 1,
      isSystemAdmin: user.isSystemAdmin || false,
      ...(familyId ? { familyId } : {}),
    },
    process.env.JWT_SECRET!,
    { expiresIn: ACCESS_TOKEN_TTL_SECONDS }
  );
};
