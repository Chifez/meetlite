import {
  getPlanConstraints,
  validateUsage,
  isUnlimited,
  getEffectiveLimit,
  PlanConstraintValues,
  PlanType,
  UsageValidationResult,
} from '../config/plans.js';

export interface UserUsageSummary {
  plan: PlanType;
  limits: PlanConstraintValues;
  usage: {
    organizationsOwned: number;
    organizationsMember: number;
    invitationsSentToday: number;
    invitationsSentThisMonth: number;
    meetingsCreatedToday: number;
    meetingsCreatedThisMonth: number;
    storageUsedGB: number;
    apiCallsToday: number;
  };
  canUpgrade: boolean;
}

export interface PlanValidationResult {
  isValid: boolean;
  message: string;
  upgradeRequired?: boolean;
  currentPlan?: string;
  currentUsage?: number;
  limit?: number;
  organizationPlan?: string;
  currentMembers?: number;
  maxMembers?: number;
}

/**
 * Plan Validation Service
 *
 * Validates user actions against plan limits and constraints.
 * This service is shared across all backend services.
 *
 * Note: This service requires models to be passed in to avoid circular dependencies.
 */
export class PlanValidationService {
  /**
   * Validate if user can send invitations based on their plan
   * @param userId - User ID
   * @param models - Database models
   * @returns Validation result
   */
  static async validateInvitationSending(userId: string, models: any, redis?: any): Promise<PlanValidationResult> {
    try {
      const user = await models.User.findById(userId);
      if (!user) {
        return { isValid: false, message: 'User not found' };
      }

      const planConstraints = getPlanConstraints(user.plan.type);
      const limit = planConstraints.maxInvitationsPerDay;
      let invitationsToday = user.usage.invitationsSentToday;

      if (redis) {
        const todayStr = new Date().toISOString().split('T')[0];
        const key = `usage:invitations:daily:${userId}:${todayStr}`;

        let redisCount = await redis.get(key);
        if (redisCount === null) {
          const setOk = await redis.set(key, invitationsToday.toString(), 'EX', 86400, 'NX');
          if (setOk === 'OK') {
            redisCount = invitationsToday.toString();
          } else {
            redisCount = (await redis.get(key)) ?? invitationsToday.toString();
          }
        }

        const count = parseInt(redisCount, 10);
        if (limit !== -1 && count >= limit) {
          return {
            isValid: false,
            message: `Daily invitation limit of ${limit} reached.`,
            upgradeRequired: true,
            currentPlan: user.plan.type,
            currentUsage: count,
            limit: limit,
          };
        }
        invitationsToday = count;
      } else {
        const today = new Date().toDateString();
        const lastInvitationDate = user.usage.lastInvitationDate?.toDateString();

        if (lastInvitationDate !== today) {
          await models.User.findByIdAndUpdate(userId, {
            'usage.invitationsSentToday': 0,
            'usage.lastInvitationDate': new Date(),
          });
          invitationsToday = 0;
        }

        const dailyValidation = validateUsage(
          user.plan.type,
          'maxInvitationsPerDay',
          invitationsToday
        );

        if (!dailyValidation.isValid) {
          return {
            isValid: false,
            message: dailyValidation.message,
            upgradeRequired: true,
            currentPlan: user.plan.type,
            currentUsage: invitationsToday,
            limit: limit,
          };
        }
      }

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
   * @param userId - User ID
   * @param organizationId - Organization ID
   * @param role - Role being assigned
   * @param models - Database models
   * @returns Validation result
   */
  static async validateInvitationAcceptance(
    userId: string,
    organizationId: string,
    role: string,
    models: any
  ): Promise<PlanValidationResult> {
    try {
      const user = await models.User.findById(userId);
      if (!user) {
        return { isValid: false, message: 'User not found' };
      }

      const planConstraints = getPlanConstraints(user.plan.type);

      // Count current memberships
      const currentMemberships =
        user.memberships?.filter((m: any) => m.status === 'active') || [];
      const currentMembershipCount = currentMemberships.length;

      // Check if user is already a member of this organization
      const existingMembership = currentMemberships.find(
        (m: any) => m.organizationId.toString() === organizationId
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
          (m: any) => m.role === 'owner'
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
   * @param organizationId - Organization ID
   * @param models - Database models
   * @returns Validation result
   */
  static async validateOrganizationCapacity(organizationId: string, models: any): Promise<PlanValidationResult> {
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
   * @param userId - User ID
   * @param models - Database models
   * @param redis - Redis client instance
   */
  static async updateInvitationUsage(userId: string, models: any, redis?: any): Promise<void> {
    try {
      const today = new Date();

      await models.User.findByIdAndUpdate(userId, {
        $inc: {
          'usage.invitationsSentToday': 1,
          'usage.invitationsSentThisMonth': 1,
        },
        $set: {
          'usage.lastInvitationDate': today,
        },
      });

      if (redis) {
        const todayStr = today.toISOString().split('T')[0];
        const key = `usage:invitations:daily:${userId}:${todayStr}`;
        const exists = await redis.exists(key);
        if (!exists) {
          const user = await models.User.findById(userId);
          const invitationsToday = user?.usage?.invitationsSentToday || 1;
          await redis.set(key, invitationsToday.toString(), 'EX', 86400, 'NX');
        } else {
          await redis.incr(key);
          await redis.expire(key, 86400); // 24h TTL
        }
      }
    } catch (error) {
      console.error('Error updating invitation usage:', error);
    }
  }

  /**
   * Update user's membership usage after accepting invitation
   * @param userId - User ID
   * @param role - Role assigned
   * @param models - Database models
   */
  static async updateMembershipUsage(userId: string, role: string, models: any): Promise<void> {
    try {
      const updateFields: Record<string, any> = {
        $inc: { 'usage.organizationsMember': 1 },
      };

      if (role === 'owner') {
        updateFields.$inc['usage.organizationsOwned'] = 1;
      }

      await models.User.findByIdAndUpdate(userId, updateFields);
    } catch (error) {
      console.error('Error updating membership usage:', error);
    }
  }

  /**
   * Reset daily usage counters (to be called by cron job)
   * @param models - Database models
   */
  static async resetDailyUsage(models: any): Promise<void> {
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
    } catch (error) {
      console.error('Error resetting daily usage:', error);
    }
  }

  /**
   * Reset monthly usage counters (to be called by cron job)
   * @param models - Database models
   */
  static async resetMonthlyUsage(models: any): Promise<void> {
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
    } catch (error) {
      console.error('Error resetting monthly usage:', error);
    }
  }

  /**
   * Get user's current usage summary
   * @param userId - User ID
   * @param models - Database models
   * @returns Usage summary
   */
  static async getUserUsageSummary(userId: string, models: any): Promise<UserUsageSummary | null> {
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
