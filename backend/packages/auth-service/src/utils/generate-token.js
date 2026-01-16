// Helper function to generate JWT tokens with organization context
import jwt from 'jsonwebtoken';

export const generateJWTToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      organizationId: user.organizationId || null,
      role: user.role || 'owner',
      tokenVersion: user.tokenVersion || 1,
      isSystemAdmin: user.isSystemAdmin || false,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};
