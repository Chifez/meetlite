import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  primaryMeetingAction,
  extractMeetingParticipants,
  getInitials,
  formatMeetingTime,
  formatMeetingDate,
} from './meeting-view-state';
import type { Meeting, MeetingCapabilities } from '@/lib/types';

describe('MLTR-08: Client Meeting View-State & Action Mapping', () => {
  const baseCapabilities: MeetingCapabilities = {
    start: { allowed: false, reason: 'NOT_ORGANIZER' },
    join: { allowed: false, reason: 'TOO_EARLY', availableAt: new Date(Date.now() + 3600000).toISOString() },
    leave: { allowed: false, reason: 'ROOM_NOT_READY' },
    endForAll: { allowed: false, reason: 'ROOM_NOT_READY' },
    update: { allowed: true },
    cancel: { allowed: true },
  };

  it('invariant: host with start capability receives "Start" action', () => {
    const meeting: Meeting = {
      meetingId: 'm-1',
      title: 'Sprint Planning',
      scheduledTime: new Date(Date.now() + 300000).toISOString(),
      duration: 30,
      createdBy: 'user-host',
      participants: ['user-host'],
      status: 'scheduled',
      capabilities: {
        ...baseCapabilities,
        start: { allowed: true, reason: 'ALLOWED' },
      },
    };

    const action = primaryMeetingAction(meeting, { currentUserId: 'user-host' });
    assert.equal(action.kind, 'start');
    assert.equal(action.label, 'Start');
  });

  it('invariant: non-host attendee gets "Waiting for host" when meeting is in early window but host has not started', () => {
    const meeting: Meeting = {
      meetingId: 'm-2',
      title: 'Design Review',
      scheduledTime: new Date(Date.now() + 300000).toISOString(),
      duration: 45,
      createdBy: 'user-host',
      participants: ['user-host', 'user-guest'],
      status: 'scheduled',
      capabilities: {
        ...baseCapabilities,
        start: { allowed: false, reason: 'NOT_ORGANIZER' },
        join: { allowed: false, reason: 'WAITING_FOR_HOST' },
      },
    };

    const action = primaryMeetingAction(meeting, { currentUserId: 'user-guest' });
    assert.equal(action.kind, 'disabled');
    assert.equal(action.label, 'Waiting for host');
    assert.equal(action.reason, 'WAITING_FOR_HOST');
  });

  it('invariant: live meeting allows "Join" for allowed participants', () => {
    const meeting: Meeting = {
      meetingId: 'm-3',
      title: 'All Hands',
      scheduledTime: new Date(Date.now() - 300000).toISOString(),
      duration: 60,
      createdBy: 'user-host',
      participants: ['user-host', 'user-guest'],
      roomId: 'room-active',
      status: 'ongoing',
      capabilities: {
        ...baseCapabilities,
        join: { allowed: true, reason: 'ALLOWED' },
      },
    };

    const action = primaryMeetingAction(meeting, { currentUserId: 'user-guest' });
    assert.equal(action.kind, 'join');
    assert.equal(action.label, 'Join');
  });

  it('invariant: scheduled meeting prior to start window defaults to "Details", NEVER starting meeting', () => {
    const meeting: Meeting = {
      meetingId: 'm-4',
      title: 'Quarterly Review',
      scheduledTime: new Date(Date.now() + 86400000).toISOString(),
      duration: 60,
      createdBy: 'user-host',
      participants: ['user-host'],
      status: 'scheduled',
      capabilities: {
        ...baseCapabilities,
        start: { allowed: false, reason: 'TOO_EARLY', availableAt: new Date(Date.now() + 85500000).toISOString() },
        join: { allowed: false, reason: 'TOO_EARLY', availableAt: new Date(Date.now() + 85500000).toISOString() },
      },
    };

    const action = primaryMeetingAction(meeting, { currentUserId: 'user-host' });
    assert.equal(action.kind, 'details');
    assert.match(action.label, /Details|Available/);
  });

  it('invariant: ended or completed meeting returns "View recap"', () => {
    const meeting: Meeting = {
      meetingId: 'm-5',
      title: 'Retrospective',
      scheduledTime: new Date(Date.now() - 7200000).toISOString(),
      duration: 45,
      createdBy: 'user-host',
      participants: ['user-host'],
      status: 'completed',
    };

    const action = primaryMeetingAction(meeting, { currentUserId: 'user-host' });
    assert.equal(action.kind, 'recap');
    assert.equal(action.label, 'View recap');
  });

  it('invariant: cancelled meeting returns "none"', () => {
    const meeting: Meeting = {
      meetingId: 'm-6',
      title: 'Cancelled Sync',
      scheduledTime: new Date(Date.now() + 3600000).toISOString(),
      duration: 30,
      createdBy: 'user-host',
      participants: ['user-host'],
      status: 'cancelled',
    };

    const action = primaryMeetingAction(meeting, { currentUserId: 'user-host' });
    assert.equal(action.kind, 'none');
    assert.equal(action.label, 'Cancelled');
  });

  it('aggregates and deduplicates invites and direct participants for avatars', () => {
    const meeting: Meeting = {
      meetingId: 'm-7',
      title: 'Team Sync',
      scheduledTime: new Date().toISOString(),
      duration: 30,
      createdBy: 'alice@example.com',
      participants: [
        'alice@example.com',
        { email: 'bob@example.com', user: { name: 'Bob Smith' } } as any,
      ],
      invites: [
        { email: 'bob@example.com', status: 'pending', inviteToken: 'tok-1' },
        { email: 'charlie.brown@example.com', status: 'accepted', inviteToken: 'tok-2' },
      ],
    };

    const participants = extractMeetingParticipants(meeting);
    assert.deepEqual(participants, ['bob@example.com', 'charlie.brown@example.com', 'alice@example.com']);

    const initials = participants.map(getInitials);
    assert.deepEqual(initials, ['BO', 'CB', 'AL']);
  });

  it('formats meeting date and time consistently', () => {
    const fixedIso = '2026-10-28T14:30:00.000Z';
    const timeStr = formatMeetingTime(fixedIso);
    assert.equal(typeof timeStr, 'string');
    assert.match(timeStr, /^\d{2}:\d{2}$/);

    const dateStr = formatMeetingDate(fixedIso);
    assert.equal(typeof dateStr, 'string');
    assert.ok(dateStr.length > 0);
  });
});
