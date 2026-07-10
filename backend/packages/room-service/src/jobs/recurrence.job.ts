// @ts-ignore
import cron from 'node-cron';
import { prisma } from '@minimeet/shared';
import { createRecurrenceInstances, getNextOccurrences } from '../services/recurrence.service.js';

/**
 * Cron job to generate recurring meeting instances
 * Runs daily at 2 AM UTC to create instances 30 days ahead
 */
cron.schedule('0 2 * * *', async () => {
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
      }
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
  } catch (error) {
    console.error('❌ Error during recurrence instance generation:', error);
  }
});
