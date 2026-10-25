// @ts-ignore
import cron from 'node-cron';
import { prisma } from '@minimeet/shared';
import { createRecurrenceInstances, getNextOccurrences } from '../services/recurrence.service.js';

/**
 * Core logic for generating recurring meeting instances.
 * Generates instances 30 days ahead for all active recurring meetings.
 */
export async function runRecurrenceJob(): Promise<{ meetingsProcessed: number; instancesCreated: number }> {
  try {
    console.log('🔄 Starting recurrence instance generation job...');

    const now = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30); // 30 days ahead

    // Find all active recurring meetings
    const recurringMeetings = await prisma.meeting.findMany({
      where: {
        isRecurring: true,
        status: { in: ['scheduled', 'ongoing'] },
      },
    });

    console.log(`📅 Found ${recurringMeetings.length} recurring meetings to process`);

    let totalInstancesCreated = 0;
    let processedCount = 0;

    for (const parentMeeting of recurringMeetings) {
      try {
        // Check if recurrence has end date and it's passed
        if (
          parentMeeting.recurrenceEndDate &&
          new Date(parentMeeting.recurrenceEndDate) < now
        ) {
          console.log(
            `⏭️  Skipping ${parentMeeting.meetingId} - recurrence ended`
          );
          continue;
        }

        // Create instances
        const instances = await createRecurrenceInstances(
          parentMeeting,
          prisma,
          now,
          endDate
        );

        if (instances.length > 0) {
          totalInstancesCreated += instances.length;
          console.log(
            `✅ Created ${instances.length} instances for meeting ${parentMeeting.meetingId}`
          );
        }

        processedCount++;
      } catch (error) {
        console.error(
          `❌ Error processing recurring meeting ${parentMeeting.meetingId}:`,
          error
        );
      }
    }

    console.log(
      `✅ Recurrence job completed: ${processedCount} meetings processed, ${totalInstancesCreated} instances created`
    );
    return { meetingsProcessed: processedCount, instancesCreated: totalInstancesCreated };
  } catch (error) {
    console.error('❌ Error during recurrence instance generation:', error);
    throw error;
  }
}

/**
 * Start explicit recurrence cron scheduler.
 * Runs daily at 2 AM UTC by default.
 */
export function startRecurrenceScheduler(cronExpression = '0 2 * * *') {
  console.log(`⏱️  Scheduling recurrence job with expression: ${cronExpression}`);
  const task = cron.schedule(cronExpression, async () => {
    try {
      await runRecurrenceJob();
    } catch (err) {
      console.error('Scheduled recurrence job failed:', err);
    }
  });

  return {
    task,
    stop: () => task.stop(),
  };
}
