import { Request, Response } from 'express';
import { models } from '../index.js';
// @ts-ignore
import { PlanExpirationService } from '../middleware/plan-validation.js';
// @ts-ignore
import { PaymentService } from '../services/payment.service.js';
// @ts-ignore
import { OrganizationPlanSyncService } from '../services/organization-plan-sync.service.js';
import { generateJWTToken } from '../utils/generate-token.js';
import { EmailQueue } from '@minimeet/shared';

export class PlanManagementController {
  /**
   * POST /plan/extend - Extend user's plan (admin only)
   */
  async extendPlan(req: any, res: Response) {
    try {
      const { userId, newEndDate, planType } = req.body;

      if (!userId || !newEndDate) {
        return res.status(400).json({
          message: 'userId and newEndDate are required',
        });
      }

      const endDate = new Date(newEndDate);
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({
          message: 'Invalid end date format',
        });
      }

      const user = await models.User.findById(userId);
      if (!user) {
        return res.status(404).json({
          message: 'User not found',
        });
      }

      const updatedUser = await PlanExpirationService.extendPlan(
        userId,
        endDate,
        planType
      );

      await OrganizationPlanSyncService.syncUserOrganizations(userId);

      const newToken = generateJWTToken(updatedUser);

      try {
        const emailQueue = new EmailQueue();
        await emailQueue.addEmailJob(
          'plan_upgrade',
          {
            userId: updatedUser._id.toString(),
            userEmail: updatedUser.email,
            userName: updatedUser.name || '',
            planType: updatedUser.plan.type,
            endDate: updatedUser.plan.endDate,
          },
          {
            priority: 1,
            jobId: `plan-upgrade-${updatedUser._id}`,
          }
        );
      } catch (emailError) {
        console.error('Failed to queue upgrade email:', emailError);
      }

      res.json({
        message: 'Plan extended successfully',
        user: {
          id: updatedUser._id,
          email: updatedUser.email,
          plan: updatedUser.plan,
        },
        token: newToken,
      });
    } catch (error) {
      console.error('Extend plan error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * POST /plan/cancel - Cancel user's plan
   */
  async cancelPlan(req: any, res: Response) {
    try {
      const userId = req.user._id;
      const { immediately = false } = req.body;

      const user = await models.User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (user.plan.stripeSubscriptionId) {
        try {
          await PaymentService.cancelSubscription(
            user.plan.stripeSubscriptionId,
            immediately
          );
        } catch (stripeError) {
          console.error('Error canceling Stripe subscription:', stripeError);
        }
      }

      const updatedUser = await PlanExpirationService.cancelPlan(userId);

      await OrganizationPlanSyncService.syncUserOrganizations(userId);

      const newToken = generateJWTToken(updatedUser);

      try {
        const emailQueue = new EmailQueue();
        await emailQueue.addEmailJob(
          'plan_cancellation',
          {
            userId: updatedUser._id.toString(),
            userEmail: updatedUser.email,
            userName: updatedUser.name || '',
            planType: updatedUser.plan.type,
            endDate: updatedUser.plan.endDate,
          },
          {
            priority: 1,
            jobId: `plan-cancellation-${updatedUser._id}`,
          }
        );
      } catch (emailError) {
        console.error('Failed to queue cancellation email:', emailError);
      }

      res.json({
        message: immediately
          ? 'Plan cancelled immediately'
          : 'Plan cancelled at period end',
        user: {
          id: updatedUser._id,
          email: updatedUser.email,
          plan: updatedUser.plan,
        },
        token: newToken,
      });
    } catch (error) {
      console.error('Cancel plan error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * POST /plan/cancel-auto-renewal - Prevent auto-renewal but keep access until period end
   */
  async cancelAutoRenewal(req: any, res: Response) {
    try {
      const userId = req.user._id;

      const user = await models.User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (!user.plan.stripeSubscriptionId) {
        return res.status(400).json({
          message: 'No active subscription found to cancel',
        });
      }

      await PaymentService.cancelSubscription(
        user.plan.stripeSubscriptionId,
        false
      );

      const newToken = generateJWTToken(user);

      res.json({
        message:
          'Auto-renewal cancelled. Your subscription will remain active until the end of the current billing period.',
        user: {
          id: user._id,
          email: user.email,
          plan: user.plan,
        },
        token: newToken,
      });
    } catch (error) {
      console.error('Cancel auto-renewal error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * GET /plan/status - Get current plan status with expiry info
   */
  async getPlanStatus(req: any, res: Response) {
    try {
      const user = req.user;

      const planStatus: any = {
        type: user.plan.type,
        status: user.plan.status,
        startDate: user.plan.startDate,
        endDate: user.plan.endDate,
        isExpired: user.plan.status === 'expired',
        isCancelled: user.plan.status === 'cancelled',
        isActive: user.plan.status === 'active',
      };

      if (user.plan.endDate) {
        const now = new Date();
        const endDate = new Date(user.plan.endDate);
        const daysUntilExpiry = Math.ceil(
          (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        planStatus.daysUntilExpiry = daysUntilExpiry;
        planStatus.isExpiringSoon = daysUntilExpiry <= 7 && daysUntilExpiry > 0;
      }

      res.json({
        success: true,
        data: planStatus,
      });
    } catch (error) {
      console.error('Get plan status error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * POST /plan/check-expired - Manual check for expired plans (admin only)
   */
  async checkExpiredPlans(req: Request, res: Response) {
    try {
      const result = await PlanExpirationService.checkExpiredPlans();

      res.json({
        message: 'Expired plans check completed',
        processed: result.processed,
      });
    } catch (error) {
      console.error('Check expired plans error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
}

export default PlanManagementController;
