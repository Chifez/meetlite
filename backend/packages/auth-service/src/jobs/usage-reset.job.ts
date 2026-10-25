// @ts-ignore
import cron from 'node-cron';
import { PlanValidationService, prisma } from '@minimeet/shared';

/**
 * Functions to reset daily and monthly usage counters.
 */
export async function resetDailyUsage() {
  return PlanValidationService.resetDailyUsage(prisma);
}

export async function resetMonthlyUsage() {
  return PlanValidationService.resetMonthlyUsage(prisma);
}

/**
 * Explicit scheduler for usage resets.
 */
export function startUsageResetScheduler() {
  const dailyTask = cron.schedule('0 0 * * *', async () => {
    try {
      await resetDailyUsage();
    } catch (error) {
      console.error('Error during daily usage reset:', error);
    }
  });

  const monthlyTask = cron.schedule('0 1 1 * *', async () => {
    try {
      await resetMonthlyUsage();
    } catch (error) {
      console.error('Error during monthly usage reset:', error);
    }
  });

  return {
    dailyTask,
    monthlyTask,
    stop: () => {
      dailyTask.stop();
      monthlyTask.stop();
    },
  };
}

export default {
  resetDailyUsage,
  resetMonthlyUsage,
  startUsageResetScheduler,
};
