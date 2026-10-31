import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MeetingApplication } from './meeting-application.js';
import { FakeMeetingRepository } from './repositories/fake-meeting.repository.js';
import { FakeOutboxRepository } from './repositories/fake-outbox.repository.js';
import { RRuleRecurrenceEngine } from './recurrence/rrule-recurrence-engine.js';
import { parseLocalDate, parseLocalTime, parseIanaTimeZone } from './time/zoned-date-time.js';

describe('MLTR-03: MeetingApplication Atomic Series & First Occurrence Creation', () => {
  const hostUserId = '11111111-1111-1111-1111-111111111111';
  const attendeeUserId = '22222222-2222-2222-2222-222222222222';
  const orgId = '33333333-3333-3333-3333-333333333333';

  it('invariant: successful recurring creation yields a valid series and exactly one first occurrence atomically', async () => {
    const meetingRepo = new FakeMeetingRepository();
    const outboxRepo = new FakeOutboxRepository();
    const recurrenceEngine = new RRuleRecurrenceEngine();

    const app = new MeetingApplication({
      meetingRepository: meetingRepo,
      outboxRepository: outboxRepo,
      recurrenceEngine,
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await app.create({
      principal: { userId: hostUserId, orgId },
      command: {
        idempotencyKey: 'idem_key_001',
        title: 'Weekly Team Architecture Sync',
        description: 'Discuss architecture roadmap',
        localDate: parseLocalDate('2026-04-06'), // Monday
        localTime: parseLocalTime('10:00:00'),
        timeZone: parseIanaTimeZone('America/New_York'),
        durationMinutes: 45,
        privacy: 'public',
        attendeeEmails: ['engineer@company.com'],
        recurrence: {
          frequency: 'weekly',
          interval: 1,
          weekdays: [1], // Monday
          end: { type: 'count', count: 6 },
        },
      },
    });

    // Occurrence and series are distinct
    assert.ok(result.series, 'Series must be created');
    assert.ok(result.view.meeting.seriesId, 'Occurrence must point to seriesId');
    assert.equal(result.view.meeting.occurrenceKey, '2026-04-06T10:00:00');
    assert.equal(result.series.id, result.view.meeting.seriesId);
    assert.ok(result.series.seriesId.startsWith('series_'));
    assert.equal(result.series.recurrenceRule.includes('FREQ=WEEKLY'), true);

    // Capabilities check for host
    assert.equal(result.view.capabilities.update.allowed, true);
    assert.equal(result.view.capabilities.cancel.allowed, true);

    // Outbox event was committed transactionally
    const unpublished = await outboxRepo.fetchUnpublished(10);
    assert.equal(unpublished.length, 2); // series created + occurrence created
    const eventTypes = unpublished.map((e) => e.eventType);
    assert.ok(eventTypes.includes('meeting.series.created.v1'));
    assert.ok(eventTypes.includes('meeting.occurrence.created.v1'));
  });

  it('invariant: non-host attendee view correctly restricts capabilities', async () => {
    const meetingRepo = new FakeMeetingRepository();
    const outboxRepo = new FakeOutboxRepository();
    const recurrenceEngine = new RRuleRecurrenceEngine();

    const app = new MeetingApplication({
      meetingRepository: meetingRepo,
      outboxRepository: outboxRepo,
      recurrenceEngine,
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    });

    const { view } = await app.create({
      principal: { userId: hostUserId, orgId },
      command: {
        idempotencyKey: 'idem_key_nonhost',
        title: 'One-on-One Sync',
        localDate: parseLocalDate('2026-04-10'),
        localTime: parseLocalTime('15:00:00'),
        timeZone: parseIanaTimeZone('UTC'),
        durationMinutes: 30,
        privacy: 'public',
      },
    });

    // Evaluating capabilities for an attendee (non-host)
    const attendeeView = await app.getView({
      meetingId: view.meeting.meetingId,
      principal: { userId: attendeeUserId, orgId },
      viewerTimeZone: 'Europe/London',
    });

    assert.equal(attendeeView.capabilities.update.allowed, false);
    assert.equal(attendeeView.capabilities.update.reason, 'NOT_ORGANIZER');
    assert.equal(attendeeView.capabilities.cancel.allowed, false);
    assert.equal(attendeeView.capabilities.cancel.reason, 'NOT_ORGANIZER');
  });

  it('invariant: duplicate creation with identical idempotencyKey returns existing without duplication', async () => {
    const meetingRepo = new FakeMeetingRepository();
    const outboxRepo = new FakeOutboxRepository();
    const recurrenceEngine = new RRuleRecurrenceEngine();

    const app = new MeetingApplication({
      meetingRepository: meetingRepo,
      outboxRepository: outboxRepo,
      recurrenceEngine,
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    });

    const cmd = {
      idempotencyKey: 'idem_key_dup_test',
      title: 'Sprint Retrospective',
      localDate: parseLocalDate('2026-05-01'),
      localTime: parseLocalTime('16:00:00'),
      timeZone: parseIanaTimeZone('UTC'),
      durationMinutes: 60,
      privacy: 'public' as const,
    };

    const firstResult = await app.create({
      principal: { userId: hostUserId, orgId },
      command: cmd,
    });

    const secondResult = await app.create({
      principal: { userId: hostUserId, orgId },
      command: cmd,
    });

    assert.equal(firstResult.view.meeting.meetingId, secondResult.view.meeting.meetingId);

    // Only one set of outbox events was generated
    const events = await outboxRepo.fetchUnpublished(10);
    assert.equal(events.length, 1);
  });

  it('invariant: rejects nonexistent spring-forward time fail-closed with suggested resolution', async () => {
    const meetingRepo = new FakeMeetingRepository();
    const outboxRepo = new FakeOutboxRepository();
    const recurrenceEngine = new RRuleRecurrenceEngine();

    const app = new MeetingApplication({
      meetingRepository: meetingRepo,
      outboxRepository: outboxRepo,
      recurrenceEngine,
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    });

    await assert.rejects(
      async () => {
        await app.create({
          principal: { userId: hostUserId, orgId },
          command: {
            idempotencyKey: 'idem_key_dst_gap',
            title: 'DST Gap Meeting',
            localDate: parseLocalDate('2026-03-08'),
            localTime: parseLocalTime('02:30:00'), // Nonexistent in America/New_York
            timeZone: parseIanaTimeZone('America/New_York'),
            durationMinutes: 30,
            privacy: 'public',
          },
        });
      },
      (err: any) => {
        assert.equal(err.code, 'INVALID_LOCAL_TIME');
        assert.ok(err.message.includes('Daylight Saving Time') || err.message.includes('does not exist'));
        return true;
      }
    );
  });

  it('invariant: rejects a valid zoned wall-clock time that is already in the past', async () => {
    const app = new MeetingApplication({
      meetingRepository: new FakeMeetingRepository(),
      outboxRepository: new FakeOutboxRepository(),
      recurrenceEngine: new RRuleRecurrenceEngine(),
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    });

    await assert.rejects(
      app.create({
        principal: { userId: hostUserId, orgId },
        command: {
          idempotencyKey: 'idem_past_time',
          title: 'Past meeting',
          localDate: parseLocalDate('2025-12-31'),
          localTime: parseLocalTime('23:00:00'),
          timeZone: parseIanaTimeZone('UTC'),
          durationMinutes: 30,
          privacy: 'private',
        },
      }),
      (error: unknown) => error instanceof Error && 'code' in error && error.code === 'MEETING_TIME_IN_PAST'
    );
  });

  describe('Adversarial & Edge Cases', () => {
    it('adversarial: rejects request missing idempotency key', async () => {
      const meetingRepo = new FakeMeetingRepository();
      const outboxRepo = new FakeOutboxRepository();
      const recurrenceEngine = new RRuleRecurrenceEngine();

      const app = new MeetingApplication({
        meetingRepository: meetingRepo,
        outboxRepository: outboxRepo,
        recurrenceEngine,
      });

      await assert.rejects(
        async () => {
          await app.create({
            principal: { userId: hostUserId, orgId },
            command: {
              idempotencyKey: '',
              title: 'No Idempotency Key',
              localDate: parseLocalDate('2026-06-01'),
              localTime: parseLocalTime('10:00:00'),
              timeZone: parseIanaTimeZone('UTC'),
              durationMinutes: 30,
              privacy: 'public',
            },
          });
        },
        (err: any) => {
          assert.equal(err.code, 'MISSING_IDEMPOTENCY_KEY');
          return true;
        }
      );
    });

    it('adversarial: rejects ambiguous fall-back local time without explicit disambiguation', async () => {
      const meetingRepo = new FakeMeetingRepository();
      const outboxRepo = new FakeOutboxRepository();
      const recurrenceEngine = new RRuleRecurrenceEngine();

      const app = new MeetingApplication({
        meetingRepository: meetingRepo,
        outboxRepository: outboxRepo,
        recurrenceEngine,
      });

      await assert.rejects(
        async () => {
          await app.create({
            principal: { userId: hostUserId, orgId },
            command: {
              idempotencyKey: 'idem_ambiguous_no_choice',
              title: 'Fall Back Meeting',
              localDate: parseLocalDate('2026-11-01'),
              localTime: parseLocalTime('01:30:00'), // Ambiguous in America/New_York
              timeZone: parseIanaTimeZone('America/New_York'),
              durationMinutes: 30,
              privacy: 'public',
              // No disambiguation provided
            },
          });
        },
        (err: any) => {
          assert.equal(err.code, 'AMBIGUOUS_LOCAL_TIME');
          return true;
        }
      );
    });
  });
});
