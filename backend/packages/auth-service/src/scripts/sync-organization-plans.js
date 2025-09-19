import { connectionPool, createModelFactory } from '@minimeet/shared-models';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Script to sync organization plans with their owners' plans
 * This fixes the issue where organizations show 'free' plan when owner has 'pro' plan
 */
async function syncOrganizationPlans() {
  try {
    console.log('Starting organization plan sync...');

    // Connect to database
    await connectionPool.connect();
    const models = createModelFactory(connectionPool);

    // Find all organizations
    const organizations = await models.Organization.find({}).populate(
      'ownerId',
      'plan'
    );

    console.log(`Found ${organizations.length} organizations to check`);

    let syncedCount = 0;

    for (const org of organizations) {
      if (!org.ownerId) {
        console.log(`Organization ${org.name} has no owner, skipping`);
        continue;
      }

      const ownerPlan = org.ownerId.plan;
      const orgPlan = org.plan;

      // Check if organization plan differs from owner plan
      if (
        orgPlan.type !== ownerPlan.type ||
        orgPlan.status !== ownerPlan.status
      ) {
        console.log(
          `Syncing ${org.name}: ${orgPlan.type} -> ${ownerPlan.type}`
        );

        await models.Organization.findByIdAndUpdate(org._id, {
          'plan.type': ownerPlan.type,
          'plan.status': ownerPlan.status,
          'plan.startDate': ownerPlan.startDate,
          'plan.endDate': ownerPlan.endDate,
        });

        syncedCount++;
      }
    }

    console.log(`Sync completed. Updated ${syncedCount} organizations`);
  } catch (error) {
    console.error('Error syncing organization plans:', error);
  } finally {
    await connectionPool.disconnect();
    process.exit(0);
  }
}

// Run the sync
syncOrganizationPlans();
