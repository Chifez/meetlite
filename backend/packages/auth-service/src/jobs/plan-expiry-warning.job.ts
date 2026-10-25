// @ts-ignore
import cron from 'node-cron';
import { EmailQueue, prisma } from '@minimeet/shared';

/**
 * Check and send warnings for plans expiring in the next `daysThreshold` days.
 */
export async function sendExpiryWarningsForDays(daysThreshold: number, priority = 1): Promise<number> {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(now.getDate() + daysThreshold);

  const minHoursBetweenWarnings = daysThreshold <= 1 ? 12 : daysThreshold <= 3 ? 24 : 72;

  const usersToWarn = await prisma.user.findMany({
    where: {
      planEndDate: {
        gte: now,
        lte: futureDate,
      },
      planStatus: 'active',
      planType: { not: 'free' },
      OR: [
        { planLastWarningSent: null },
        {
          planLastWarningSent: {
            lt: new Date(now.getTime() - minHoursBetweenWarnings * 60 * 60 * 1000),
          },
        },
      ],
    },
  });

  let sentCount = 0;

  for (const user of usersToWarn) {
    try {
      const endDate = new Date(user.planEndDate as Date).getTime();
      const daysRemaining = Math.ceil((endDate - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysRemaining >= 1 && daysRemaining <= daysThreshold) {
        const emailQueue = new EmailQueue();
        await emailQueue.addEmailJob(
          'plan_expiration_warning',
          {
            userId: user.id,
            userEmail: user.email,
            userName: user.name || 'User',
            planType: user.planType,
            daysRemaining,
          },
          {
            priority,
            jobId: `plan-expiry-warning-${user.id}-${daysRemaining}`,
          }
        );

        await prisma.user.update({
          where: { id: user.id },
          data: { planLastWarningSent: new Date() },
        });

        sentCount++;
      }
    } catch (error) {
      console.error(`Error sending expiry warning to user ${user.id}:`, error);
    }
  }

  return sentCount;
}

/**
 * Explicit scheduler for plan expiry warnings.
 */
export function startPlanExpiryWarningScheduler() {
  // 7-day warnings at 9 AM UTC
  const task7d = cron.schedule('0 9 * * *', async () => {
    try {
      const count = await sendExpiryWarningsForDays(7, 1);
      if (count > 0) console.log(`Sent ${count} expiry warning emails (7-day reminder)`);
    } catch (error) {
      console.error('Error during expiry warning job (7-day):', error);
    }
  });

  // 3-day warnings at 10 AM UTC
  const task3d = cron.schedule('0 10 * * *', async () => {
    try {
      const count = await sendExpiryWarningsForDays(3, 1);
      if (count > 0) console.log(`Sent ${count} expiry warning emails (3-day reminder)`);
    } catch (error) {
      console.error('Error during expiry warning job (3-day):', error);
    }
  });

  // Final 1-day warning at 11 AM UTC
  const task1d = cron.schedule('0 11 * * *', async () => {
    try {
      const count = await sendExpiryWarningsForDays(1, 2);
      if (count > 0) console.log(`Sent ${count} expiry warning emails (final reminder)`);
    } catch (error) {
      console.error('Error during expiry warning job (final):', error);
    }
  });

  return {
    task7d,
    task3d,
    task1d,
    stop: () => {
      task7d.stop();
      task3d.stop();
      task1d.stop();
    },
  };
}
