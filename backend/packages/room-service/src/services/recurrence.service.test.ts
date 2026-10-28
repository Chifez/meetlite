import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateRRULE,
  getNextOccurrences,
  createRecurrenceInstances,
} from './recurrence.service.js';

describe('MLTR-00: Legacy Recurrence Failure Characterization', () => {
  /**
   * PROBE 1: DST Wall-Clock Drift
   * A weekly 09:00 America/New_York meeting scheduled on March 1, 2026 (14:00 UTC)
   * crosses the US DST boundary on March 8, 2026 (UTC-5 -> UTC-4).
   * Because legacy recurrence operates purely in UTC without an IANA timezone,
   * it preserves 14:00 UTC, causing the local wall-clock time in New York to drift from 09:00 to 10:00.
   */
  it('probe 1: reproduces DST wall-clock drift across March DST transition in America/New_York', () => {
    // 2026-03-01 is Sunday, 09:00 EST -> 14:00:00.000Z
    const startDate = new Date('2026-03-01T14:00:00.000Z');
    const rruleString = generateRRULE(
      { pattern: 'weekly', interval: 1, daysOfWeek: [0] },
      startDate
    );

    const occurrences = getNextOccurrences(
      rruleString,
      startDate,
      new Date('2026-03-01T00:00:00.000Z'),
      3
    );

    assert.strictEqual(occurrences.length, 3, 'Expected 3 weekly occurrences');

    const nyFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const localTimes = occurrences.map((d) => nyFormatter.format(d));

    // March 1: EST (UTC-5) -> 14:00 UTC is 09:00
    assert.strictEqual(localTimes[0], '09:00', 'First occurrence is 09:00 EST');

    // March 8 & 15: EDT (UTC-4) -> 14:00 UTC is 10:00 (1 hour wall-clock drift!)
    // This confirms the defect in the legacy engine:
    assert.strictEqual(
      localTimes[1],
      '10:00',
      'Defect confirmed: March 8 drifted to 10:00 EDT instead of intended 09:00'
    );
    assert.strictEqual(
      localTimes[2],
      '10:00',
      'Defect confirmed: March 15 drifted to 10:00 EDT instead of intended 09:00'
    );
  });

  /**
   * PROBE 2: Schema Drift on recurrenceId vs parentRecurrenceId
   * Prisma schema defines `parentRecurrenceId` on Meeting model.
   * `createRecurrenceInstances` attempts to query and write `recurrenceId`, which fails on a strict schema.
   */
  it('probe 2: reproduces schema drift where recurrence service queries recurrenceId instead of parentRecurrenceId', async () => {
    const parentMeeting: any = {
      id: 'meeting-parent-uuid-001',
      meetingId: 'parent123456',
      title: 'Weekly Sync',
      description: 'Weekly team meeting',
      scheduledTime: new Date('2026-03-01T14:00:00.000Z'),
      duration: 30,
      createdBy: 'user-uuid-1',
      organizationId: null,
      teamId: null,
      participants: [],
      invites: [],
      privacy: 'public',
      isRecurring: true,
      recurrenceRrule: 'RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=SU',
    };

    // Mock Prisma client enforcing schema.prisma fields (Meeting has parentRecurrenceId, not recurrenceId)
    const mockPrisma: any = {
      meeting: {
        findMany: async (args: any) => {
          if ('recurrenceId' in (args.where || {})) {
            throw new Error(
              'PrismaClientValidationError: Unknown field `recurrenceId` for select statement on model Meeting. Did you mean `parentRecurrenceId`?'
            );
          }
          return [];
        },
        create: async (args: any) => {
          if ('recurrenceId' in (args.data || {})) {
            throw new Error(
              'PrismaClientValidationError: Unknown field `recurrenceId` for create statement on model Meeting. Did you mean `parentRecurrenceId`?'
            );
          }
          return { id: 'child-1' };
        },
      },
    };

    await assert.rejects(
      async () => {
        await createRecurrenceInstances(
          parentMeeting,
          mockPrisma,
          new Date('2026-03-01T00:00:00.000Z'),
          new Date('2026-03-31T00:00:00.000Z')
        );
      },
      /Unknown field `recurrenceId`/,
      'Defect confirmed: createRecurrenceInstances crashes due to schema drift on recurrenceId'
    );
  });

  /**
   * PROBE 3: Duplicate First Occurrence on Expansion
   * Parent meeting already represents the first occurrence at DTSTART.
   * Inclusive recurrence expansion creates another child occurrence for that same DTSTART.
   */
  it('probe 3: reproduces duplicate first occurrence when parent DTSTART is expanded as a child instance', async () => {
    const parentScheduledTime = new Date('2026-03-01T14:00:00.000Z');
    const recurrenceRrule = generateRRULE(
      { pattern: 'weekly', interval: 1, daysOfWeek: [0] },
      parentScheduledTime
    );

    const parentMeeting: any = {
      id: 'meeting-parent-uuid-002',
      meetingId: 'parentDTSTART',
      title: 'Sprint Planning',
      description: null,
      scheduledTime: parentScheduledTime,
      duration: 45,
      createdBy: 'user-uuid-2',
      organizationId: null,
      teamId: null,
      participants: [],
      invites: [],
      privacy: 'public',
      isRecurring: true,
      recurrenceRrule,
    };

    const createdInstances: any[] = [];
    const mockPrismaPermissive: any = {
      meeting: {
        findMany: async () => [], // No existing child instances found in DB
        create: async (args: any) => {
          createdInstances.push(args.data);
          return { id: `child-${createdInstances.length}`, ...args.data };
        },
      },
    };

    await createRecurrenceInstances(
      parentMeeting,
      mockPrismaPermissive,
      new Date('2026-03-01T00:00:00.000Z'), // startAfter before the parent meeting
      new Date('2026-03-15T00:00:00.000Z')
    );

    // The first created instance has the exact same scheduled time as parentMeeting.scheduledTime
    const duplicateChild = createdInstances.find(
      (inst) => inst.scheduledTime.getTime() === parentScheduledTime.getTime()
    );

    assert.ok(
      duplicateChild,
      'Defect confirmed: createRecurrenceInstances generated a duplicate child meeting for the parent DTSTART instant'
    );
  });
});
