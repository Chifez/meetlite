import { prisma } from '@minimeet/shared';

/**
 * Service to sync organization plans with their owner's plan
 * This ensures organizations always have the same plan as their owner
 */
export class OrganizationPlanSyncService {
  /**
   * Sync a single organization with its owner's plan
   */
  static async syncOrganizationWithOwner(organizationId: any) {
    try {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      if (!organization.ownerId) {
        console.warn(`Organization ${organizationId} has no owner`);
        return { synced: false, reason: 'No owner' };
      }

      const owner = await prisma.user.findUnique({ where: { id: organization.ownerId } });
      if (!owner || !owner.planType) {
        return { synced: false, reason: 'Owner or owner plan not found' };
      }

      const ownerPlan = {
        type: owner.planType,
        status: owner.planStatus,
        startDate: owner.planStartDate,
        endDate: owner.planEndDate,
      };
      const orgPlan = {
        type: organization.planType,
        status: organization.planStatus,
        startDate: organization.planStartDate,
        endDate: organization.planEndDate,
      };

      if (
        orgPlan.type !== ownerPlan.type ||
        orgPlan.status !== ownerPlan.status ||
        orgPlan.endDate?.getTime() !== ownerPlan.endDate?.getTime()
      ) {
        await prisma.organization.update({
          where: { id: organizationId },
          data: {
            planType: ownerPlan.type as any,
            planStatus: ownerPlan.status,
            planStartDate: ownerPlan.startDate,
            planEndDate: ownerPlan.endDate,
          }
        });

        return {
          synced: true,
          organizationId: organizationId.toString(),
          oldPlan: orgPlan.type,
          newPlan: ownerPlan.type,
        };
      }

      return { synced: false, reason: 'Already synced' };
    } catch (error) {
      console.error(
        `Error syncing organization ${organizationId} with owner:`,
        error
      );
      throw error;
    }
  }

  /**
   * Sync all organizations owned by a user with their plan
   */
  static async syncUserOrganizations(userId: any) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        throw new Error('User not found');
      }

      const organizations = await prisma.organization.findMany({
        where: { ownerId: userId }
      });

      const results = [];

      for (const org of organizations) {
        try {
          const result = await this.syncOrganizationWithOwner(org.id);
          results.push(result);
        } catch (error: any) {
          console.error(
            `Error syncing organization ${org.id} for user ${userId}:`,
            error
          );
          results.push({
            synced: false,
            organizationId: org.id.toString(),
            error: error.message,
          });
        }
      }

      const syncedCount = results.filter((r) => r.synced).length;

      return {
        userId: userId.toString(),
        totalOrganizations: organizations.length,
        syncedCount,
        results,
      };
    } catch (error) {
      console.error(`Error syncing organizations for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Sync all organizations in the system
   */
  static async syncAllOrganizations() {
    try {
      const organizations = await prisma.organization.findMany({});

      let syncedCount = 0;
      let skippedCount = 0;
      const errors = [];

      for (const org of organizations) {
        try {
          if (!org.ownerId) {
            skippedCount++;
            continue;
          }

          const owner = await prisma.user.findUnique({ where: { id: org.ownerId } });
          if (!owner || !owner.planType) {
            skippedCount++;
            continue;
          }

          const ownerPlan = {
            type: owner.planType,
            status: owner.planStatus,
            startDate: owner.planStartDate,
            endDate: owner.planEndDate,
          };
          const orgPlan = {
            type: org.planType,
            status: org.planStatus,
            startDate: org.planStartDate,
            endDate: org.planEndDate,
          };

          if (
            orgPlan.type !== ownerPlan.type ||
            orgPlan.status !== ownerPlan.status ||
            orgPlan.endDate?.getTime() !== ownerPlan.endDate?.getTime()
          ) {
            await prisma.organization.update({
              where: { id: org.id },
              data: {
                planType: ownerPlan.type as any,
                planStatus: ownerPlan.status,
                planStartDate: ownerPlan.startDate,
                planEndDate: ownerPlan.endDate,
              }
            });

            syncedCount++;
          } else {
            skippedCount++;
          }
        } catch (error: any) {
          errors.push({
            organizationId: org.id.toString(),
            error: error.message,
          });
          console.error(`Error syncing organization ${org.id}:`, error);
        }
      }

      return {
        total: organizations.length,
        synced: syncedCount,
        skipped: skippedCount,
        errors,
      };
    } catch (error) {
      console.error('Error syncing all organizations:', error);
      throw error;
    }
  }
}

export default OrganizationPlanSyncService;
