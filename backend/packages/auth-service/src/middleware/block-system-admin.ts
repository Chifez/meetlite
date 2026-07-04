import { Response, NextFunction } from 'express';
import { AppError } from '@minimeet/shared';
import { AuthenticatedRequest } from './authenticate-token.js';

/**
 * Middleware to block system admins from accessing normal user routes
 * System admins should only access /admin routes
 */
export const blockSystemAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;

    if (user?.isSystemAdmin) {
      throw AppError.forbidden(
        'System admins can only access admin routes. Please use /admin routes.'
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};
