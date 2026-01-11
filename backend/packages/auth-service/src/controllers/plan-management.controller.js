import { models } from '../index.js';
import { PlanExpirationService } from '../middleware/plan-validation.js';
import { PaymentService } from '../services/payment.service.js';
import { OrganizationPlanSyncService } from '../services/organization-plan-sync.service.js';
import { generateJWTToken } from '../utils/generate-token.js';
import { EmailQueue } from '@minimeet/shared';

export class PlanManagementController {
  /**
   * POST /plan/extend - Extend user's plan (admin only)
   */
  async extendPlan(req, res) {
    try {
      const { userId, newEndDate, planType } = req.body;
      const adminUserId = req.user._id;

      // Basic validation
      if (!userId || !newEndDate) {
        return res.status(400).json({
          message: 'userId and newEndDate are required',
        });
      }

      // Check if the new end date is valid
      const endDate = new Date(newEndDate);
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({
          message: 'Invalid end date format',
        });
      }

      // Find the user
      const user = await models.User.findById(userId);
      if (!user) {
        return res.status(404).json({
          message: 'User not found',
        });
      }

      // Extend the plan
      const updatedUser = await PlanExpirationService.extendPlan(
        userId,
        endDate,
        planType
      );

      // Sync organizations to reflect extended plan
      await OrganizationPlanSyncService.syncUserOrganizations(userId);

      // Generate new token
      const newToken = generateJWTToken(updatedUser);

      // Queue upgrade confirmation email
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
        // Don't fail the request if email fails
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
  async cancelPlan(req, res) {
    try {
      const userId = req.user._id;
      const { immediately = false } = req.body;

      // Get user to check for Stripe subscription
      const user = await models.User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Cancel Stripe subscription if it exists
      if (user.plan.stripeSubscriptionId) {
        try {
          await PaymentService.cancelSubscription(
            user.plan.stripeSubscriptionId,
            immediately
          );
        } catch (stripeError) {
          console.error('Error canceling Stripe subscription:', stripeError);
          // Continue with database cancellation even if Stripe fails
        }
      }

      // Update database plan status
      const updatedUser = await PlanExpirationService.cancelPlan(userId);

      // Sync organizations to reflect cancelled status
      await OrganizationPlanSyncService.syncUserOrganizations(userId);

      // Generate new token
      const newToken = generateJWTToken(updatedUser);

      // Queue cancellation confirmation email
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
        // Don't fail the request if email fails
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
  async cancelAutoRenewal(req, res) {
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

      // Cancel at period end (not immediately)
      await PaymentService.cancelSubscription(
        user.plan.stripeSubscriptionId,
        false
      );

      // Generate new token
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
  async getPlanStatus(req, res) {
    try {
      const user = req.user;

      const planStatus = {
        type: user.plan.type,
        status: user.plan.status,
        startDate: user.plan.startDate,
        endDate: user.plan.endDate,
        isExpired: user.plan.status === 'expired',
        isCancelled: user.plan.status === 'cancelled',
        isActive: user.plan.status === 'active',
      };

      // Calculate days until expiry
      if (user.plan.endDate) {
        const now = new Date();
        const endDate = new Date(user.plan.endDate);
        const daysUntilExpiry = Math.ceil(
          (endDate - now) / (1000 * 60 * 60 * 24)
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
  async checkExpiredPlans(req, res) {
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
