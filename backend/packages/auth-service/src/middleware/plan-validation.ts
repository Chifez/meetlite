import { Response, NextFunction } from 'express';
import { getPlanConstraints } from '@minimeet/shared';
import { models } from '../index.js';
import { EmailQueue } from '@minimeet/shared';
import { AuthenticatedRequest } from './authenticate-token.js';

/**
 * Middleware to validate user's plan status and enforce restrictions
 */
export const validatePlanStatus = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Check if plan is expired
    if (user.plan.status === 'expired') {
      return res.status(403).json({
        message:
          'Your plan has expired. Please renew to continue using premium features.',
        planStatus: 'expired',
        currentPlan: user.plan.type,
        upgradeRequired: true,
      });
    }

    // Check if plan is cancelled
    if (user.plan.status === 'cancelled') {
      return res.status(403).json({
        message:
          'Your plan has been cancelled. Please reactivate to continue using premium features.',
        planStatus: 'cancelled',
        currentPlan: user.plan.type,
        upgradeRequired: true,
      });
    }

    // Check if plan has an end date and is approaching expiration
    if (user.plan.endDate) {
      const now = new Date();
      const endDate = new Date(user.plan.endDate);
      const daysUntilExpiry = Math.ceil(
        (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Add warning headers for frontend
      if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
        res.set('X-Plan-Expiry-Warning', `${daysUntilExpiry} days remaining`);
      } else if (daysUntilExpiry <= 0) {
        // Plan has expired but status might not be updated yet
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

      const planConstraints = getPlanConstraints(user.plan.type);

      if (!planConstraints.features.includes(requiredFeature)) {
        return res.status(403).json({
          message: `This feature requires a ${getUpgradePlan(
            user.plan.type
          )} plan or higher.`,
          currentPlan: user.plan.type,
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
 * Service to handle plan expiration checks and updates
 */
export class PlanExpirationService {
  /**
   * Check and update expired plans
   */
  static async checkExpiredPlans() {
    try {
      const now = new Date();

      // Find users with expired plans
      const expiredUsers = await models.User.find({
        'plan.endDate': { $lt: now },
        'plan.status': 'active',
        'plan.type': { $ne: 'free' },
      });

      for (const user of expiredUsers) {
        await this.handleExpiredPlan(user);
      }

      return { processed: expiredUsers.length };
    } catch (error) {
      console.error('Error checking expired plans:', error);
      throw error;
    }
  }

  /**
   * Handle a single expired plan
   */
  static async handleExpiredPlan(user: any) {
    try {
      // Update plan status to expired
      await models.User.findByIdAndUpdate(user._id, {
        'plan.status': 'expired',
        $inc: { tokenVersion: 1 },
      });

      // Also downgrade all organizations owned by this user
      await models.Organization.updateMany(
        { ownerId: user._id },
        {
          'plan.type': 'free',
          'plan.status': 'active',
          'plan.startDate': new Date(),
          'plan.endDate': null,
        }
      );

      // Send email notification about plan expiration
      try {
        const emailQueue = new EmailQueue();
        await emailQueue.addEmailJob(
          'plan_expiration',
          {
            userEmail: user.email,
            userName: user.name || user.email,
            planType: user.plan.type,
          },
          {
            priority: 1,
            jobId: `plan-expiration-${user._id}`,
          }
        );
      } catch (emailError) {
        console.error('Failed to queue plan expiration email:', emailError);
      }
    } catch (error) {
      console.error(`Error handling expired plan for user ${user._id}:`, error);
    }
  }

  /**
   * Extend plan for a user (for renewals)
   */
  static async extendPlan(userId: string, newEndDate: Date, planType: string | null = null) {
    try {
      const updateData: Record<string, any> = {
        'plan.endDate': newEndDate,
        'plan.status': 'active',
        $inc: { tokenVersion: 1 },
      };

      if (planType) {
        updateData['plan.type'] = planType;
      }

      const updatedUser = await models.User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true }
      );

      // Also update all organizations owned by this user
      if (planType) {
        await models.Organization.updateMany(
          { ownerId: userId },
          {
            'plan.type': planType,
            'plan.status': 'active',
            'plan.startDate': new Date(),
            'plan.endDate': newEndDate,
          }
        );
      }

      return updatedUser;
    } catch (error) {
      console.error('Error extending plan:', error);
      throw error;
    }
  }

  /**
   * Cancel plan for a user
   */
  static async cancelPlan(userId: string) {
    try {
      const updatedUser = await models.User.findByIdAndUpdate(
        userId,
        {
          'plan.status': 'cancelled',
          $inc: { tokenVersion: 1 },
        },
        { new: true }
      );

      // Also downgrade all organizations owned by this user
      await models.Organization.updateMany(
        { ownerId: userId },
        {
          'plan.type': 'free',
          'plan.status': 'active',
          'plan.startDate': new Date(),
          'plan.endDate': null,
        }
      );

      return updatedUser;
    } catch (error) {
      console.error('Error cancelling plan:', error);
      throw error;
    }
  }
}
