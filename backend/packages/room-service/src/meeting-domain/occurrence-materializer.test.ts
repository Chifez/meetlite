import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OccurrenceMaterializer } from './occurrence-materializer.js';
import { FakeMeetingRepository } from './repositories/fake-meeting.repository.js';
import { FakeOutboxRepository } from './repositories/fake-outbox.repository.js';
import { RRuleRecurrenceEngine } from './recurrence/rrule-recurrence-engine.js';
import { parseLocalDate, parseLocalTime, parseIanaTimeZone } from './time/zoned-date-time.js';

describe('MLTR-04: Idempotent Rolling Materialization', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  const orgId = '22222222-2222-2222-2222-222222222222';

  it('invariant: retries and multiple materializations create at most one row per occurrence key', async () => {
    const meetingRepo = new FakeMeetingRepository();
    const outboxRepo = new FakeOutboxRepository();
    const recurrenceEngine = new RRuleRecurrenceEngine();

    const { series } = await meetingRepo.createSeriesWithFirstOccurrence({
      series: {
        seriesId: 'series_mat_001',
        organizationId: orgId,
        createdBy: userId,
        title: 'Weekly Standup',
        durationMinutes: 30,
        privacy: 'public',
        timeZone: parseIanaTimeZone('America/New_York'),
        localStartDate: parseLocalDate('2026-03-02'), // Monday
        localStartTime: parseLocalTime('09:00:00'),
        recurrenceRule: 'RRULE:FREQ=WEEKLY;INTERVAL=1',
      },
      firstOccurrence: {
        meetingId: 'meet_mat_occ_1',
        occurrenceKey: '2026-03-02T09:00:00',
        scheduledAt: new Date('2026-03-02T14:00:00.000Z'),
        eventTimeZone: 'America/New_York',
        durationMinutes: 30,
      },
    });

    const materializer = new OccurrenceMaterializer({
      meetingRepository: meetingRepo,
      outboxRepository: outboxRepo,
      recurrenceEngine,
    });

    const horizon = new Date('2026-03-25T00:00:00.000Z'); // Covers ~3 more weeks
    const windowStart = new Date(series.materializedThrough!.getTime() + 1000);

    // First run materializes 3 subsequent weekly occurrences (Mar 9, Mar 16, Mar 23)
    const firstResult = await materializer.materialize({
      seriesId: series.seriesId,
      expectedRevision: 1,
      fromInclusive: windowStart,
      throughExclusive: horizon,
      commandId: 'cmd_mat_run_1',
      tenant: { organizationId: orgId },
    });

    assert.equal(firstResult.created, 3);
    assert.equal(firstResult.existing, 0);

    // Second run with same slice reports 0 created, 3 existing (Idempotent!)
    const secondResult = await materializer.materialize({
      seriesId: series.seriesId,
      expectedRevision: 1,
      fromInclusive: windowStart,
      throughExclusive: horizon,
      commandId: 'cmd_mat_run_2',
      tenant: { organizationId: orgId },
    });

    assert.equal(secondResult.created, 0);
    assert.equal(secondResult.existing, 3);

    // Total occurrences in window is exactly 4 (1 first + 3 materialized)
    const occurrences = await meetingRepo.listOccurrencesByWindow({
      fromInclusive: new Date('2026-03-01T00:00:00.000Z'),
      toExclusive: horizon,
      tenant: { organizationId: orgId },
    });

    assert.equal(occurrences.length, 4);
  });

  it('invariant: skips materializing cancelled occurrences with exceptions', async () => {
    const meetingRepo = new FakeMeetingRepository();
    const outboxRepo = new FakeOutboxRepository();
    const recurrenceEngine = new RRuleRecurrenceEngine();

    const { series } = await meetingRepo.createSeriesWithFirstOccurrence({
      series: {
        seriesId: 'series_exc_test',
        organizationId: orgId,
        createdBy: userId,
        title: 'Daily Meeting',
        durationMinutes: 15,
        privacy: 'public',
        timeZone: parseIanaTimeZone('UTC'),
        localStartDate: parseLocalDate('2026-04-01'),
        localStartTime: parseLocalTime('10:00:00'),
        recurrenceRule: 'RRULE:FREQ=DAILY',
      },
      firstOccurrence: {
        meetingId: 'meet_exc_first',
        occurrenceKey: '2026-04-01T10:00:00',
        scheduledAt: new Date('2026-04-01T10:00:00.000Z'),
        eventTimeZone: 'UTC',
        durationMinutes: 15,
      },
    });

    // Add exception cancelling day 2: 2026-04-02T10:00:00
    await meetingRepo.createException({
      seriesId: series.seriesId,
      occurrenceKey: '2026-04-02T10:00:00',
      kind: 'CANCELLED',
      seriesRevision: 1,
      tenant: { organizationId: orgId },
    });

    const materializer = new OccurrenceMaterializer({
      meetingRepository: meetingRepo,
      outboxRepository: outboxRepo,
      recurrenceEngine,
    });

    const horizon = new Date('2026-04-04T00:00:00.000Z'); // Expands 04-02 and 04-03
    const result = await materializer.materialize({
      seriesId: series.seriesId,
      expectedRevision: 1,
      throughExclusive: horizon,
      commandId: 'cmd_exc_mat',
      tenant: { organizationId: orgId },
    });

    assert.equal(result.created, 1); // Only 04-03 created
    assert.equal(result.skippedExceptions, 1); // 04-02 was skipped
  });

  it('invariant: revision conflict prevents materializing obsolete rules', async () => {
    const meetingRepo = new FakeMeetingRepository();
    const outboxRepo = new FakeOutboxRepository();
    const recurrenceEngine = new RRuleRecurrenceEngine();

    const { series } = await meetingRepo.createSeriesWithFirstOccurrence({
      series: {
        seriesId: 'series_stale_test',
        organizationId: orgId,
        createdBy: userId,
        title: 'Sprint Planning',
        durationMinutes: 60,
        privacy: 'public',
        timeZone: parseIanaTimeZone('UTC'),
        localStartDate: parseLocalDate('2026-05-01'),
        localStartTime: parseLocalTime('10:00:00'),
        recurrenceRule: 'RRULE:FREQ=WEEKLY',
      },
      firstOccurrence: {
        meetingId: 'meet_stale_occ',
        occurrenceKey: '2026-05-01T10:00:00',
        scheduledAt: new Date('2026-05-01T10:00:00.000Z'),
        eventTimeZone: 'UTC',
        durationMinutes: 60,
      },
    });

    const materializer = new OccurrenceMaterializer({
      meetingRepository: meetingRepo,
      outboxRepository: outboxRepo,
      recurrenceEngine,
    });

    await assert.rejects(
      async () => {
        await materializer.materialize({
          seriesId: series.seriesId,
          expectedRevision: 999, // Stale expected revision
          throughExclusive: new Date('2026-05-20T00:00:00.000Z'),
          commandId: 'cmd_stale_run',
          tenant: { organizationId: orgId },
        });
      },
      (err: any) => {
        assert.equal(err.code, 'SERIES_REVISION_CONFLICT');
        return true;
      }
    );
  });
});
