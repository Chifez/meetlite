import cron from 'node-cron';
import { PlanValidationService } from '../services/plan-validation.service.js';

/**
 * Cron job to reset daily and monthly usage counters
 * This ensures plan limits are properly enforced
 */

// Reset daily usage counters every day at midnight UTC
cron.schedule('0 0 * * *', async () => {
  console.log('Starting daily usage reset...');
  try {
    await PlanValidationService.resetDailyUsage();
    console.log('Daily usage reset completed successfully');
  } catch (error) {
    console.error('Error during daily usage reset:', error);
  }
});

// Reset monthly usage counters on the 1st of every month at 1 AM UTC
cron.schedule('0 1 1 * *', async () => {
  console.log('Starting monthly usage reset...');
  try {
    await PlanValidationService.resetMonthlyUsage();
    console.log('Monthly usage reset completed successfully');
  } catch (error) {
    console.error('Error during monthly usage reset:', error);
  }
});

console.log('Usage reset cron jobs scheduled:');
console.log('- Daily reset: Every day at 00:00 UTC');
console.log('- Monthly reset: 1st of every month at 01:00 UTC');

export default {
  // Export for testing purposes
  resetDailyUsage: PlanValidationService.resetDailyUsage,
  resetMonthlyUsage: PlanValidationService.resetMonthlyUsage,
};
