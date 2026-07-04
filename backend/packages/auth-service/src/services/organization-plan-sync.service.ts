import { models } from '../index.js';

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
      const organization = await models.Organization.findById(
        organizationId
      ).populate('ownerId', 'plan');

      if (!organization) {
        throw new Error('Organization not found');
      }

      if (!organization.ownerId) {
        console.warn(`Organization ${organizationId} has no owner`);
        return { synced: false, reason: 'No owner' };
      }

      const ownerPlan = (organization.ownerId as any).plan;
      const orgPlan = organization.plan;

      if (
        orgPlan.type !== ownerPlan.type ||
        orgPlan.status !== ownerPlan.status ||
        orgPlan.endDate?.getTime() !== ownerPlan.endDate?.getTime()
      ) {
        await models.Organization.findByIdAndUpdate(organizationId, {
          'plan.type': ownerPlan.type,
          'plan.status': ownerPlan.status,
          'plan.startDate': ownerPlan.startDate,
          'plan.endDate': ownerPlan.endDate,
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
      const user = await models.User.findById(userId);

      if (!user) {
        throw new Error('User not found');
      }

      const organizations = await models.Organization.find({
        ownerId: userId,
      });

      const results = [];

      for (const org of organizations) {
        try {
          const result = await this.syncOrganizationWithOwner(org._id);
          results.push(result);
        } catch (error: any) {
          console.error(
            `Error syncing organization ${org._id} for user ${userId}:`,
            error
          );
          results.push({
            synced: false,
            organizationId: org._id.toString(),
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
      const organizations = await models.Organization.find({}).populate(
        'ownerId',
        'plan'
      );

      let syncedCount = 0;
      let skippedCount = 0;
      const errors = [];

      for (const org of organizations) {
        try {
          if (!org.ownerId) {
            skippedCount++;
            continue;
          }

          const ownerPlan = (org.ownerId as any).plan;
          const orgPlan = org.plan;

          if (
            orgPlan.type !== ownerPlan.type ||
            orgPlan.status !== ownerPlan.status ||
            orgPlan.endDate?.getTime() !== ownerPlan.endDate?.getTime()
          ) {
            await models.Organization.findByIdAndUpdate(org._id, {
              'plan.type': ownerPlan.type,
              'plan.status': ownerPlan.status,
              'plan.startDate': ownerPlan.startDate,
              'plan.endDate': ownerPlan.endDate,
            });

            syncedCount++;
          } else {
            skippedCount++;
          }
        } catch (error: any) {
          errors.push({
            organizationId: org._id.toString(),
            error: error.message,
          });
          console.error(`Error syncing organization ${org._id}:`, error);
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
