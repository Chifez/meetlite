import { PlanValidationService } from '../services/plan-validation.service.js';
import {
  getPlanConstraints,
  getUpgradeSuggestions,
} from '@minimeet/shared-models';
import { models } from '../index.js';

export class PlanController {
  /**
   * GET /plan/usage - Get current user's plan usage
   */
  async getPlanUsage(req, res) {
    try {
      const userId = req.user._id;

      const usageSummary = await PlanValidationService.getUserUsageSummary(
        userId
      );

      if (!usageSummary) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Get upgrade suggestions
      const suggestions = getUpgradeSuggestions(
        usageSummary.plan,
        usageSummary.usage
      );

      res.json({
        success: true,
        data: {
          ...usageSummary,
          suggestions,
        },
      });
    } catch (error) {
      console.error('Get plan usage error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * GET /plan/constraints - Get plan constraints for current user
   */
  async getPlanConstraints(req, res) {
    try {
      const userId = req.user._id;
      const user = await models.User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const constraints = getPlanConstraints(user.plan.type);

      res.json({
        success: true,
        data: {
          plan: user.plan.type,
          constraints,
        },
      });
    } catch (error) {
      console.error('Get plan constraints error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * POST /plan/validate - Validate a specific action against plan limits
   */
  async validateAction(req, res) {
    try {
      const { action, data } = req.body;
      const userId = req.user._id;

      let validation;

      switch (action) {
        case 'send_invitation':
          validation = await PlanValidationService.validateInvitationSending(
            userId
          );
          break;

        case 'accept_invitation':
          if (!data.organizationId || !data.role) {
            return res.status(400).json({
              message:
                'organizationId and role are required for accept_invitation',
            });
          }
          validation = await PlanValidationService.validateInvitationAcceptance(
            userId,
            data.organizationId,
            data.role
          );
          break;

        case 'organization_capacity':
          if (!data.organizationId) {
            return res.status(400).json({
              message: 'organizationId is required for organization_capacity',
            });
          }
          validation = await PlanValidationService.validateOrganizationCapacity(
            data.organizationId
          );
          break;

        default:
          return res.status(400).json({
            message:
              'Invalid action. Supported actions: send_invitation, accept_invitation, organization_capacity',
          });
      }

      res.json({
        success: true,
        data: validation,
      });
    } catch (error) {
      console.error('Validate action error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
}

export default PlanController;
