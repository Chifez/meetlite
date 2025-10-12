import { connectionPool, createModelFactory } from '@minimeet/shared-models';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Script to sync organization plans with their owners' plans
 * This fixes the issue where organizations show 'free' plan when owner has 'pro' plan
 */
async function syncOrganizationPlans() {
  try {
    // Connect to database
    await connectionPool.connect();
    const models = createModelFactory(connectionPool);

    // Find all organizations
    const organizations = await models.Organization.find({}).populate(
      'ownerId',
      'plan'
    );

    let syncedCount = 0;

    for (const org of organizations) {
      if (!org.ownerId) {
        continue;
      }

      const ownerPlan = org.ownerId.plan;
      const orgPlan = org.plan;

      // Check if organization plan differs from owner plan
      if (
        orgPlan.type !== ownerPlan.type ||
        orgPlan.status !== ownerPlan.status
      ) {
        await models.Organization.findByIdAndUpdate(org._id, {
          'plan.type': ownerPlan.type,
          'plan.status': ownerPlan.status,
          'plan.startDate': ownerPlan.startDate,
          'plan.endDate': ownerPlan.endDate,
        });

        syncedCount++;
      }
    }

    // Sync completed
  } catch (error) {
    console.error('Error syncing organization plans:', error);
  } finally {
    await connectionPool.disconnect();
    process.exit(0);
  }
}

// Run the sync
syncOrganizationPlans();
