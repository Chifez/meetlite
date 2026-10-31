/**
 * MLTR-03: Server-Owned Meeting Capabilities and Policy
 * Invariant: Start, join, leave, end-for-all capabilities are server-owned, not inferred from client clocks.
 */

import { DateTime } from 'luxon';
import {
  MeetingOccurrenceRecord,
  MeetingSeriesRecord,
} from './repositories/meeting-repository.types.js';

export type CapabilityReason =
  | 'ALLOWED'
  | 'TOO_EARLY'
  | 'WAITING_FOR_HOST'
  | 'NOT_ORGANIZER'
  | 'NOT_INVITED'
  | 'ENDED'
  | 'CANCELLED'
  | 'ROOM_NOT_READY';

export interface ActionCapability {
  allowed: boolean;
  reason: CapabilityReason;
  availableAt?: string;
}

export interface MeetingCapabilities {
  start: ActionCapability;
  join: ActionCapability;
  leave: ActionCapability;
  endForAll: ActionCapability;
  update: ActionCapability;
  cancel: ActionCapability;
}

export interface MeetingView {
  meeting: MeetingOccurrenceRecord;
  viewerLocal: { startsAt: string; timeZone: string };
  eventLocal: { startsAt: string; timeZone: string };
  capabilities: MeetingCapabilities;
}

export interface PolicyPrincipal {
  userId: string;
  email?: string;
  orgId?: string | null;
  organizationId?: string | null;
  role?: string;
}

export class MeetingPolicy {
  /**
   * Evaluates all capabilities for a principal against a meeting occurrence.
   */
  static evaluateCapabilities(params: {
    meeting: MeetingOccurrenceRecord;
    series?: MeetingSeriesRecord | null;
    principal: PolicyPrincipal;
    now?: Date;
    isParticipant?: boolean;
    isInvited?: boolean;
  }): MeetingCapabilities {
    const { meeting, principal, now = new Date() } = params;
    const isHost = principal.userId === meeting.createdBy;
    const mayAttend =
      isHost || meeting.privacy === 'public' || params.isParticipant === true || params.isInvited === true;
    const isStatusEnded = meeting.status === 'ended' || meeting.status === 'completed';
    const isStatusCancelled = meeting.status === 'cancelled';
    const isStatusLive = meeting.status === 'live' || meeting.status === 'ongoing' || Boolean(meeting.roomId);

    // 1. UPDATE capability
    const update: ActionCapability = !isHost
      ? { allowed: false, reason: 'NOT_ORGANIZER' }
      : isStatusCancelled
      ? { allowed: false, reason: 'CANCELLED' }
      : isStatusEnded
      ? { allowed: false, reason: 'ENDED' }
      : { allowed: true, reason: 'ALLOWED' };

    // 2. CANCEL capability
    const cancel: ActionCapability = !isHost
      ? { allowed: false, reason: 'NOT_ORGANIZER' }
      : isStatusCancelled
      ? { allowed: false, reason: 'CANCELLED' }
      : isStatusEnded
      ? { allowed: false, reason: 'ENDED' }
      : { allowed: true, reason: 'ALLOWED' };

    // 3. START capability (Only host can start a meeting)
    const start: ActionCapability = isStatusCancelled
      ? { allowed: false, reason: 'CANCELLED' }
      : isStatusEnded
      ? { allowed: false, reason: 'ENDED' }
      : !isHost
      ? { allowed: false, reason: 'NOT_ORGANIZER' }
      : isStatusLive
      ? { allowed: true, reason: 'ALLOWED' } // Host can rejoin existing live room
      : { allowed: true, reason: 'ALLOWED', availableAt: meeting.scheduledAt.toISOString() };

    // 4. JOIN capability
    let join: ActionCapability;
    const earlyWindowMs = 15 * 60 * 1000; // 15 minutes early window
    const availableAtInstant = new Date(meeting.scheduledAt.getTime() - earlyWindowMs);

    if (!mayAttend) {
      join = { allowed: false, reason: 'NOT_INVITED' };
    } else if (isStatusCancelled) {
      join = { allowed: false, reason: 'CANCELLED' };
    } else if (isStatusEnded) {
      join = { allowed: false, reason: 'ENDED' };
    } else if (isStatusLive) {
      join = { allowed: true, reason: 'ALLOWED' };
    } else {
      // Meeting is scheduled
      if (isHost) {
        join = { allowed: true, reason: 'ALLOWED', availableAt: availableAtInstant.toISOString() };
      } else {
        // Non-host: check if too early
        if (now.getTime() < availableAtInstant.getTime()) {
          join = {
            allowed: false,
            reason: 'TOO_EARLY',
            availableAt: availableAtInstant.toISOString(),
          };
        } else {
          // In early window, but waiting for host to initiate room
          join = {
            allowed: false,
            reason: 'WAITING_FOR_HOST',
            availableAt: meeting.scheduledAt.toISOString(),
          };
        }
      }
    }

    // 5. LEAVE capability
    const leave: ActionCapability = isStatusLive
      ? { allowed: true, reason: 'ALLOWED' }
      : { allowed: false, reason: 'ROOM_NOT_READY' };

    // 6. END FOR ALL capability
    const endForAll: ActionCapability = !isHost
      ? { allowed: false, reason: 'NOT_ORGANIZER' }
      : isStatusLive
      ? { allowed: true, reason: 'ALLOWED' }
      : { allowed: false, reason: 'ROOM_NOT_READY' };

    return {
      start,
      join,
      leave,
      endForAll,
      update,
      cancel,
    };
  }

  /**
   * Constructs the unified MeetingView with viewer-local and event-local projections.
   */
  static buildMeetingView(params: {
    meeting: MeetingOccurrenceRecord;
    series?: MeetingSeriesRecord | null;
    principal: PolicyPrincipal;
    viewerTimeZone?: string;
    now?: Date;
    isParticipant?: boolean;
    isInvited?: boolean;
  }): MeetingView {
    const { meeting, series, principal, viewerTimeZone = 'UTC', now } = params;
    const capabilities = this.evaluateCapabilities({
      meeting,
      series,
      principal,
      now,
      isParticipant: params.isParticipant,
      isInvited: params.isInvited,
    });

    const eventZone = meeting.eventTimeZone || 'UTC';
    const schedInstant = DateTime.fromJSDate(meeting.scheduledAt);

    return {
      meeting,
      viewerLocal: {
        startsAt: schedInstant.setZone(viewerTimeZone).toISO() ?? meeting.scheduledAt.toISOString(),
        timeZone: viewerTimeZone,
      },
      eventLocal: {
        startsAt: schedInstant.setZone(eventZone).toISO() ?? meeting.scheduledAt.toISOString(),
        timeZone: eventZone,
      },
      capabilities,
    };
  }
}
