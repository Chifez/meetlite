import { connectionPool, createModelFactory } from '@minimeet/shared';
import dotenv from 'dotenv';

dotenv.config();

async function syncOrganizationPlans() {
  try {
    const connection = await connectionPool.getConnection('auth', process.env.MONGODB_URI!);
    const models = createModelFactory(connection);

    const organizations = await models.Organization.find({}).populate(
      'ownerId',
      'plan'
    );

    let syncedCount = 0;

    for (const org of organizations) {
      if (!org.ownerId) {
        continue;
      }

      const ownerPlan = (org.ownerId as any).plan;
      const orgPlan = org.plan;

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

    console.log(`Synced ${syncedCount} organization plans`);
  } catch (error) {
    console.error('Error syncing organization plans:', error);
  } finally {
    await connectionPool.closeAll();
    process.exit(0);
  }
}

syncOrganizationPlans();
