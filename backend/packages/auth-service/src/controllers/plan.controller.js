import { PlanValidationService } from '@minimeet/shared-models';
import { OrganizationPlanSyncService } from '../services/organization-plan-sync.service.js';
import {
  getPlanConstraints,
  getUpgradeSuggestions,
} from '@minimeet/shared-models';
import { models } from '../index.js';

export class PlanController {
  /**
   * Get effective plan for user (organization plan if in org mode, user plan otherwise)
   */
  async getEffectivePlan(req) {
    const user = req.user;

    // If user is in organization mode, use organization plan
    if (user.organizationId) {
      const organization = await models.Organization.findById(
        user.organizationId
      );

      if (organization) {
        // Ensure organization plan is synced with owner
        await OrganizationPlanSyncService.syncOrganizationWithOwner(
          organization._id
        );

        // Reload to get updated plan
        const syncedOrg = await models.Organization.findById(
          user.organizationId
        );

        return {
          planType: syncedOrg.plan.type,
          planStatus: syncedOrg.plan.status,
          plan: syncedOrg.plan,
          isOrganizationPlan: true,
        };
      }
    }

    // Personal mode: use user plan
    return {
      planType: user.plan.type,
      planStatus: user.plan.status,
      plan: user.plan,
      isOrganizationPlan: false,
    };
  }

  /**
   * GET /plan/usage - Get current user's plan usage
   */
  async getPlanUsage(req, res) {
    try {
      const userId = req.user._id;

      // Get effective plan (org or user)
      const effectivePlan = await this.getEffectivePlan(req);

      // Get usage summary using effective plan
      const user = await models.User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const planConstraints = getPlanConstraints(effectivePlan.planType);

      const usageSummary = {
        plan: effectivePlan.planType,
        limits: planConstraints,
        usage: {
          organizationsOwned: user.usage.organizationsOwned,
          organizationsMember: user.usage.organizationsMember,
          invitationsSentToday: user.usage.invitationsSentToday,
          invitationsSentThisMonth: user.usage.invitationsSentThisMonth,
          meetingsCreatedToday: user.usage.meetingsCreatedToday,
          meetingsCreatedThisMonth: user.usage.meetingsCreatedThisMonth,
          storageUsedGB: user.usage.storageUsedGB,
          apiCallsToday: user.usage.apiCallsToday,
        },
        canUpgrade: effectivePlan.planType !== 'enterprise',
      };

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
      // Get effective plan (org or user)
      const effectivePlan = await this.getEffectivePlan(req);

      const constraints = getPlanConstraints(effectivePlan.planType);

      res.json({
        success: true,
        data: {
          plan: effectivePlan.planType,
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
            userId,
            models
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
            data.role,
            models
          );
          break;

        case 'organization_capacity':
          if (!data.organizationId) {
            return res.status(400).json({
              message: 'organizationId is required for organization_capacity',
            });
          }
          validation = await PlanValidationService.validateOrganizationCapacity(
            data.organizationId,
            models
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
