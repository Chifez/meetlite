/**
 * MLTR-07: RFC 5545 iCalendar (ICS) Generator
 * Invariant: Every committed meeting change has a durable, idempotent delivery intent.
 * Emits standard METHOD:REQUEST or METHOD:CANCEL with stable UID, SEQUENCE, and RECURRENCE-ID.
 */

import { DateTime } from 'luxon';

export interface GenerateIcsParams {
  method: 'REQUEST' | 'CANCEL';
  uid: string;
  sequence: number;
  title: string;
  description?: string | null;
  scheduledAt: Date;
  durationMinutes: number;
  timeZone: string;
  recurrenceRule?: string | null;
  recurrenceId?: string | null;
  organizer: {
    name?: string;
    email: string;
  };
  attendees?: readonly string[];
  joinUrl: string;
}

export class IcsGenerator {
  /**
   * Generates a standard RFC 5545 iCalendar payload.
   */
  static generate(params: GenerateIcsParams): string {
    const {
      method,
      uid,
      sequence,
      title,
      description,
      scheduledAt,
      durationMinutes,
      timeZone,
      recurrenceRule,
      recurrenceId,
      organizer,
      attendees = [],
      joinUrl,
    } = params;

    const dtstamp = this.formatIcalUtc(new Date());
    const dtstart = this.formatZonedIcal(scheduledAt, timeZone);
    const dtendInstant = new Date(scheduledAt.getTime() + durationMinutes * 60000);
    const dtend = this.formatZonedIcal(dtendInstant, timeZone);

    const descWithJoin = [
      description || '',
      `\nJoin Meeting: ${joinUrl}`,
    ].filter(Boolean).join('\n');

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MeetLite//MeetLite Scheduling//EN',
      `METHOD:${method}`,
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `SEQUENCE:${sequence}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=${timeZone}:${dtstart}`,
      `DTEND;TZID=${timeZone}:${dtend}`,
      `SUMMARY:${this.escapeText(title)}`,
      `DESCRIPTION:${this.escapeText(descWithJoin)}`,
      `URL:${joinUrl}`,
      `ORGANIZER;CN=${this.escapeText(organizer.name || organizer.email)}:mailto:${organizer.email}`,
      `STATUS:${method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
    ];

    if (recurrenceRule) {
      // Ensure recurrence rule begins with RRULE:
      const formattedRule = recurrenceRule.startsWith('RRULE:')
        ? recurrenceRule
        : `RRULE:${recurrenceRule}`;
      lines.push(formattedRule);
    }

    if (recurrenceId) {
      // RecurrenceId format: YYYYMMDDTHHmmss
      const cleanedKey = recurrenceId.replace(/[-:]/g, '');
      lines.push(`RECURRENCE-ID;TZID=${timeZone}:${cleanedKey}`);
    }

    for (const email of attendees) {
      lines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${email}`);
    }

    lines.push('END:VEVENT');
    lines.push('END:VCALENDAR');

    return lines.join('\r\n') + '\r\n';
  }

  private static formatIcalUtc(d: Date): string {
    return DateTime.fromJSDate(d, { zone: 'utc' }).toFormat("yyyyLLdd'T'HHmmss'Z'");
  }

  private static formatZonedIcal(d: Date, zone: string): string {
    return DateTime.fromJSDate(d, { zone }).toFormat("yyyyLLdd'T'HHmmss");
  }

  private static escapeText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '');
  }
}
