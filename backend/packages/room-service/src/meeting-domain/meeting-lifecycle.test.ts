import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MeetingPolicy } from './meeting-policy.js';
import { MeetingOccurrenceRecord } from './repositories/meeting-repository.types.js';

describe('MLTR-06: Server-Owned Lifecycle and Capabilities', () => {
  const hostId = '11111111-1111-1111-1111-111111111111';
  const attendeeId = '22222222-2222-2222-2222-222222222222';
  const orgId = '33333333-3333-3333-3333-333333333333';

  const hostPrincipal = {
    userId: hostId,
    email: 'host@meetlite.io',
    orgId,
  };

  const attendeePrincipal = {
    userId: attendeeId,
    email: 'attendee@meetlite.io',
    orgId,
  };

  const baseScheduledMeeting: MeetingOccurrenceRecord = {
    id: 'db_meet_001',
    meetingId: 'meet_scheduled_001',
    organizationId: orgId,
    teamId: null,
    createdBy: hostId,
    title: 'Design Review',
    description: null,
    privacy: 'public',
    seriesId: null,
    occurrenceKey: null,
    scheduledAt: new Date('2026-06-15T15:00:00.000Z'),
    eventTimeZone: 'America/New_York',
    durationMinutes: 60,
    status: 'scheduled',
    lifecycleRevision: 1,
    roomId: null,
    createdAt: new Date(),
  };

  it('invariant: host has start and join capabilities, non-host gets WAITING_FOR_HOST when scheduled', () => {
    const now = new Date('2026-06-15T14:55:00.000Z'); // 5 minutes before scheduled start (inside early window)

    const hostCaps = MeetingPolicy.evaluateCapabilities({
      meeting: baseScheduledMeeting,
      principal: hostPrincipal,
      now,
    });

    assert.equal(hostCaps.start.allowed, true);
    assert.equal(hostCaps.start.reason, 'ALLOWED');
    assert.equal(hostCaps.join.allowed, true);
    assert.equal(hostCaps.endForAll.allowed, false); // Not live yet

    const attendeeCaps = MeetingPolicy.evaluateCapabilities({
      meeting: baseScheduledMeeting,
      principal: attendeePrincipal,
      now,
    });

    assert.equal(attendeeCaps.start.allowed, false);
    assert.equal(attendeeCaps.start.reason, 'NOT_ORGANIZER');
    assert.equal(attendeeCaps.join.allowed, false);
    assert.equal(attendeeCaps.join.reason, 'WAITING_FOR_HOST');
    assert.equal(attendeeCaps.endForAll.allowed, false);
  });

  it('invariant: non-host gets TOO_EARLY when prior to early window', () => {
    const wayTooEarly = new Date('2026-06-15T14:00:00.000Z'); // 1 hour early (early window is 15 mins)

    const attendeeCaps = MeetingPolicy.evaluateCapabilities({
      meeting: baseScheduledMeeting,
      principal: attendeePrincipal,
      now: wayTooEarly,
    });

    assert.equal(attendeeCaps.join.allowed, false);
    assert.equal(attendeeCaps.join.reason, 'TOO_EARLY');
    assert.ok(attendeeCaps.join.availableAt);
  });

  it('invariant: live meeting allows join and leave for all, but endForAll ONLY for host', () => {
    const liveMeeting: MeetingOccurrenceRecord = {
      ...baseScheduledMeeting,
      status: 'ongoing',
      roomId: 'room_active_999',
    };

    const hostCaps = MeetingPolicy.evaluateCapabilities({
      meeting: liveMeeting,
      principal: hostPrincipal,
    });

    assert.equal(hostCaps.start.allowed, true); // Rejoin
    assert.equal(hostCaps.join.allowed, true);
    assert.equal(hostCaps.leave.allowed, true);
    assert.equal(hostCaps.endForAll.allowed, true); // Host can end for everyone

    const attendeeCaps = MeetingPolicy.evaluateCapabilities({
      meeting: liveMeeting,
      principal: attendeePrincipal,
    });

    assert.equal(attendeeCaps.start.allowed, false);
    assert.equal(attendeeCaps.join.allowed, true);
    assert.equal(attendeeCaps.leave.allowed, true);
    assert.equal(attendeeCaps.endForAll.allowed, false); // Attendee cannot end for all
  });

  it('security invariant: a live private meeting remains closed to an uninvited viewer', () => {
    const capabilities = MeetingPolicy.evaluateCapabilities({
      meeting: {
        ...baseScheduledMeeting,
        privacy: 'private',
        status: 'ongoing',
        roomId: 'room_private_001',
      },
      principal: attendeePrincipal,
      isParticipant: false,
      isInvited: false,
    });

    assert.equal(capabilities.join.allowed, false);
    assert.equal(capabilities.join.reason, 'NOT_INVITED');
  });

  it('invariant: ended or cancelled meetings forbid start and join unconditionally', () => {
    const endedMeeting: MeetingOccurrenceRecord = {
      ...baseScheduledMeeting,
      status: 'completed',
    };

    const cancelledMeeting: MeetingOccurrenceRecord = {
      ...baseScheduledMeeting,
      status: 'cancelled',
    };

    for (const meeting of [endedMeeting, cancelledMeeting]) {
      const hostCaps = MeetingPolicy.evaluateCapabilities({
        meeting,
        principal: hostPrincipal,
      });

      assert.equal(hostCaps.start.allowed, false);
      assert.equal(hostCaps.join.allowed, false);
      assert.equal(hostCaps.update.allowed, false);
      assert.equal(hostCaps.cancel.allowed, false);

      const attendeeCaps = MeetingPolicy.evaluateCapabilities({
        meeting,
        principal: attendeePrincipal,
      });

      assert.equal(attendeeCaps.start.allowed, false);
      assert.equal(attendeeCaps.join.allowed, false);
    }
  });

  it('invariant: MeetingView maps viewer-local and event-local timezones with full capabilities', () => {
    const view = MeetingPolicy.buildMeetingView({
      meeting: baseScheduledMeeting,
      principal: attendeePrincipal,
      viewerTimeZone: 'Europe/London',
    });

    assert.equal(view.meeting.meetingId, baseScheduledMeeting.meetingId);
    assert.equal(view.eventLocal.timeZone, 'America/New_York');
    assert.equal(view.viewerLocal.timeZone, 'Europe/London');
    assert.ok(view.capabilities);
    assert.equal(view.capabilities.start.allowed, false);
  });
});
