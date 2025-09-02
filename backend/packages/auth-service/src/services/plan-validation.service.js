import {
  getPlanConstraints,
  validateUsage,
  isUnlimited,
  getEffectiveLimit,
} from '@minimeet/shared-models';
import { models } from '../index.js';

export class PlanValidationService {
  /**
   * Validate if user can send invitations based on their plan
   * @param {string} userId - User ID
   * @returns {Object} Validation result
   */
  static async validateInvitationSending(userId) {
    try {
      const user = await models.User.findById(userId);
      if (!user) {
        return { isValid: false, message: 'User not found' };
      }

      const planConstraints = getPlanConstraints(user.plan.type);
      const today = new Date().toDateString();
      const lastInvitationDate = user.usage.lastInvitationDate?.toDateString();

      // Reset daily counter if it's a new day
      if (lastInvitationDate !== today) {
        await models.User.findByIdAndUpdate(userId, {
          'usage.invitationsSentToday': 0,
          'usage.lastInvitationDate': new Date(),
        });
        user.usage.invitationsSentToday = 0;
      }

      // Check daily limit
      const dailyValidation = validateUsage(
        user.plan.type,
        'maxInvitationsPerDay',
        user.usage.invitationsSentToday
      );

      if (!dailyValidation.isValid) {
        return {
          isValid: false,
          message: dailyValidation.message,
          upgradeRequired: true,
          currentPlan: user.plan.type,
          currentUsage: user.usage.invitationsSentToday,
          limit: planConstraints.maxInvitationsPerDay,
        };
      }

      // Check monthly limit
      const monthlyValidation = validateUsage(
        user.plan.type,
        'maxInvitationsPerMonth',
        user.usage.invitationsSentThisMonth
      );

      if (!monthlyValidation.isValid) {
        return {
          isValid: false,
          message: monthlyValidation.message,
          upgradeRequired: true,
          currentPlan: user.plan.type,
          currentUsage: user.usage.invitationsSentThisMonth,
          limit: planConstraints.maxInvitationsPerMonth,
        };
      }

      return { isValid: true, message: 'Can send invitations' };
    } catch (error) {
      console.error('Plan validation error:', error);
      return { isValid: false, message: 'Validation error' };
    }
  }

  /**
   * Validate if user can accept invitation based on their plan
   * @param {string} userId - User ID
   * @param {string} organizationId - Organization ID
   * @param {string} role - Role being assigned
   * @returns {Object} Validation result
   */
  static async validateInvitationAcceptance(userId, organizationId, role) {
    try {
      const user = await models.User.findById(userId);
      if (!user) {
        return { isValid: false, message: 'User not found' };
      }

      const planConstraints = getPlanConstraints(user.plan.type);

      // Count current memberships
      const currentMemberships =
        user.memberships?.filter((m) => m.status === 'active') || [];
      const currentMembershipCount = currentMemberships.length;

      // Check if user is already a member of this organization
      const existingMembership = currentMemberships.find(
        (m) => m.organizationId.toString() === organizationId
      );

      if (existingMembership) {
        return {
          isValid: false,
          message: 'You are already a member of this organization',
        };
      }

      // Check organization membership limit
      const membershipValidation = validateUsage(
        user.plan.type,
        'maxOrganizationsMember',
        currentMembershipCount
      );

      if (!membershipValidation.isValid) {
        return {
          isValid: false,
          message: membershipValidation.message,
          upgradeRequired: true,
          currentPlan: user.plan.type,
          currentUsage: currentMembershipCount,
          limit: planConstraints.maxOrganizationsMember,
        };
      }

      // If becoming an owner, check ownership limit
      if (role === 'owner') {
        const currentOwnedCount = currentMemberships.filter(
          (m) => m.role === 'owner'
        ).length;
        const ownershipValidation = validateUsage(
          user.plan.type,
          'maxOrganizationsOwned',
          currentOwnedCount
        );

        if (!ownershipValidation.isValid) {
          return {
            isValid: false,
            message: ownershipValidation.message,
            upgradeRequired: true,
            currentPlan: user.plan.type,
            currentUsage: currentOwnedCount,
            limit: planConstraints.maxOrganizationsOwned,
          };
        }
      }

      return { isValid: true, message: 'Can accept invitation' };
    } catch (error) {
      console.error('Plan validation error:', error);
      return { isValid: false, message: 'Validation error' };
    }
  }

