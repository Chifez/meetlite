import cron from 'node-cron';
import { models } from '../index.js';
import { EmailQueue } from '@minimeet/shared';

/**
 * Cron job to send expiry warning emails to users
 * Runs daily at 9 AM UTC to notify users approaching subscription expiry
 */

// Send warnings for subscriptions expiring in 7 days
cron.schedule('0 9 * * *', async () => {
  try {
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    const usersToWarn = await models.User.find({
      'plan.endDate': {
        $gte: now,
        $lte: sevenDaysFromNow,
      },
      'plan.status': 'active',
      'plan.type': { $ne: 'free' },
      // Only send if last warning was more than 3 days ago
      $or: [
        { 'plan.lastWarningSent': { $exists: false } },
        {
          'plan.lastWarningSent': {
            $lt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
          },
        },
      ],
    });

    let sentCount = 0;

    for (const user of usersToWarn) {
      try {
        const endDate = new Date(user.plan.endDate);
        const daysRemaining = Math.ceil(
          (endDate - now) / (1000 * 60 * 60 * 24)
        );

        // Only send if between 1-7 days
        if (daysRemaining >= 1 && daysRemaining <= 7) {
          const emailQueue = new EmailQueue();
          await emailQueue.addEmailJob(
            'plan_expiration_warning',
            {
              userId: user._id.toString(),
              userEmail: user.email,
              userName: user.name || 'User',
              planType: user.plan.type,
              daysRemaining,
            },
            {
              priority: 1,
              jobId: `plan-expiry-warning-${user._id}-${daysRemaining}`,
            }
          );

          // Update last warning sent
          await models.User.findByIdAndUpdate(user._id, {
            'plan.lastWarningSent': new Date(),
          });

          sentCount++;
        }
      } catch (error) {
        console.error(
          `Error sending expiry warning to user ${user._id}:`,
          error
        );
      }
    }

    if (sentCount > 0) {
      console.log(`Sent ${sentCount} expiry warning emails`);
    }
  } catch (error) {
    console.error('Error during expiry warning job:', error);
  }
});

// Also send warnings for subscriptions expiring in 3 days
cron.schedule('0 10 * * *', async () => {
  try {
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);

    const usersToWarn = await models.User.find({
      'plan.endDate': {
        $gte: now,
        $lte: threeDaysFromNow,
      },
      'plan.status': 'active',
      'plan.type': { $ne: 'free' },
      // Only send if last warning was more than 1 day ago
      $or: [
        { 'plan.lastWarningSent': { $exists: false } },
        {
          'plan.lastWarningSent': {
            $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          },
        },
      ],
    });

    let sentCount = 0;

    for (const user of usersToWarn) {
      try {
        const endDate = new Date(user.plan.endDate);
        const daysRemaining = Math.ceil(
          (endDate - now) / (1000 * 60 * 60 * 24)
        );

        // Only send if between 1-3 days
        if (daysRemaining >= 1 && daysRemaining <= 3) {
          const emailQueue = new EmailQueue();
          await emailQueue.addEmailJob(
            'plan_expiration_warning',
            {
              userId: user._id.toString(),
              userEmail: user.email,
              userName: user.name || 'User',
              planType: user.plan.type,
              daysRemaining,
            },
            {
              priority: 1,
              jobId: `plan-expiry-warning-${user._id}-${daysRemaining}`,
            }
          );

          await models.User.findByIdAndUpdate(user._id, {
            'plan.lastWarningSent': new Date(),
          });

          sentCount++;
        }
      } catch (error) {
        console.error(
          `Error sending expiry warning to user ${user._id}:`,
          error
        );
      }
    }

    if (sentCount > 0) {
      console.log(`Sent ${sentCount} expiry warning emails (3-day reminder)`);
    }
  } catch (error) {
    console.error('Error during expiry warning job (3-day):', error);
  }
});

// Also send final warning for subscriptions expiring in 1 day
cron.schedule('0 11 * * *', async () => {
  try {
    const now = new Date();
    const oneDayFromNow = new Date();
    oneDayFromNow.setDate(now.getDate() + 1);

    const usersToWarn = await models.User.find({
      'plan.endDate': {
        $gte: now,
        $lte: oneDayFromNow,
      },
      'plan.status': 'active',
      'plan.type': { $ne: 'free' },
      // Only send if last warning was more than 12 hours ago
      $or: [
        { 'plan.lastWarningSent': { $exists: false } },
        {
          'plan.lastWarningSent': {
            $lt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
          },
        },
      ],
    });

    let sentCount = 0;

    for (const user of usersToWarn) {
      try {
        const endDate = new Date(user.plan.endDate);
        const daysRemaining = Math.ceil(
          (endDate - now) / (1000 * 60 * 60 * 24)
        );

        // Only send if 1 day or less
        if (daysRemaining <= 1) {
          const emailQueue = new EmailQueue();
          await emailQueue.addEmailJob(
            'plan_expiration_warning',
            {
              userId: user._id.toString(),
              userEmail: user.email,
              userName: user.name || 'User',
              planType: user.plan.type,
              daysRemaining,
            },
            {
              priority: 1,
              jobId: `plan-expiry-warning-${user._id}-${daysRemaining}`,
            }
          );

          await models.User.findByIdAndUpdate(user._id, {
            'plan.lastWarningSent': new Date(),
          });

          sentCount++;
        }
      } catch (error) {
        console.error(
          `Error sending expiry warning to user ${user._id}:`,
          error
        );
      }
    }

    if (sentCount > 0) {
      console.log(`Sent ${sentCount} expiry warning emails (final reminder)`);
    }
  } catch (error) {
    console.error('Error during expiry warning job (final):', error);
  }
});
