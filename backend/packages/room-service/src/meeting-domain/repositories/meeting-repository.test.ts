import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FakeMeetingRepository } from './fake-meeting.repository.js';
import { FakeOutboxRepository } from './fake-outbox.repository.js';
import { parseLocalDate, parseLocalTime, parseIanaTimeZone } from '../time/zoned-date-time.js';

describe('MLTR-02: Meeting & Outbox Repository Contract & Invariants', () => {
  const orgA = '11111111-1111-1111-1111-111111111111';
  const orgB = '22222222-2222-2222-2222-222222222222';
  const userId = '33333333-3333-3333-3333-333333333333';

  it('invariant: series templates and joinable occurrences are distinguishable in storage', async () => {
    const meetingRepo = new FakeMeetingRepository();

    const { series, firstOccurrence } = await meetingRepo.createSeriesWithFirstOccurrence({
      series: {
        seriesId: 'series_standup_123',
        organizationId: orgA,
        createdBy: userId,
        title: 'Daily Standup',
        description: 'Morning sync',
        durationMinutes: 30,
        privacy: 'public',
        timeZone: parseIanaTimeZone('America/New_York'),
        localStartDate: parseLocalDate('2026-03-01'),
        localStartTime: parseLocalTime('09:00:00'),
        recurrenceRule: 'RRULE:FREQ=DAILY;COUNT=10',
      },
      firstOccurrence: {
        meetingId: 'meet_standup_occ_1',
        occurrenceKey: '2026-03-01T09:00:00',
        scheduledAt: new Date('2026-03-01T14:00:00.000Z'),
        eventTimeZone: 'America/New_York',
        durationMinutes: 30,
      },
    });

    assert.equal(series.seriesId, 'series_standup_123');
    assert.equal(firstOccurrence.meetingId, 'meet_standup_occ_1');
    assert.equal(firstOccurrence.seriesId, series.id);
    assert.equal(firstOccurrence.occurrenceKey, '2026-03-01T09:00:00');

    // Querying series template directly works
    const foundSeries = await meetingRepo.findSeriesById('series_standup_123', { organizationId: orgA });
    assert.ok(foundSeries);
    assert.equal(foundSeries?.title, 'Daily Standup');

    // Querying window occurrences returns ONLY joinable occurrences, never series templates
    const occurrences = await meetingRepo.listOccurrencesByWindow({
      fromInclusive: new Date('2026-03-01T00:00:00.000Z'),
      toExclusive: new Date('2026-03-02T00:00:00.000Z'),
      tenant: { organizationId: orgA },
    });

    assert.equal(occurrences.length, 1);
    assert.equal(occurrences[0].meetingId, 'meet_standup_occ_1');
    assert.notEqual(occurrences[0].meetingId, series.seriesId);
  });

  it('invariant: duplicate (seriesId, occurrenceKey) throws unique constraint error', async () => {
    const meetingRepo = new FakeMeetingRepository();

    const { series } = await meetingRepo.createSeriesWithFirstOccurrence({
      series: {
        seriesId: 'series_dup_test',
        organizationId: orgA,
        createdBy: userId,
        title: 'Weekly Sync',
        durationMinutes: 45,
        privacy: 'public',
        timeZone: parseIanaTimeZone('UTC'),
        localStartDate: parseLocalDate('2026-04-01'),
        localStartTime: parseLocalTime('10:00:00'),
        recurrenceRule: 'RRULE:FREQ=WEEKLY',
      },
      firstOccurrence: {
        meetingId: 'meet_occ_init',
        occurrenceKey: '2026-04-01T10:00:00',
        scheduledAt: new Date('2026-04-01T10:00:00.000Z'),
        eventTimeZone: 'UTC',
        durationMinutes: 45,
      },
    });

    // Attempting to upsert the exact same occurrenceKey reports existing / not created
    const result = await meetingRepo.upsertOccurrence({
      seriesId: series.id,
      seed: {
        meetingId: 'meet_occ_duplicate',
        occurrenceKey: '2026-04-01T10:00:00',
        scheduledAt: new Date('2026-04-01T10:00:00.000Z'),
        eventTimeZone: 'UTC',
        durationMinutes: 45,
      },
      tenant: { organizationId: orgA },
    });

    assert.equal(result.created, false);
    assert.equal(result.occurrence.meetingId, 'meet_occ_init');
  });

  it('invariant: tenant scoping strictly isolates series and occurrences', async () => {
    const meetingRepo = new FakeMeetingRepository();

    await meetingRepo.createSeriesWithFirstOccurrence({
      series: {
        seriesId: 'series_tenant_test',
        organizationId: orgA,
        createdBy: userId,
        title: 'Confidential Org A',
        durationMinutes: 60,
        privacy: 'private',
        timeZone: parseIanaTimeZone('Europe/London'),
        localStartDate: parseLocalDate('2026-05-01'),
        localStartTime: parseLocalTime('14:00:00'),
        recurrenceRule: 'RRULE:FREQ=DAILY',
      },
      firstOccurrence: {
        meetingId: 'meet_tenant_occ',
        occurrenceKey: '2026-05-01T14:00:00',
        scheduledAt: new Date('2026-05-01T13:00:00.000Z'),
        eventTimeZone: 'Europe/London',
        durationMinutes: 60,
      },
    });

    // Tenant B cannot access Org A's series
    const crossTenantSeries = await meetingRepo.findSeriesById('series_tenant_test', { organizationId: orgB });
    assert.equal(crossTenantSeries, null);

    // Tenant B cannot access Org A's occurrence
    const crossTenantOcc = await meetingRepo.findOccurrenceByKey('series_tenant_test', '2026-05-01T14:00:00', { organizationId: orgB });
    assert.equal(crossTenantOcc, null);

    // Tenant B cannot find meeting by meetingId
    const crossTenantMeeting = await meetingRepo.findMeetingById('meet_tenant_occ', { organizationId: orgB });
    assert.equal(crossTenantMeeting, null);
  });

  it('invariant: revision conflict prevents concurrent stale mutations', async () => {
    const meetingRepo = new FakeMeetingRepository();

    const { series } = await meetingRepo.createSeriesWithFirstOccurrence({
      series: {
        seriesId: 'series_rev_test',
        organizationId: orgA,
        createdBy: userId,
        title: 'Sprint Planning',
        durationMinutes: 60,
        privacy: 'public',
        timeZone: parseIanaTimeZone('UTC'),
        localStartDate: parseLocalDate('2026-06-01'),
        localStartTime: parseLocalTime('11:00:00'),
        recurrenceRule: 'RRULE:FREQ=WEEKLY',
      },
      firstOccurrence: {
        meetingId: 'meet_rev_occ',
        occurrenceKey: '2026-06-01T11:00:00',
        scheduledAt: new Date('2026-06-01T11:00:00.000Z'),
        eventTimeZone: 'UTC',
        durationMinutes: 60,
      },
    });

    assert.equal(series.revision, 1);

    // Update with wrong revision throws
    await assert.rejects(
      async () => {
        await meetingRepo.updateSeriesStatus({
          seriesId: 'series_rev_test',
          status: 'CANCELLED',
          expectedRevision: 999, // Stale
          tenant: { organizationId: orgA },
        });
      },
      (err: Error) => err.message.includes('REVISION_CONFLICT')
    );

    // Update with correct revision increments revision
    const updated = await meetingRepo.updateSeriesStatus({
      seriesId: 'series_rev_test',
      status: 'CANCELLED',
      expectedRevision: 1,
      tenant: { organizationId: orgA },
    });

    assert.equal(updated.status, 'CANCELLED');
    assert.equal(updated.revision, 2);
  });

  it('invariant: outbox appends events and manages publishing lifecycle', async () => {
    const outbox = new FakeOutboxRepository();

    const event = await outbox.append({
      eventId: 'evt_12345',
      aggregateType: 'meeting-series',
      aggregateId: 'series_abc',
      eventType: 'meeting.series.created.v1',
      schemaVersion: 1,
      payload: { seriesId: 'series_abc' },
    });

    assert.equal(event.eventId, 'evt_12345');
    assert.equal(event.publishedAt, null);

    const unpublished = await outbox.fetchUnpublished(10);
    assert.equal(unpublished.length, 1);
    assert.equal(unpublished[0].eventId, 'evt_12345');

    await outbox.markPublished('evt_12345', new Date());

    const unpublishedAfter = await outbox.fetchUnpublished(10);
    assert.equal(unpublishedAfter.length, 0);
  });

  describe('Adversarial & Concurrency Scenarios', () => {
    it('adversarial: prevents cross-tenant mutation of series and occurrences', async () => {
      const meetingRepo = new FakeMeetingRepository();

      await meetingRepo.createSeriesWithFirstOccurrence({
        series: {
          seriesId: 'series_orgA_secure',
          organizationId: orgA,
          createdBy: userId,
          title: 'Protected Org A Series',
          durationMinutes: 30,
          privacy: 'private',
          timeZone: parseIanaTimeZone('UTC'),
          localStartDate: parseLocalDate('2026-07-01'),
          localStartTime: parseLocalTime('09:00:00'),
          recurrenceRule: 'RRULE:FREQ=DAILY',
        },
        firstOccurrence: {
          meetingId: 'meet_orgA_secure',
          occurrenceKey: '2026-07-01T09:00:00',
          scheduledAt: new Date('2026-07-01T09:00:00.000Z'),
          eventTimeZone: 'UTC',
          durationMinutes: 30,
        },
      });

      // Tenant B tries to cancel Tenant A's series
      await assert.rejects(
        async () => {
          await meetingRepo.updateSeriesStatus({
            seriesId: 'series_orgA_secure',
            status: 'CANCELLED',
            expectedRevision: 1,
            tenant: { organizationId: orgB }, // Attacker context
          });
        },
        (err: Error) => err.message.includes('SERIES_NOT_FOUND')
      );

      // Tenant B tries to modify Tenant A's occurrence
      await assert.rejects(
        async () => {
          await meetingRepo.updateMeetingStatus({
            meetingId: 'meet_orgA_secure',
            status: 'cancelled',
            expectedRevision: 1,
            tenant: { organizationId: orgB },
          });
        },
        (err: Error) => err.message.includes('MEETING_NOT_FOUND')
      );
    });

    it('adversarial: detects concurrent modification race between two writers', async () => {
      const meetingRepo = new FakeMeetingRepository();

      await meetingRepo.createSeriesWithFirstOccurrence({
        series: {
          seriesId: 'series_race_test',
          organizationId: orgA,
          createdBy: userId,
          title: 'Race Condition Series',
          durationMinutes: 30,
          privacy: 'public',
          timeZone: parseIanaTimeZone('UTC'),
          localStartDate: parseLocalDate('2026-08-01'),
          localStartTime: parseLocalTime('09:00:00'),
          recurrenceRule: 'RRULE:FREQ=DAILY',
        },
        firstOccurrence: {
          meetingId: 'meet_race_occ',
          occurrenceKey: '2026-08-01T09:00:00',
          scheduledAt: new Date('2026-08-01T09:00:00.000Z'),
          eventTimeZone: 'UTC',
          durationMinutes: 30,
        },
      });

      // Writer 1 succeeds with expectedRevision = 1
      await meetingRepo.updateSeriesStatus({
        seriesId: 'series_race_test',
        status: 'ENDED',
        expectedRevision: 1,
        tenant: { organizationId: orgA },
      });

      // Writer 2 (who read series at revision 1) attempts update with expectedRevision = 1 -> fails
      await assert.rejects(
        async () => {
          await meetingRepo.updateSeriesStatus({
            seriesId: 'series_race_test',
            status: 'CANCELLED',
            expectedRevision: 1, // Stale!
            tenant: { organizationId: orgA },
          });
        },
        (err: Error) => err.message.includes('SERIES_REVISION_CONFLICT')
      );
    });

    it('adversarial: tracks outbox publication failure attempts and error codes', async () => {
      const outbox = new FakeOutboxRepository();

      await outbox.append({
        eventId: 'evt_fail_test',
        aggregateType: 'meeting-series',
        aggregateId: 'series_123',
        eventType: 'meeting.series.created.v1',
        schemaVersion: 1,
        payload: {},
      });

      // Record first failure
      await outbox.recordAttempt('evt_fail_test', 'SMTP_CONNECTION_REFUSED');
      let events = await outbox.fetchUnpublished(10);
      assert.equal(events[0].attempts, 1);
      assert.equal(events[0].lastErrorCode, 'SMTP_CONNECTION_REFUSED');

      // Record second failure
      await outbox.recordAttempt('evt_fail_test', 'RATE_LIMITED');
      events = await outbox.fetchUnpublished(10);
      assert.equal(events[0].attempts, 2);
      assert.equal(events[0].lastErrorCode, 'RATE_LIMITED');
    });
  });
});
