import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IcsGenerator } from './ics-generator.js';
import { OutboxPublisher, EventDispatcher } from './outbox-publisher.js';
import { FakeOutboxRepository } from '../repositories/fake-outbox.repository.js';
import { OutboxEventRecord } from '../repositories/meeting-repository.types.js';

describe('MLTR-07: Transactional Invitations, Calendar, and Outbox Delivery', () => {
  it('invariant: IcsGenerator produces valid RFC 5545 iCalendar with timezone and join link', () => {
    const scheduledAt = new Date('2026-07-10T14:00:00.000Z');

    const ics = IcsGenerator.generate({
      method: 'REQUEST',
      uid: 'series_team_sync_001',
      sequence: 1,
      title: 'Weekly Sprint Kickoff',
      description: 'Discuss sprint goals and blockers.',
      scheduledAt,
      durationMinutes: 45,
      timeZone: 'America/New_York',
      recurrenceRule: 'RRULE:FREQ=WEEKLY;INTERVAL=1',
      organizer: {
        name: 'Sarah Connor',
        email: 'sarah@meetlite.io',
      },
      attendees: ['dev1@meetlite.io', 'dev2@meetlite.io'],
      joinUrl: 'https://meetlite.io/meeting/meet_abc123/join',
    });

    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
    assert.ok(ics.includes('METHOD:REQUEST\r\n'));
    assert.ok(ics.includes('UID:series_team_sync_001\r\n'));
    assert.ok(ics.includes('SEQUENCE:1\r\n'));
    assert.ok(ics.includes('DTSTART;TZID=America/New_York:20260710T100000\r\n'));
    assert.ok(ics.includes('DTEND;TZID=America/New_York:20260710T104500\r\n'));
    assert.ok(ics.includes('RRULE:FREQ=WEEKLY;INTERVAL=1\r\n'));
    assert.ok(ics.includes('SUMMARY:Weekly Sprint Kickoff\r\n'));
    assert.ok(ics.includes('URL:https://meetlite.io/meeting/meet_abc123/join\r\n'));
    assert.ok(ics.includes('ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:dev1@meetlite.io\r\n'));
    assert.ok(ics.includes('STATUS:CONFIRMED\r\n'));
    assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  });

  it('invariant: occurrence cancellation produces METHOD:CANCEL with RECURRENCE-ID', () => {
    const scheduledAt = new Date('2026-07-17T14:00:00.000Z');

    const ics = IcsGenerator.generate({
      method: 'CANCEL',
      uid: 'series_team_sync_001',
      sequence: 2,
      title: 'Weekly Sprint Kickoff',
      scheduledAt,
      durationMinutes: 45,
      timeZone: 'America/New_York',
      recurrenceId: '2026-07-17T10:00:00',
      organizer: {
        email: 'sarah@meetlite.io',
      },
      joinUrl: 'https://meetlite.io/meeting/meet_occ_cancelled/join',
    });

    assert.ok(ics.includes('METHOD:CANCEL\r\n'));
    assert.ok(ics.includes('STATUS:CANCELLED\r\n'));
    assert.ok(ics.includes('RECURRENCE-ID;TZID=America/New_York:20260717T100000\r\n'));
    assert.ok(ics.includes('SEQUENCE:2\r\n'));
  });

  it('invariant: OutboxPublisher claims unpublished events and marks them published on success', async () => {
    const outboxRepo = new FakeOutboxRepository();
    const dispatchedEvents: OutboxEventRecord[] = [];

    const mockDispatcher: EventDispatcher = {
      async dispatch(event) {
        dispatchedEvents.push(event);
      },
    };

    // Append 3 outbox events
    for (let i = 1; i <= 3; i++) {
      await outboxRepo.append({
        eventId: `evt_mltr07_test_${i}`,
        aggregateType: 'meeting-occurrence',
        aggregateId: `meet_test_${i}`,
        eventType: 'meeting.occurrence.created.v1',
        schemaVersion: 1,
        payload: { index: i },
      });
    }

    const publisher = new OutboxPublisher(outboxRepo, mockDispatcher);
    const result = await publisher.publishBatch(10);

    assert.equal(result.processed, 3);
    assert.equal(result.published, 3);
    assert.equal(result.failed, 0);
    assert.equal(dispatchedEvents.length, 3);

    // After publishing, fetchUnpublished returns empty
    const remaining = await outboxRepo.fetchUnpublished(10);
    assert.equal(remaining.length, 0);
  });

  it('adversarial: OutboxPublisher records attempts on dispatcher failure without crashing batch', async () => {
    const outboxRepo = new FakeOutboxRepository();

    await outboxRepo.append({
      eventId: 'evt_fail_1',
      aggregateType: 'meeting-occurrence',
      aggregateId: 'meet_fail',
      eventType: 'meeting.occurrence.created.v1',
      schemaVersion: 1,
      payload: {},
    });

    const failingDispatcher: EventDispatcher = {
      async dispatch() {
        const err: any = new Error('SMTP connection timed out');
        err.code = 'SMTP_TIMEOUT';
        throw err;
      },
    };

    const publisher = new OutboxPublisher(outboxRepo, failingDispatcher);
    const result = await publisher.publishBatch(10);

    assert.equal(result.processed, 1);
    assert.equal(result.published, 0);
    assert.equal(result.failed, 1);

    // Event remains unpublished with recorded attempt
    const pending = await outboxRepo.fetchUnpublished(10);
    assert.equal(pending.length, 1);
    assert.equal(pending[0].attempts, 1);
    assert.equal(pending[0].lastErrorCode, 'SMTP_TIMEOUT');
  });
});
