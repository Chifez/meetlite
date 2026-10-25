// @ts-ignore
import cron from 'node-cron';
// @ts-ignore
import { PlanExpirationService } from '../middleware/plan-validation.js';

export async function runPlanExpirationCheck() {
  return PlanExpirationService.checkExpiredPlans();
}

/**
 * Explicit scheduler for plan expiration checks.
 */
export function startPlanExpirationScheduler() {
  // Check for expired plans every hour
  const hourlyTask = cron.schedule('0 * * * *', async () => {
    try {
      await runPlanExpirationCheck();
    } catch (error) {
      console.error('Error during hourly plan expiration check:', error);
    }
  });

  // Daily comprehensive check at 2 AM UTC
  const dailyTask = cron.schedule('0 2 * * *', async () => {
    try {
      await runPlanExpirationCheck();
    } catch (error) {
      console.error('Error during daily plan expiration check:', error);
    }
  });

  return {
    hourlyTask,
    dailyTask,
    stop: () => {
      hourlyTask.stop();
      dailyTask.stop();
    },
  };
}

export default {
  runPlanExpirationCheck,
  startPlanExpirationScheduler,
};
