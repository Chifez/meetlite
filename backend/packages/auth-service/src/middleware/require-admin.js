import { AppError } from '@minimeet/shared';

/**
 * Middleware to require system admin access
 * Checks if the authenticated user has isSystemAdmin flag set to true
 */
export const requireAdmin = (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      throw AppError.unauthorized('Authentication required');
    }

    // Check isSystemAdmin - handle both Mongoose document and plain object
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
