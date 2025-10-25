import { models } from '../index.js';
import { PlanExpirationService } from '../middleware/plan-validation.js';
import { generateJWTToken } from '../utils/generate-token.js';
import {
  sendPlanUpgradeEmail,
  sendPlanCancellationEmail,
} from '../services/email-service.js';

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

      // Generate new token
      const newToken = generateJWTToken(updatedUser);

      // Send upgrade confirmation email
      try {
        await sendPlanUpgradeEmail(
          updatedUser.email,
          updatedUser.name,
          updatedUser.plan.type,
          updatedUser.plan.endDate
        );
      } catch (emailError) {
        console.error('Error sending upgrade email:', emailError);
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

      const updatedUser = await PlanExpirationService.cancelPlan(userId);

      // Generate new token
      const newToken = generateJWTToken(updatedUser);

      // Send cancellation confirmation email
      try {
        await sendPlanCancellationEmail(
          updatedUser.email,
          updatedUser.name,
          updatedUser.plan.type,
          updatedUser.plan.endDate
        );
      } catch (emailError) {
        console.error('Error sending cancellation email:', emailError);
        // Don't fail the request if email fails
      }

      res.json({
        message: 'Plan cancelled successfully',
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