  /**
   * Validate if organization can accept new members based on owner's plan
   * @param {string} organizationId - Organization ID
   * @returns {Object} Validation result
   */
  static async validateOrganizationCapacity(organizationId) {
    try {
      const organization = await models.Organization.findById(organizationId);
      if (!organization) {
        return { isValid: false, message: 'Organization not found' };
      }

      const owner = await models.User.findById(organization.ownerId);
      if (!owner) {
        return { isValid: false, message: 'Organization owner not found' };
      }

      const planConstraints = getPlanConstraints(owner.plan.type);
      const currentMemberCount = organization.stats?.totalMembers || 0;

      const teamSizeValidation = validateUsage(
        owner.plan.type,
        'maxTeamSize',
        currentMemberCount
      );

      if (!teamSizeValidation.isValid) {
        return {
          isValid: false,
          message: teamSizeValidation.message,
          upgradeRequired: true,
          organizationPlan: owner.plan.type,
          currentMembers: currentMemberCount,
          maxMembers: planConstraints.maxTeamSize,
        };
      }

      return { isValid: true, message: 'Organization can accept new members' };
    } catch (error) {
      console.error('Plan validation error:', error);
      return { isValid: false, message: 'Validation error' };
    }
  }

  /**
   * Update user's invitation usage after sending invitation
   * @param {string} userId - User ID
   */
  static async updateInvitationUsage(userId) {
    try {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      await models.User.findByIdAndUpdate(userId, {
        $inc: {
          'usage.invitationsSentToday': 1,
          'usage.invitationsSentThisMonth': 1,
        },
        $set: {
          'usage.lastInvitationDate': today,
        },
      });
    } catch (error) {
      console.error('Error updating invitation usage:', error);
    }
  }

  /**
   * Update user's membership usage after accepting invitation
   * @param {string} userId - User ID
   * @param {string} role - Role assigned
   */
  static async updateMembershipUsage(userId, role) {
    try {
      const updateFields = {
        $inc: { 'usage.organizationsMember': 1 },
      };

      if (role === 'owner') {
        updateFields.$inc.usage.organizationsOwned = 1;
      }

      await models.User.findByIdAndUpdate(userId, updateFields);
    } catch (error) {
      console.error('Error updating membership usage:', error);
    }
  }

  /**
   * Reset daily usage counters (to be called by cron job)
   */
  static async resetDailyUsage() {
    try {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      await models.User.updateMany(
        { 'usage.lastInvitationDate': { $lt: yesterday } },
        {
          $set: {
            'usage.invitationsSentToday': 0,
            'usage.lastInvitationDate': today,
          },
        }
      );

      await models.User.updateMany(
        { 'usage.lastMeetingDate': { $lt: yesterday } },
        {
          $set: {
            'usage.meetingsCreatedToday': 0,
            'usage.lastMeetingDate': today,
          },
        }
      );

      await models.User.updateMany(
        { 'usage.lastApiCallDate': { $lt: yesterday } },
        {
          $set: {
            'usage.apiCallsToday': 0,
            'usage.lastApiCallDate': today,
          },
        }
      );

      console.log('Daily usage counters reset successfully');
    } catch (error) {
      console.error('Error resetting daily usage:', error);
    }
  }

  /**
   * Reset monthly usage counters (to be called by cron job)
   */
  static async resetMonthlyUsage() {
    try {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      await models.User.updateMany(
        { 'usage.lastMonthlyReset': { $lt: startOfMonth } },
        {
          $set: {
            'usage.invitationsSentThisMonth': 0,
            'usage.meetingsCreatedThisMonth': 0,
            'usage.lastMonthlyReset': today,
          },
        }
      );

      console.log('Monthly usage counters reset successfully');
    } catch (error) {
      console.error('Error resetting monthly usage:', error);
    }
  }

  /**
   * Get user's current usage summary
   * @param {string} userId - User ID
   * @returns {Object} Usage summary
   */
  static async getUserUsageSummary(userId) {
    try {
      const user = await models.User.findById(userId);
      if (!user) {
        return null;
      }

      const planConstraints = getPlanConstraints(user.plan.type);

      return {
        plan: user.plan.type,
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
        canUpgrade: user.plan.type !== 'enterprise',
      };
    } catch (error) {
      console.error('Error getting usage summary:', error);
      return null;
    }
  }
}

export default PlanValidationService;
