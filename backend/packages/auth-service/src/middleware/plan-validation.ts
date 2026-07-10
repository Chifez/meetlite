import { Response, NextFunction } from 'express';
import { getPlanConstraints } from '@minimeet/shared';
import { prisma, EmailQueue } from '@minimeet/shared';
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
    if (user.planStatus === 'expired' || user.plan?.status === 'expired') {
      return res.status(403).json({
        message:
          'Your plan has expired. Please renew to continue using premium features.',
        planStatus: 'expired',
        currentPlan: user.planType || user.plan?.type,
        upgradeRequired: true,
      });
    }

    // Check if plan is cancelled
    if (user.planStatus === 'cancelled' || user.plan?.status === 'cancelled') {
      return res.status(403).json({
        message:
          'Your plan has been cancelled. Please reactivate to continue using premium features.',
        planStatus: 'cancelled',
        currentPlan: user.planType || user.plan?.type,
        upgradeRequired: true,
      });
    }

    // Check if plan has an end date and is approaching expiration
    const userEndDate = user.planEndDate || user.plan?.endDate;
    if (userEndDate) {
      const now = new Date();
      const endDate = new Date(userEndDate);
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
          currentPlan: user.planType || user.plan?.type,
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

      const currentPlanType = user.planType || user.plan?.type;
      const planConstraints = getPlanConstraints(currentPlanType);

      if (!planConstraints.features.includes(requiredFeature)) {
        return res.status(403).json({
          message: `This feature requires a ${getUpgradePlan(
            currentPlanType
          )} plan or higher.`,
          currentPlan: currentPlanType,
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
      const expiredUsers = await prisma.user.findMany({
        where: {
          planEndDate: { lt: now },
          planStatus: 'active',
          planType: { not: 'free' },
        }
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
      await prisma.user.update({
        where: { id: user.id || user._id },
        data: {
          planStatus: 'expired',
          tokenVersion: { increment: 1 }
        }
      });

      // Also downgrade all organizations owned by this user
      await prisma.organization.updateMany({
        where: { ownerId: user.id || user._id },
        data: {
          planType: 'free',
          planStatus: 'active',
          planStartDate: new Date(),
          planEndDate: null,
        }
      });

      // Send email notification about plan expiration
      try {
        const emailQueue = new EmailQueue();
        await emailQueue.addEmailJob(
          'plan_expiration',
          {
            userEmail: user.email,
            userName: user.name || user.email,
            planType: user.planType || user.plan?.type,
          },
          {
            priority: 1,
            jobId: `plan-expiration-${user.id || user._id}`,
          }
        );
      } catch (emailError) {
        console.error('Failed to queue plan expiration email:', emailError);
      }
    } catch (error) {
      console.error(`Error handling expired plan for user ${user.id || user._id}:`, error);
    }
  }

  /**
   * Extend plan for a user (for renewals)
   */
  static async extendPlan(userId: string, newEndDate: Date, planType: string | null = null) {
    try {
      const updateData: any = {
        planEndDate: newEndDate,
        planStatus: 'active',
        tokenVersion: { increment: 1 },
      };

      if (planType) {
        updateData.planType = planType as any;
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData
      });

      // Also update all organizations owned by this user
      if (planType) {
        await prisma.organization.updateMany({
          where: { ownerId: userId },
          data: {
            planType: planType as any,
            planStatus: 'active',
            planStartDate: new Date(),
            planEndDate: newEndDate,
          }
        });
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
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          planStatus: 'cancelled',
          tokenVersion: { increment: 1 },
        }
      });

      // Also downgrade all organizations owned by this user
      await prisma.organization.updateMany({
        where: { ownerId: userId },
        data: {
          planType: 'free',
          planStatus: 'active',
          planStartDate: new Date(),
          planEndDate: null,
        }
      });

      return updatedUser;
    } catch (error) {
      console.error('Error cancelling plan:', error);
      throw error;
    }
  }
}
