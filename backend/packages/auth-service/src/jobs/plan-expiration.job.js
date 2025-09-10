import cron from 'node-cron';
import { PlanExpirationService } from '../middleware/plan-validation.js';

/**
 * Cron job to check for expired plans and handle them
 * Runs every hour to catch expired plans promptly
 */

// Check for expired plans every hour
cron.schedule('0 * * * *', async () => {
  console.log('Starting plan expiration check...');
  try {
    const result = await PlanExpirationService.checkExpiredPlans();
    console.log(
      `Plan expiration check completed. Processed ${result.processed} users.`
    );
  } catch (error) {
    console.error('Error during plan expiration check:', error);
  }
});

// Also run a daily comprehensive check at 2 AM UTC
cron.schedule('0 2 * * *', async () => {
  console.log('Starting daily comprehensive plan expiration check...');
  try {
    const result = await PlanExpirationService.checkExpiredPlans();
    console.log(
      `Daily plan expiration check completed. Processed ${result.processed} users.`
    );
  } catch (error) {
    console.error('Error during daily plan expiration check:', error);
  }
});

console.log('Plan expiration cron jobs scheduled');
