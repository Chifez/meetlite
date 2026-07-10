import { Request, Response } from 'express';
import { PlanValidationService } from '@minimeet/shared';
// @ts-ignore
import { OrganizationPlanSyncService } from '../services/organization-plan-sync.service.js';
import {
  getPlanConstraints,
  getUpgradeSuggestions,
} from '@minimeet/shared';
import { prisma } from '@minimeet/shared';

export class PlanController {
  /**
   * Get effective plan for user (organization plan if in org mode, user plan otherwise)
   */
  async getEffectivePlan(req: any) {
    const user = req.user;

    if (user.organizationId) {
      const organization = await prisma.organization.findUnique({
        where: { id: user.organizationId }
      });

      if (organization) {
        await OrganizationPlanSyncService.syncOrganizationWithOwner(
          organization.id
        );

        const syncedOrg: any = await prisma.organization.findUnique({
          where: { id: user.organizationId }
        });

        return {
          planType: syncedOrg.planType,
          planStatus: syncedOrg.planStatus,
          plan: {
            type: syncedOrg.planType,
            status: syncedOrg.planStatus,
            startDate: syncedOrg.planStartDate,
            endDate: syncedOrg.planEndDate,
            stripeSubscriptionId: syncedOrg.planStripeSubscriptionId,
            stripeSessionId: syncedOrg.planStripeSessionId,
          },
          isOrganizationPlan: true,
        };
      }
    }

    return {
      planType: user.planType || user.plan?.type,
      planStatus: user.planStatus || user.plan?.status,
      plan: {
        type: user.planType || user.plan?.type,
        status: user.planStatus || user.plan?.status,
        startDate: user.planStartDate || user.plan?.startDate,
        endDate: user.planEndDate || user.plan?.endDate,
        stripeSubscriptionId: user.stripeSubscriptionId || user.plan?.stripeSubscriptionId,
        stripeSessionId: user.stripeSessionId || user.plan?.stripeSessionId,
      },
      isOrganizationPlan: false,
    };
  }

  /**
   * GET /plan/usage - Get current user's plan usage
   */
  async getPlanUsage(req: any, res: Response) {
    try {
      const userId = req.user.id || req.user._id;

      const effectivePlan = await this.getEffectivePlan(req);

      const user = await prisma.user.findUnique({ where: { id: userId }, include: { usage: true } });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const planConstraints = getPlanConstraints(effectivePlan.planType);

      const usageSummary = {
        plan: effectivePlan.planType,
        limits: planConstraints,
        usage: {
          organizationsOwned: user.usage?.organizationsOwned || 0,
          organizationsMember: user.usage?.organizationsMember || 0,
          invitationsSentToday: user.usage?.invitationsSentToday || 0,
          invitationsSentThisMonth: user.usage?.invitationsSentThisMonth || 0,
          meetingsCreatedToday: user.usage?.meetingsCreatedToday || 0,
          meetingsCreatedThisMonth: user.usage?.meetingsCreatedThisMonth || 0,
          storageUsedGB: Number(user.usage?.storageUsedGb) || 0,
          apiCallsToday: user.usage?.apiCallsToday || 0,
        },
        canUpgrade: effectivePlan.planType !== 'enterprise',
      };

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
  async getPlanConstraints(req: any, res: Response) {
    try {
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
  async validateAction(req: any, res: Response) {
    try {
      const { action, data } = req.body;
      const userId = req.user.id || req.user._id;

      let validation: any;

      switch (action) {
        case 'send_invitation':
          validation = await PlanValidationService.validateInvitationSending(
            userId,
            prisma
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
            prisma
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
            prisma
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
