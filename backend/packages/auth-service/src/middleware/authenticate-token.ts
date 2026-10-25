import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma, createVerifiedPrincipal, VerifiedPrincipal } from '@minimeet/shared';

export interface AuthenticatedRequest extends Request {
  user?: any;
  principal?: VerifiedPrincipal;
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET!, async (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }

    try {
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (typeof decoded.tokenVersion === 'number' && decoded.tokenVersion !== user.tokenVersion) {
        return res.status(401).json({ message: 'Token has been revoked' });
      }
      req.user = user;
      req.principal = createVerifiedPrincipal(user);
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({ message: 'Authentication failed' });
    }
  });
};
