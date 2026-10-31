import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getMeetingInviteEmailTemplate } from './meeting-invite-email.js';

describe('meeting invite timezone rendering', () => {
  it('renders the event wall-clock zone and an explicit UTC reference', () => {
    const rendered = getMeetingInviteEmailTemplate({
      meeting: {
        title: 'Cross-zone planning',
        scheduledTime: '2026-07-10T14:00:00.000Z',
        duration: 45,
        createdBy: 'host@example.com',
        eventTimeZone: 'America/New_York',
      },
      joinUrl: 'https://meetlite.example/meeting/meet_123/join',
    });

    assert.match(rendered.html, /10:00 AM EDT \(America\/New_York\)/);
    assert.match(rendered.html, /Jul 10, 2026, 2:00 PM UTC/);
    assert.doesNotMatch(rendered.html, /10:00 AM EDT \(UTC\)/);
  });
});
