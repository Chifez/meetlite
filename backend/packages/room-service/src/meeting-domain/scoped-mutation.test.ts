import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FakeMeetingRepository } from './repositories/fake-meeting.repository.js';
import { FakeOutboxRepository } from './repositories/fake-outbox.repository.js';
import { RRuleRecurrenceEngine } from './recurrence/rrule-recurrence-engine.js';
import { MeetingApplication } from './meeting-application.js';
import { OccurrenceMaterializer } from './occurrence-materializer.js';
import { parseLocalDate, parseLocalTime, parseIanaTimeZone } from './time/zoned-date-time.js';

describe('MLTR-05: Scoped Recurrence Edits and Cancellations', () => {
  const hostId = '11111111-1111-1111-1111-111111111111';
  const attendeeId = '22222222-2222-2222-2222-222222222222';
  const orgId = '33333333-3333-3333-3333-333333333333';

  const hostPrincipal = {
    userId: hostId,
    email: 'host@meetlite.io',
    orgId,
    role: 'member' as const,
  };

  const attendeePrincipal = {
    userId: attendeeId,
    email: 'attendee@meetlite.io',
    orgId,
    role: 'member' as const,
  };

  async function setupTestSeries() {
    const meetingRepo = new FakeMeetingRepository();
    const outboxRepo = new FakeOutboxRepository();
    const recurrenceEngine = new RRuleRecurrenceEngine();

    const app = new MeetingApplication({
      meetingRepository: meetingRepo,
      outboxRepository: outboxRepo,
      recurrenceEngine,
    });

    // Create recurring weekly meeting on Mondays at 10:00:00 America/New_York
    const created = await app.create({
      principal: hostPrincipal,
      command: {
        idempotencyKey: 'cmd_create_scoped_test',
        title: 'Weekly Sync',
        localDate: parseLocalDate('2026-05-04'), // Monday
        localTime: parseLocalTime('10:00:00'),
        timeZone: parseIanaTimeZone('America/New_York'),
        durationMinutes: 45,
        privacy: 'public',
        recurrence: {
          frequency: 'weekly',
          interval: 1,
          weekdays: [1],
          end: { type: 'never' },
        },
      },
    });

    const series = created.series!;
    const firstOcc = created.view.meeting;

    // Materialize 3 more occurrences (May 11, May 18, May 25)
    const materializer = new OccurrenceMaterializer({
      meetingRepository: meetingRepo,
      outboxRepository: outboxRepo,
      recurrenceEngine,
    });

    await materializer.materialize({
      seriesId: series.seriesId,
      expectedRevision: 1,
      fromInclusive: new Date(series.materializedThrough!.getTime() + 1000),
      throughExclusive: new Date('2026-06-01T00:00:00.000Z'),
      commandId: 'cmd_mat_test',
      tenant: { organizationId: orgId },
    });

    const allOccurrences = await meetingRepo.listOccurrencesByWindow({
      fromInclusive: new Date('2026-05-01T00:00:00.000Z'),
      toExclusive: new Date('2026-06-01T00:00:00.000Z'),
      tenant: { organizationId: orgId },
    });

    return { meetingRepo, outboxRepo, recurrenceEngine, app, series, firstOcc, allOccurrences };
  }

  it('occurrence update: edits only the target occurrence, creates exception, and preserves series', async () => {
    const { app, meetingRepo, outboxRepo, allOccurrences, series } = await setupTestSeries();
    const targetOcc = allOccurrences[1]; // May 11 occurrence

    const result = await app.update({
      principal: hostPrincipal,
      command: {
        idempotencyKey: 'cmd_upd_occ_1',
        targetMeetingId: targetOcc.meetingId,
        scope: 'occurrence',
        expectedRevision: targetOcc.lifecycleRevision,
        patch: {
          title: 'Special 1-on-1 Sync',
          durationMinutes: 60,
        },
      },
    });

    assert.equal(result.scope, 'occurrence');
    assert.equal(result.view.meeting.title, 'Special 1-on-1 Sync');
    assert.equal(result.view.meeting.durationMinutes, 60);

    // Other occurrences remain unchanged
    const first = await meetingRepo.findMeetingById(allOccurrences[0].meetingId, { organizationId: orgId });
    assert.equal(first!.title, 'Weekly Sync');
    assert.equal(first!.durationMinutes, 45);

    // Exception record exists for target occurrence
    const exceptions = await meetingRepo.findExceptionsBySeries(series.seriesId, { organizationId: orgId });
    assert.equal(exceptions.length, 1);
    assert.equal(exceptions[0].kind, 'OVERRIDDEN');
    assert.equal(exceptions[0].occurrenceKey, targetOcc.occurrenceKey);

    // Outbox event was emitted
    const events = await outboxRepo.fetchUnpublished(10);
    const updateEvent = events.find((e) => e.eventType === 'meeting.occurrence.updated.v1');
    assert.ok(updateEvent);
    assert.equal((updateEvent.payload as any).meetingId, targetOcc.meetingId);
  });

  it('series update: modifies series definition and updates all future scheduled occurrences', async () => {
    const { app, meetingRepo, outboxRepo, allOccurrences, series } = await setupTestSeries();

    const result = await app.update({
      principal: hostPrincipal,
      command: {
        idempotencyKey: 'cmd_upd_series_1',
        targetMeetingId: allOccurrences[0].meetingId,
        scope: 'series',
        expectedRevision: series.revision,
        patch: {
          title: 'Engineering All-Hands',
          durationMinutes: 50,
        },
      },
    });

    assert.equal(result.scope, 'series');
    assert.equal(result.series!.title, 'Engineering All-Hands');
    assert.equal(result.series!.revision, 2);

    // All scheduled occurrences reflect new title
    for (const occ of allOccurrences) {
      const refreshed = await meetingRepo.findMeetingById(occ.meetingId, { organizationId: orgId });
      assert.equal(refreshed!.title, 'Engineering All-Hands');
      assert.equal(refreshed!.durationMinutes, 50);
    }

    // Outbox event emitted
    const events = await outboxRepo.fetchUnpublished(10);
    const seriesEvent = events.find((e) => e.eventType === 'meeting.series.updated.v1');
    assert.ok(seriesEvent);
  });

  it('following update: splits series and re-parents subsequent occurrences to successor series', async () => {
    const { app, meetingRepo, outboxRepo, allOccurrences, series } = await setupTestSeries();
    const splitTarget = allOccurrences[2]; // May 18 occurrence

    const result = await app.update({
      principal: hostPrincipal,
      command: {
        idempotencyKey: 'cmd_upd_following_1',
        targetMeetingId: splitTarget.meetingId,
        scope: 'following',
        expectedRevision: series.revision,
        patch: {
          title: 'Design Sprint Series',
          durationMinutes: 90,
        },
      },
    });

    assert.equal(result.scope, 'following');
    assert.ok(result.series);
    assert.notEqual(result.series!.id, series.id);
    assert.equal(result.series!.title, 'Design Sprint Series');

    // Predecessor series rule is now capped with UNTIL
    const predecessor = await meetingRepo.findSeriesById(series.seriesId, { organizationId: orgId });
    assert.ok(predecessor!.recurrenceRule.includes('UNTIL='));

    // Target occurrence and May 25 occurrence are now bound to successor series
    const updatedTarget = await meetingRepo.findMeetingById(splitTarget.meetingId, { organizationId: orgId });
    assert.equal(updatedTarget!.seriesId, result.series!.id);

    const followingOcc = await meetingRepo.findMeetingById(allOccurrences[3].meetingId, { organizationId: orgId });
    assert.equal(followingOcc!.seriesId, result.series!.id);

    // Predecessor occurrences remain on predecessor series
    const first = await meetingRepo.findMeetingById(allOccurrences[0].meetingId, { organizationId: orgId });
    assert.equal(first!.seriesId, series.id);
  });

  it('occurrence cancel: cancels single occurrence, creates CANCELLED exception, preserves others', async () => {
    const { app, meetingRepo, outboxRepo, allOccurrences, series } = await setupTestSeries();
    const target = allOccurrences[1];

    const result = await app.cancel({
      principal: hostPrincipal,
      command: {
        idempotencyKey: 'cmd_cancel_occ_1',
        targetMeetingId: target.meetingId,
        scope: 'occurrence',
        expectedRevision: target.lifecycleRevision,
        reason: 'Host on vacation',
      },
    });

    assert.equal(result.scope, 'occurrence');
    assert.equal(result.view.meeting.status, 'cancelled');

    // Exceptions list contains CANCELLED key
    const exceptions = await meetingRepo.findExceptionsBySeries(series.seriesId, { organizationId: orgId });
    assert.equal(exceptions.length, 1);
    assert.equal(exceptions[0].kind, 'CANCELLED');
    assert.equal(exceptions[0].occurrenceKey, target.occurrenceKey);

    // Other occurrences remain scheduled
    const third = await meetingRepo.findMeetingById(allOccurrences[2].meetingId, { organizationId: orgId });
    assert.equal(third!.status, 'scheduled');
  });

  it('series cancel: marks series and all scheduled occurrences cancelled', async () => {
    const { app, meetingRepo, allOccurrences, series } = await setupTestSeries();

    const result = await app.cancel({
      principal: hostPrincipal,
      command: {
        idempotencyKey: 'cmd_cancel_series_1',
        targetMeetingId: allOccurrences[0].meetingId,
        scope: 'series',
        expectedRevision: series.revision,
      },
    });

    assert.equal(result.scope, 'series');
    assert.equal(result.series!.status, 'CANCELLED');

    // All occurrences are cancelled
    for (const occ of allOccurrences) {
      const refreshed = await meetingRepo.findMeetingById(occ.meetingId, { organizationId: orgId });
      assert.equal(refreshed!.status, 'cancelled');
    }
  });

  it('following cancel: caps predecessor series and cancels target and subsequent occurrences', async () => {
    const { app, meetingRepo, allOccurrences, series } = await setupTestSeries();
    const target = allOccurrences[2]; // May 18

    const result = await app.cancel({
      principal: hostPrincipal,
      command: {
        idempotencyKey: 'cmd_cancel_following_1',
        targetMeetingId: target.meetingId,
        scope: 'following',
        expectedRevision: series.revision,
      },
    });

    assert.equal(result.scope, 'following');

    // Target and following (May 18, May 25) are cancelled
    const occ2 = await meetingRepo.findMeetingById(allOccurrences[2].meetingId, { organizationId: orgId });
    const occ3 = await meetingRepo.findMeetingById(allOccurrences[3].meetingId, { organizationId: orgId });
    assert.equal(occ2!.status, 'cancelled');
    assert.equal(occ3!.status, 'cancelled');

    // Prior occurrences (May 4, May 11) remain scheduled
    const occ0 = await meetingRepo.findMeetingById(allOccurrences[0].meetingId, { organizationId: orgId });
    const occ1 = await meetingRepo.findMeetingById(allOccurrences[1].meetingId, { organizationId: orgId });
    assert.equal(occ0!.status, 'scheduled');
    assert.equal(occ1!.status, 'scheduled');
  });

  it('adversarial: non-organizer update and cancel are rejected fail-closed', async () => {
    const { app, allOccurrences, series } = await setupTestSeries();

    await assert.rejects(
      async () => {
        await app.update({
          principal: attendeePrincipal,
          command: {
            idempotencyKey: 'cmd_adv_upd',
            targetMeetingId: allOccurrences[0].meetingId,
            scope: 'occurrence',
            expectedRevision: 1,
            patch: { title: 'Hacked Title' },
          },
        });
      },
      (err: any) => err.code === 'MEETING_ACTION_FORBIDDEN'
    );

    await assert.rejects(
      async () => {
        await app.cancel({
          principal: attendeePrincipal,
          command: {
            idempotencyKey: 'cmd_adv_cancel',
            targetMeetingId: allOccurrences[0].meetingId,
            scope: 'series',
            expectedRevision: series.revision,
          },
        });
      },
      (err: any) => err.code === 'MEETING_ACTION_FORBIDDEN'
    );
  });

  it('concurrency: stale revision conflict is rejected fail-closed', async () => {
    const { app, allOccurrences, series } = await setupTestSeries();

    await assert.rejects(
      async () => {
        await app.update({
          principal: hostPrincipal,
          command: {
            idempotencyKey: 'cmd_stale_upd',
            targetMeetingId: allOccurrences[0].meetingId,
            scope: 'series',
            expectedRevision: 999, // Stale!
            patch: { title: 'Conflict' },
          },
        });
      },
      (err: any) => err.code === 'SERIES_REVISION_CONFLICT'
    );
  });
});
