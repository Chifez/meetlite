// @ts-ignore
import cron from 'node-cron';
// @ts-ignore
import { PlanExpirationService } from '../middleware/plan-validation.js';

/**
 * Cron job to check for expired plans and handle them
 * Runs every hour to catch expired plans promptly
 */

// Check for expired plans every hour
cron.schedule('0 * * * *', async () => {
  try {
    await PlanExpirationService.checkExpiredPlans();
  } catch (error) {
    console.error('Error during plan expiration check:', error);
  }
});

// Also run a daily comprehensive check at 2 AM UTC
cron.schedule('0 2 * * *', async () => {
  try {
    await PlanExpirationService.checkExpiredPlans();
  } catch (error) {
    console.error('Error during daily plan expiration check:', error);
  }
});
