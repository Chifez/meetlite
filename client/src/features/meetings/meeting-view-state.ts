import { format, isToday, isTomorrow, isThisWeek, differenceInMinutes } from 'date-fns';
import type { Meeting, MeetingCapabilities, ActionCapability } from '@/lib/types';

export type PrimaryActionKind = 'start' | 'join' | 'details' | 'disabled' | 'recap' | 'none';

export interface PrimaryAction {
  kind: PrimaryActionKind;
  label: string;
  reason?: string;
  availableAt?: string;
}

export interface MeetingView {
  meeting: Meeting;
  viewerLocal: { startsAt: string; timeZone: string };
  eventLocal: { startsAt: string; timeZone: string };
  capabilities: MeetingCapabilities;
}

export type ScheduleItemView =
  | { source: 'meetlite'; meeting: MeetingView }
  | {
      source: 'external-calendar';
      provider: 'google';
      externalEventId: string;
      startsAt: string;
      endsAt: string;
      joinUrl?: string;
      capabilities: { openExternal: boolean; joinExternal: boolean; deleteExternal: boolean };
    };

// Consistent soft pastel palette for attendee avatar chips
export const AVATAR_COLORS = [
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
  'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
  'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
];

/**
 * Extracts all unique participant names or emails from invites and participants.
 * Handles both plain strings and nested relation objects.
 */
export function extractMeetingParticipants(meeting: Meeting): string[] {
  const identifiers: string[] = [];

  const addUnique = (item: string | null | undefined) => {
    if (!item) return;
    const clean = item.trim();
    if (clean && !identifiers.includes(clean)) {
      identifiers.push(clean);
    }
  };

  // 1. Invites
  if (meeting.invites && Array.isArray(meeting.invites)) {
    meeting.invites.forEach((inv: any) => {
      const email = typeof inv === 'string' ? inv : inv.email;
      addUnique(email);
    });
  }

  // 2. Direct participants
  if (meeting.participants && Array.isArray(meeting.participants)) {
    meeting.participants.forEach((p: any) => {
      const id =
        typeof p === 'string'
          ? p
          : p.email || p.user?.email || p.user?.name || p.name;
      addUnique(id);
    });
  }

  return identifiers;
}

/**
 * Derives readable initials (1-2 uppercase letters) from an email or display name.
 */
export function getInitials(nameOrEmail: string | any): string {
  if (!nameOrEmail) return 'U';
  if (typeof nameOrEmail !== 'string') {
    if (nameOrEmail.name) return getInitials(nameOrEmail.name);
    if (nameOrEmail.email) return getInitials(nameOrEmail.email);
    return 'U';
  }
  const clean = nameOrEmail.trim();
  if (clean.includes('@')) {
    const username = clean.split('@')[0];
    const parts = username.split(/[._-]/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return username.slice(0, 2).toUpperCase();
  }
  const parts = clean.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

/**
 * Format meeting time as HH:mm or h:mm a
 */
export function formatMeetingTime(dateOrIso: string | Date): string {
  const d = new Date(dateOrIso);
  if (isNaN(d.getTime())) return '--:--';
  return format(d, 'HH:mm');
}

/**
 * Format meeting date as 'Today', 'Tomorrow', or 'EEE, MMM d'
 */
export function formatMeetingDate(dateOrIso: string | Date): string {
  const d = new Date(dateOrIso);
  if (isNaN(d.getTime())) return '';
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'EEE, MMM d');
}

/**
 * Formats relative duration or availability
 */
function formatRelativeAvailable(isoDate: string): string {
  const d = new Date(isoDate);
  const diff = differenceInMinutes(d, new Date());
  if (diff <= 0) return 'now';
  if (diff < 60) return `in ${diff}m`;
  const hours = Math.round(diff / 60);
  return `in ${hours}h`;
}

/**
 * Pure primary action mapper specified by implementation plan Section 6.8.
 * Authoritative: Uses server capabilities when available.
 */
export function primaryMeetingAction(
  meeting: Meeting,
  options?: { currentUserId?: string }
): PrimaryAction {
  const caps = meeting.capabilities;
  const status = (meeting.status || '').toLowerCase();
  const isCancelled = status === 'cancelled';
  const isEnded = status === 'completed' || status === 'ended';

  if (isCancelled) {
    return { kind: 'none', label: 'Cancelled' };
  }
  if (isEnded) {
    return { kind: 'recap', label: 'View recap' };
  }

  // 1. Authoritative path: server returned capabilities
  if (caps) {
    if (caps.start.allowed) {
      return { kind: 'start', label: 'Start' };
    }
    if (caps.join.allowed) {
      return { kind: 'join', label: 'Join' };
    }
    if (caps.join.reason === 'WAITING_FOR_HOST') {
      return { kind: 'disabled', label: 'Waiting for host', reason: 'WAITING_FOR_HOST' };
    }
    return {
      kind: 'details',
      label: caps.join.availableAt
        ? `Available ${formatRelativeAvailable(caps.join.availableAt)}`
        : 'Details',
      availableAt: caps.join.availableAt,
      reason: caps.join.reason,
    };
  }

  // 2. Fallback path when capabilities are not attached (e.g. external calendar)
  const isHost = Boolean(options?.currentUserId && meeting.createdBy === options.currentUserId);
  const scheduledDate = new Date(meeting.scheduledTime);
  const isValidDate = !isNaN(scheduledDate.getTime());
  const now = new Date();
  const minutesUntil = isValidDate ? differenceInMinutes(scheduledDate, now) : 999;
  const isRoomLive = status === 'ongoing' || Boolean(meeting.roomId && status !== 'completed');

  if (isRoomLive) {
    return { kind: 'join', label: 'Join' };
  }

  if (isHost) {
    // Host can start meeting within 15m or when ready
    if (minutesUntil <= 15) {
      return { kind: 'start', label: 'Start' };
    }
    return { kind: 'details', label: 'Details' };
  }

  // Attendee: if room not yet started
  if (minutesUntil <= 15 && minutesUntil >= 0) {
    return { kind: 'disabled', label: 'Waiting for host', reason: 'WAITING_FOR_HOST' };
  }

  return { kind: 'details', label: 'Details' };
}
