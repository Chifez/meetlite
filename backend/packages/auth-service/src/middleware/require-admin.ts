import { Response, NextFunction } from 'express';
import { AppError } from '@minimeet/shared';
import { AuthenticatedRequest } from './authenticate-token.js';

/**
 * Middleware to require system admin access
 * Checks if the authenticated user has isSystemAdmin flag set to true
 */
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;

    if (!user) {
      throw AppError.unauthorized('Authentication required');
    }

    const isSystemAdmin =
      user.isSystemAdmin === true || user.isSystemAdmin === 'true';

    if (!isSystemAdmin) {
      throw AppError.forbidden('System admin access required');
    }

    next();
  } catch (error) {
    next(error);
  }
};
