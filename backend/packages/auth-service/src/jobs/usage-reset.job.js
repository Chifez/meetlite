import cron from 'node-cron';
import { PlanValidationService } from '../services/plan-validation.service.js';

/**
 * Cron job to reset daily and monthly usage counters
 * This ensures plan limits are properly enforced
 */

// Reset daily usage counters every day at midnight UTC
cron.schedule('0 0 * * *', async () => {
  try {
    await PlanValidationService.resetDailyUsage();
  } catch (error) {
    console.error('Error during daily usage reset:', error);
  }
});

// Reset monthly usage counters on the 1st of every month at 1 AM UTC
cron.schedule('0 1 1 * *', async () => {
  try {
    await PlanValidationService.resetMonthlyUsage();
  } catch (error) {
    console.error('Error during monthly usage reset:', error);
  }
});

export default {
  // Export for testing purposes
  resetDailyUsage: PlanValidationService.resetDailyUsage,
  resetMonthlyUsage: PlanValidationService.resetMonthlyUsage,
};
