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
 */
export class PlanValidationService {
  /**
   * Validate if user can send invitations based on their plan
   * @param userId - User ID
   * @param prisma - Prisma client instance
   * @returns Validation result
   */
  static async validateInvitationSending(userId: string, prisma: any, redis?: any): Promise<PlanValidationResult> {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return { isValid: false, message: 'User not found' };
      }

      const planConstraints = getPlanConstraints(user.planType as PlanType || 'free');
      const limit = planConstraints.maxInvitationsPerDay;
      let invitationsToday = user.usageInvitationsSentToday || 0;

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
            currentPlan: user.planType || 'free',
            currentUsage: count,
            limit: limit,
          };
        }
        invitationsToday = count;
      } else {
        const today = new Date().toDateString();
        const lastInvitationDate = user.usageLastInvitationDate?.toDateString();

        if (lastInvitationDate !== today) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              usageInvitationsSentToday: 0,
              usageLastInvitationDate: new Date(),
            }
          });
          invitationsToday = 0;
        }

        const dailyValidation = validateUsage(
          user.planType as PlanType || 'free',
          'maxInvitationsPerDay',
          invitationsToday
        );

        if (!dailyValidation.isValid) {
          return {
            isValid: false,
            message: dailyValidation.message,
            upgradeRequired: true,
            currentPlan: user.planType || 'free',
            currentUsage: invitationsToday,
            limit: limit,
          };
        }
      }

      const monthlyValidation = validateUsage(
        user.planType as PlanType || 'free',
        'maxInvitationsPerMonth',
        user.usageInvitationsSentThisMonth || 0
      );

      if (!monthlyValidation.isValid) {
        return {
          isValid: false,
          message: monthlyValidation.message,
          upgradeRequired: true,
          currentPlan: user.planType || 'free',
          currentUsage: user.usageInvitationsSentThisMonth || 0,
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
   * @param prisma - Prisma client instance
   * @returns Validation result
   */
  static async validateInvitationAcceptance(
    userId: string,
    organizationId: string,
    role: string,
    prisma: any
  ): Promise<PlanValidationResult> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { memberships: true }
      });
      if (!user) {
        return { isValid: false, message: 'User not found' };
      }

      const planConstraints = getPlanConstraints(user.planType as PlanType || 'free');

      // Count current memberships
      const currentMemberships =
        user.memberships?.filter((m: any) => m.status === 'active') || [];
      const currentMembershipCount = currentMemberships.length;

      // Check if user is already a member of this organization
      const existingMembership = currentMemberships.find(
        (m: any) => m.organizationId === organizationId
      );

      if (existingMembership) {
        return {
          isValid: false,
          message: 'You are already a member of this organization',
        };
      }

      // Check organization membership limit
      const membershipValidation = validateUsage(
        user.planType as PlanType || 'free',
        'maxOrganizationsMember',
        currentMembershipCount
      );

      if (!membershipValidation.isValid) {
        return {
          isValid: false,
          message: membershipValidation.message,
          upgradeRequired: true,
          currentPlan: user.planType || 'free',
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
          user.planType as PlanType || 'free',
          'maxOrganizationsOwned',
          currentOwnedCount
        );

        if (!ownershipValidation.isValid) {
          return {
            isValid: false,
            message: ownershipValidation.message,
            upgradeRequired: true,
            currentPlan: user.planType || 'free',
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
   * @param prisma - Prisma client instance
   * @returns Validation result
   */
  static async validateOrganizationCapacity(organizationId: string, prisma: any): Promise<PlanValidationResult> {
    try {
      const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
      if (!organization) {
        return { isValid: false, message: 'Organization not found' };
      }

      const owner = await prisma.user.findUnique({ where: { id: organization.ownerId } });
      if (!owner) {
        return { isValid: false, message: 'Organization owner not found' };
      }

      const planConstraints = getPlanConstraints(owner.planType as PlanType || 'free');
      const currentMemberCount = organization.statsTotalMembers || 0;

      const teamSizeValidation = validateUsage(
        owner.planType as PlanType || 'free',
        'maxTeamSize',
        currentMemberCount
      );

      if (!teamSizeValidation.isValid) {
        return {
          isValid: false,
          message: teamSizeValidation.message,
          upgradeRequired: true,
          organizationPlan: owner.planType || 'free',
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
   * @param prisma - Prisma client instance
   * @param redis - Redis client instance
   */
  static async updateInvitationUsage(userId: string, prisma: any, redis?: any): Promise<void> {
    try {
      const today = new Date();

      await prisma.user.update({
        where: { id: userId },
        data: {
          usageInvitationsSentToday: { increment: 1 },
          usageInvitationsSentThisMonth: { increment: 1 },
          usageLastInvitationDate: today,
        }
      });

      if (redis) {
        const todayStr = today.toISOString().split('T')[0];
        const key = `usage:invitations:daily:${userId}:${todayStr}`;
        const exists = await redis.exists(key);
        if (!exists) {
          const user = await prisma.user.findUnique({ where: { id: userId } });
          const invitationsToday = user?.usageInvitationsSentToday || 1;
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
   * @param prisma - Prisma client instance
   */
  static async updateMembershipUsage(userId: string, role: string, prisma: any): Promise<void> {
    try {
      const data: any = {
        usageOrganizationsMember: { increment: 1 }
      };

      if (role === 'owner') {
        data.usageOrganizationsOwned = { increment: 1 };
      }

      await prisma.user.update({
        where: { id: userId },
        data
      });
    } catch (error) {
      console.error('Error updating membership usage:', error);
    }
  }

  /**
   * Reset daily usage counters (to be called by cron job)
   * @param prisma - Prisma client instance
   */
  static async resetDailyUsage(prisma: any): Promise<void> {
    try {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      await prisma.userUsage.updateMany({
        where: { lastInvitationDate: { lt: yesterday } },
        data: {
          invitationsSentToday: 0,
          lastInvitationDate: today,
        }
      });

      await prisma.userUsage.updateMany({
        where: { lastMeetingDate: { lt: yesterday } },
        data: {
          meetingsCreatedToday: 0,
          lastMeetingDate: today,
        }
      });

      await prisma.userUsage.updateMany({
        where: { lastApiCallDate: { lt: yesterday } },
        data: {
          apiCallsToday: 0,
          lastApiCallDate: today,
        }
      });
    } catch (error) {
      console.error('Error resetting daily usage:', error);
    }
  }

  /**
   * Reset monthly usage counters (to be called by cron job)
   * @param prisma - Prisma client instance
   */
  static async resetMonthlyUsage(prisma: any): Promise<void> {
    try {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      await prisma.userUsage.updateMany({
        where: { lastMonthlyReset: { lt: startOfMonth } },
        data: {
          invitationsSentThisMonth: 0,
          meetingsCreatedThisMonth: 0,
          lastMonthlyReset: today,
        }
      });
    } catch (error) {
      console.error('Error resetting monthly usage:', error);
    }
  }

  /**
   * Get user's current usage summary
   * @param userId - User ID
   * @param prisma - Prisma client instance
   * @returns Usage summary
   */
  static async getUserUsageSummary(userId: string, prisma: any): Promise<UserUsageSummary | null> {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return null;
      }

      const planConstraints = getPlanConstraints(user.planType as PlanType || 'free');

      return {
        plan: user.planType as PlanType || 'free',
        limits: planConstraints,
        usage: {
          organizationsOwned: user.usageOrganizationsOwned || 0,
          organizationsMember: user.usageOrganizationsMember || 0,
          invitationsSentToday: user.usageInvitationsSentToday || 0,
          invitationsSentThisMonth: user.usageInvitationsSentThisMonth || 0,
          meetingsCreatedToday: user.usageMeetingsCreatedToday || 0,
          meetingsCreatedThisMonth: user.usageMeetingsCreatedThisMonth || 0,
          storageUsedGB: user.usageStorageUsedGB ? Number(user.usageStorageUsedGB) : 0,
          apiCallsToday: user.usageApiCallsToday || 0,
        },
        canUpgrade: user.planType !== 'enterprise',
      };
    } catch (error) {
      console.error('Error getting usage summary:', error);
      return null;
    }
  }
}

export default PlanValidationService;
