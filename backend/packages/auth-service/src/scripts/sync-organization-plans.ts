import { prisma } from '@minimeet/shared';
import dotenv from 'dotenv';

dotenv.config();

async function syncOrganizationPlans() {
  try {
    await prisma.$connect();
    
    const organizations = await prisma.organization.findMany({
      include: { owner: true }
    });

    let syncedCount = 0;

    for (const org of organizations) {
      if (!org.owner) {
        continue;
      }

      const owner = org.owner;

      if (
        org.planType !== owner.planType ||
        org.planStatus !== owner.planStatus
      ) {
        await prisma.organization.update({
          where: { id: org.id },
          data: {
            planType: owner.planType,
            planStatus: owner.planStatus,
            planStartDate: owner.planStartDate,
            planEndDate: owner.planEndDate,
          }
        });

        syncedCount++;
      }
    }

    console.log(`Synced ${syncedCount} organization plans`);
  } catch (error) {
    console.error('Error syncing organization plans:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

syncOrganizationPlans();
