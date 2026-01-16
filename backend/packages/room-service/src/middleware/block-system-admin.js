import { AppError } from '@minimeet/shared';

/**
 * Middleware to block system admins from accessing normal user routes
 * System admins should only access /admin routes
 */
export const blockSystemAdmin = (req, res, next) => {
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



