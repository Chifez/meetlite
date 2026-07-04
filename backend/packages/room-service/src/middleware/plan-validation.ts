import { Response, NextFunction } from 'express';
import { getPlanConstraints, hasFeature, PLAN_FEATURES } from '@minimeet/shared';
import { AuthenticatedRequest } from './auth.js';

/**
 * Middleware to validate user's plan status and enforce restrictions
 */
export const validatePlanStatus = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (user.plan?.status === 'expired') {
      return res.status(403).json({
        message:
          'Your plan has expired. Please renew to continue using premium features.',
        planStatus: 'expired',
        currentPlan: user.plan.type,
        upgradeRequired: true,
      });
    }

    if (user.plan?.status === 'cancelled') {
      return res.status(403).json({
        message:
          'Your plan has been cancelled. Please reactivate to continue using premium features.',
        planStatus: 'cancelled',
        currentPlan: user.plan.type,
        upgradeRequired: true,
      });
    }

    if (user.plan?.endDate) {
      const now = new Date();
      const endDate = new Date(user.plan.endDate);
      const daysUntilExpiry = Math.ceil(
        (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
        res.set('X-Plan-Expiry-Warning', `${daysUntilExpiry} days remaining`);
      } else if (daysUntilExpiry <= 0) {
        return res.status(403).json({
          message:
            'Your plan has expired. Please renew to continue using premium features.',
          planStatus: 'expired',
          currentPlan: user.plan.type,
          upgradeRequired: true,
        });
      }
    }

    next();
  } catch (error) {
    console.error('Plan validation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Middleware to check specific plan features
 */
export const requirePlanFeature = (requiredFeature: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const planType = user.plan?.type || 'free';
      
      if (!hasFeature(planType, requiredFeature)) {
        return res.status(403).json({
          message: `This feature requires a ${getUpgradePlan(planType)} plan or higher.`,
          currentPlan: planType,
          requiredFeature,
          upgradeRequired: true,
        });
      }

      next();
    } catch (error) {
      console.error('Plan feature validation error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  };
};

/**
 * Middleware to check plan limits
 */
export const requirePlanLimit = (limitKey: string, getCurrentUsage: (req: AuthenticatedRequest) => Promise<number>) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const planType = user.plan?.type || 'free';
      const constraints: Record<string, any> = getPlanConstraints(planType);
      const limit = constraints[limitKey];

      if (limit === -1) {
        return next();
      }

      const currentUsage = await getCurrentUsage(req);

      if (currentUsage >= limit) {
        return res.status(403).json({
          message: `You have reached your ${planType} plan limit for ${formatLimitKey(limitKey)}.`,
          currentPlan: planType,
          currentUsage,
          limit,
          limitKey,
          upgradeRequired: true,
        });
      }

      next();
    } catch (error) {
      console.error('Plan limit validation error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  };
};

/**
 * Middleware to check storage limits
 */
export const requireStorageLimit = (fileSizeBytes: number) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const planType = user.plan?.type || 'free';
      const constraints = getPlanConstraints(planType);
      
      const maxFileSizeMB = constraints.maxFileSizeMB;
      if (maxFileSizeMB !== -1) {
        const fileSizeMB = fileSizeBytes / (1024 * 1024);
        if (fileSizeMB > maxFileSizeMB) {
          return res.status(413).json({
            message: `File size exceeds your ${planType} plan limit of ${maxFileSizeMB}MB.`,
            currentPlan: planType,
            maxFileSizeMB,
            fileSizeMB: Math.round(fileSizeMB * 100) / 100,
            upgradeRequired: true,
          });
        }
      }

      next();
    } catch (error) {
      console.error('Storage limit validation error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  };
};

/**
 * Helper function to get the next upgrade plan
 */
const getUpgradePlan = (currentPlan: string): string => {
  const upgradeMap: Record<string, string> = {
    free: 'Pro',
    pro: 'Enterprise',
    enterprise: 'Enterprise',
  };
  return upgradeMap[currentPlan] || 'Pro';
};

/**
 * Format limit key for user-friendly message
 */
const formatLimitKey = (limitKey: string): string => {
  const formatMap: Record<string, string> = {
    maxStorageGB: 'storage',
    maxFileSizeMB: 'file size',
    maxMeetingsPerDay: 'daily meetings',
    maxMeetingsPerMonth: 'monthly meetings',
    maxParticipantsPerMeeting: 'meeting participants',
    maxMeetingDuration: 'meeting duration',
    maxRecordingsPerMonth: 'monthly recordings',
  };
  return formatMap[limitKey] || limitKey;
};

export { PLAN_FEATURES };
