// @ts-ignore
import cron from 'node-cron';
import { prisma } from '@minimeet/shared';
import { createRecurrenceInstances, getNextOccurrences } from '../services/recurrence.service.js';
import { OccurrenceMaterializer } from '../meeting-domain/occurrence-materializer.js';
import { PrismaMeetingRepository } from '../meeting-domain/repositories/prisma-meeting.repository.js';
import { PrismaOutboxRepository } from '../meeting-domain/repositories/prisma-outbox.repository.js';
import { RRuleRecurrenceEngine } from '../meeting-domain/recurrence/rrule-recurrence-engine.js';

const recurrenceEngine = new RRuleRecurrenceEngine();
const meetingRepo = new PrismaMeetingRepository(prisma);
const outboxRepo = new PrismaOutboxRepository(prisma);
const materializer = new OccurrenceMaterializer({
  meetingRepository: meetingRepo,
  outboxRepository: outboxRepo,
  recurrenceEngine,
});

/**
 * Core logic for generating recurring meeting instances.
 * Generates instances 30 days ahead for all active recurring meetings.
 */
export async function runRecurrenceJob(): Promise<{ meetingsProcessed: number; instancesCreated: number; v2SeriesProcessed?: number; v2InstancesCreated?: number }> {
  try {
    console.log('🔄 Starting recurrence instance generation job...');

    const now = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30); // 30 days ahead

    // 1. Run v2 Idempotent rolling materialization
    let v2SeriesProcessed = 0;
    let v2InstancesCreated = 0;
    try {
      const v2Results = await materializer.materializeDueSeries(endDate, 100);
      v2SeriesProcessed = v2Results.length;
      v2InstancesCreated = v2Results.reduce((acc, r) => acc + r.created, 0);
      console.log(`✅ v2 Materialization: ${v2SeriesProcessed} series evaluated, ${v2InstancesCreated} occurrences created`);
    } catch (v2Err) {
      console.error('❌ v2 Materialization error:', v2Err);
    }

    // 2. Find all active v1 recurring meetings (legacy backwards compatibility)
    const recurringMeetings = await prisma.meeting.findMany({
      where: {
        isRecurring: true,
        seriesId: null, // Legacy only
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
      `✅ Recurrence job completed: ${processedCount} legacy meetings processed, ${totalInstancesCreated} legacy instances created, ${v2SeriesProcessed} v2 series processed, ${v2InstancesCreated} v2 occurrences created`
    );
    return {
      meetingsProcessed: processedCount,
      instancesCreated: totalInstancesCreated,
      v2SeriesProcessed,
      v2InstancesCreated,
    };
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
