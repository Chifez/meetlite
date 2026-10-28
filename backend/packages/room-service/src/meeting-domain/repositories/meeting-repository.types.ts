/**
 * MLTR-02: Tenant-safe Repository Domain Types
 * Invariant: Series templates and joinable occurrences are distinguishable in storage.
 */

import { LocalDate, LocalTime, IanaTimeZone } from '../time/zoned-date-time.js';

export type MeetingSeriesStatus = 'ACTIVE' | 'CANCELLED' | 'ENDED';

export type MeetingLifecycleStatus =
  | 'scheduled'
  | 'live'
  | 'ended'
  | 'cancelled'
  | 'completed';

export interface TenantContext {
  organizationId?: string | null;
  teamId?: string | null;
}

export interface MeetingSeriesRecord {
  id: string; // Internal UUID
  seriesId: string; // Public identifier
  organizationId: string | null;
  teamId: string | null;
  createdBy: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  privacy: string;
  timeZone: IanaTimeZone;
  localStartDate: LocalDate;
  localStartTime: LocalTime;
  recurrenceRule: string;
  status: MeetingSeriesStatus;
  revision: number;
  materializedThrough: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MeetingOccurrenceRecord {
  id: string; // Internal UUID
  meetingId: string; // Public identifier
  organizationId: string | null;
  teamId: string | null;
  createdBy: string;
  title: string;
  description: string | null;
  privacy: string;
  seriesId: string | null;
  occurrenceKey: string | null;
  scheduledAt: Date;
  eventTimeZone: string;
  durationMinutes: number;
  status: MeetingLifecycleStatus;
  lifecycleRevision: number;
  roomId: string | null;
  createdAt: Date;
}

export interface MeetingRecurrenceExceptionRecord {
  id: string;
  seriesId: string;
  occurrenceKey: string;
  kind: 'CANCELLED' | 'OVERRIDDEN';
  overrideMeetingId: string | null;
  seriesRevision: number;
  createdAt: Date;
}

export interface OutboxEventRecord {
  id: string;
  eventId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  schemaVersion: number;
  payload: Record<string, unknown>;
  occurredAt: Date;
  publishedAt: Date | null;
  attempts: number;
  lastErrorCode: string | null;
}

export interface CreateSeriesParams {
  seriesId: string;
  organizationId?: string | null;
  teamId?: string | null;
  createdBy: string;
  title: string;
  description?: string | null;
  durationMinutes: number;
  privacy: string;
  timeZone: IanaTimeZone;
  localStartDate: LocalDate;
  localStartTime: LocalTime;
  recurrenceRule: string;
}

export interface CreateOccurrenceSeedParams {
  meetingId: string;
  occurrenceKey: string;
  scheduledAt: Date;
  eventTimeZone: string;
  durationMinutes: number;
  title?: string;
  description?: string | null;
  privacy?: string;
}

export interface CreateSeriesWithFirstOccurrenceParams {
  series: CreateSeriesParams;
  firstOccurrence: CreateOccurrenceSeedParams;
  attendeeEmails?: readonly string[];
}

export interface AppendOutboxParams {
  eventId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  schemaVersion: number;
  payload: Record<string, unknown>;
  occurredAt?: Date;
}

export interface UpdateOccurrenceParams {
  meetingId: string;
  patch: {
    title?: string;
    description?: string | null;
    scheduledAt?: Date;
    eventTimeZone?: string;
    durationMinutes?: number;
    privacy?: string;
  };
  expectedRevision: number;
  tenant: TenantContext;
}

export interface UpdateSeriesAndOccurrencesParams {
  seriesId: string;
  expectedRevision: number;
  seriesPatch: {
    title?: string;
    description?: string | null;
    durationMinutes?: number;
    privacy?: string;
    recurrenceRule?: string;
  };
  tenant: TenantContext;
}

export interface SplitSeriesAtOccurrenceParams {
  predecessorSeriesId: string;
  expectedRevision: number;
  cappedPredecessorRule: string;
  successorSeries: {
    seriesId: string;
    localStartDate: LocalDate;
    localStartTime: LocalTime;
    recurrenceRule: string;
    title: string;
    description?: string | null;
    durationMinutes: number;
    privacy: string;
    timeZone: IanaTimeZone;
    organizationId?: string | null;
    teamId?: string | null;
    createdBy: string;
  };
  targetMeetingId: string;
  tenant: TenantContext;
}
