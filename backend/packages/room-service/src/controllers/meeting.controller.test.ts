import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MeetingController } from './meeting.controller.js';
import { AppError, prisma } from '@minimeet/shared';

describe('MLTR-00: Meeting Controller Recurrence Fail-Fast Characterization', () => {
  it('fails fast and cleans up parent row when initial recurrence expansion throws', async () => {
    const controller = new MeetingController();

    let parentMeetingCreated = false;
    let parentMeetingDeleted = false;

    // Save original prisma methods
    const originalUserFindMany = prisma.user.findMany;
    const originalMeetingCreate = prisma.meeting.create;
    const originalMeetingDelete = prisma.meeting.delete;
    const originalMeetingFindMany = prisma.meeting.findMany;

    try {
      (prisma.user as any).findMany = async () => [];
      (prisma.meeting as any).create = async (args: any) => {
        // If it's the child meeting, fail as legacy createRecurrenceInstances does on schema drift
        if (args.data.recurrenceId) {
          throw new Error('PrismaClientValidationError: Unknown field `recurrenceId`');
        }
        parentMeetingCreated = true;
        return {
          id: 'parent-meeting-uuid-999',
          meetingId: 'parent999',
          title: args.data.title,
          scheduledTime: args.data.scheduledTime,
          duration: args.data.duration,
          createdBy: args.data.createdBy,
          isRecurring: true,
          recurrenceRrule: args.data.recurrenceRrule,
        };
      };
      (prisma.meeting as any).delete = async (args: any) => {
        if (args.where.id === 'parent-meeting-uuid-999') {
          parentMeetingDeleted = true;
        }
        return { id: args.where.id };
      };
      (prisma.meeting as any).findMany = async (args: any) => {
        // Schema drift on recurrenceId
        if ('recurrenceId' in (args?.where || {})) {
          throw new Error('PrismaClientValidationError: Unknown field `recurrenceId`');
        }
        return [];
      };

      const req: any = {
        body: {
          title: 'Broken Series',
          scheduledTime: '2026-03-01T14:00:00.000Z',
          duration: 30,
          recurrence: {
            pattern: 'weekly',
            interval: 1,
            daysOfWeek: [0],
          },
        },
        user: {
          userId: 'test-user-uuid',
          organizationId: null,
          email: 'user@test.com',
        },
        headers: {},
      };

      const res: any = {
        status: (code: number) => {
          res.statusCode = code;
          return res;
        },
        json: (data: any) => {
          res.body = data;
          return res;
        },
      };

      await assert.rejects(
        async () => {
          await controller.createMeeting(req, res);
        },
        (err: any) => {
          assert.ok(
            err instanceof AppError && err.message.includes('Failed to generate initial recurrence occurrences'),
            `Expected AppError for initial expansion failure, got: ${err?.message}`
          );
          return true;
        }
      );

      assert.strictEqual(parentMeetingCreated, true, 'Parent meeting was created');
      assert.strictEqual(parentMeetingDeleted, true, 'Orphaned parent meeting was deleted on expansion failure');
    } finally {
      (prisma.user as any).findMany = originalUserFindMany;
      (prisma.meeting as any).create = originalMeetingCreate;
      (prisma.meeting as any).delete = originalMeetingDelete;
      (prisma.meeting as any).findMany = originalMeetingFindMany;
    }
  });
});

