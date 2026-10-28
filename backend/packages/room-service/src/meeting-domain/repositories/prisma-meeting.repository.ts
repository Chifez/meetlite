/**
 * MLTR-02: Prisma Meeting Repository Implementation
 * Enforces tenant scoping, transactional boundaries, and persistence invariants.
 */

import { PrismaClient } from '@prisma/client';
import {
  MeetingRepository,
} from './meeting.repository.js';
import {
  MeetingSeriesRecord,
  MeetingOccurrenceRecord,
  MeetingRecurrenceExceptionRecord,
  TenantContext,
  CreateSeriesWithFirstOccurrenceParams,
  CreateOccurrenceSeedParams,
  MeetingSeriesStatus,
  MeetingLifecycleStatus,
} from './meeting-repository.types.js';
import { parseLocalDate, parseLocalTime, parseIanaTimeZone } from '../time/zoned-date-time.js';

export class PrismaMeetingRepository implements MeetingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapSeries(raw: any): MeetingSeriesRecord {
    return {
      id: raw.id,
      seriesId: raw.seriesId,
      organizationId: raw.organizationId,
      teamId: raw.teamId,
      createdBy: raw.createdBy,
      title: raw.title,
      description: raw.description,
      durationMinutes: raw.durationMinutes,
      privacy: raw.privacy,
      timeZone: parseIanaTimeZone(raw.timeZone),
      localStartDate: parseLocalDate(raw.localStartDate),
      localStartTime: parseLocalTime(raw.localStartTime),
      recurrenceRule: raw.recurrenceRule,
      status: raw.status as MeetingSeriesStatus,
      revision: raw.revision,
      materializedThrough: raw.materializedThrough,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }

  private mapOccurrence(raw: any): MeetingOccurrenceRecord {
    return {
      id: raw.id,
      meetingId: raw.meetingId,
      organizationId: raw.organizationId,
      teamId: raw.teamId,
      createdBy: raw.createdBy,
      title: raw.title,
      description: raw.description,
      privacy: raw.privacy,
      seriesId: raw.seriesId,
      occurrenceKey: raw.occurrenceKey,
      scheduledAt: raw.scheduledAt ?? raw.scheduledTime,
      eventTimeZone: raw.eventTimeZone ?? 'UTC',
      durationMinutes: raw.durationMinutes ?? raw.duration,
      status: raw.status as MeetingLifecycleStatus,
      lifecycleRevision: raw.lifecycleRevision,
      roomId: raw.roomId,
      createdAt: raw.createdAt,
    };
  }

  private buildTenantWhere(tenant: TenantContext): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    if (tenant.organizationId !== undefined) {
      where.organizationId = tenant.organizationId;
    }
    if (tenant.teamId !== undefined) {
      where.teamId = tenant.teamId;
    }
    return where;
  }

  async createSeriesWithFirstOccurrence(
    params: CreateSeriesWithFirstOccurrenceParams
  ): Promise<{
    series: MeetingSeriesRecord;
    firstOccurrence: MeetingOccurrenceRecord;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const createdSeries = await tx.meetingSeries.create({
        data: {
          seriesId: params.series.seriesId,
          organizationId: params.series.organizationId ?? null,
          teamId: params.series.teamId ?? null,
          createdBy: params.series.createdBy,
          title: params.series.title,
          description: params.series.description ?? null,
          durationMinutes: params.series.durationMinutes,
          privacy: params.series.privacy,
          timeZone: params.series.timeZone,
          localStartDate: params.series.localStartDate,
          localStartTime: params.series.localStartTime,
          recurrenceRule: params.series.recurrenceRule,
          status: 'ACTIVE',
          revision: 1,
          materializedThrough: params.firstOccurrence.scheduledAt,
        },
      });

      const createdMeeting = await tx.meeting.create({
        data: {
          meetingId: params.firstOccurrence.meetingId,
          organizationId: params.series.organizationId ?? null,
          teamId: params.series.teamId ?? null,
          createdBy: params.series.createdBy,
          title: params.firstOccurrence.title ?? params.series.title,
          description: params.firstOccurrence.description ?? params.series.description ?? null,
          privacy: params.firstOccurrence.privacy ?? params.series.privacy,
          seriesId: createdSeries.id,
          occurrenceKey: params.firstOccurrence.occurrenceKey,
          scheduledAt: params.firstOccurrence.scheduledAt,
          scheduledTime: params.firstOccurrence.scheduledAt, // Compatibility write
          eventTimeZone: params.firstOccurrence.eventTimeZone,
          durationMinutes: params.firstOccurrence.durationMinutes,
          duration: params.firstOccurrence.durationMinutes, // Compatibility write
          status: 'scheduled',
          lifecycleRevision: 1,
        },
      });

      return {
        series: this.mapSeries(createdSeries),
        firstOccurrence: this.mapOccurrence(createdMeeting),
      };
    });
  }

  async findSeriesById(
    seriesId: string,
    tenant: TenantContext
  ): Promise<MeetingSeriesRecord | null> {
    const raw = await this.prisma.meetingSeries.findFirst({
      where: {
        OR: [{ seriesId }, { id: seriesId }],
        ...this.buildTenantWhere(tenant),
      },
    });

    return raw ? this.mapSeries(raw) : null;
  }

  async findOccurrenceByKey(
    seriesId: string,
    occurrenceKey: string,
    tenant: TenantContext
  ): Promise<MeetingOccurrenceRecord | null> {
    const series = await this.findSeriesById(seriesId, tenant);
    if (!series) return null;

    const raw = await this.prisma.meeting.findFirst({
      where: {
        seriesId: series.id,
        occurrenceKey,
        ...this.buildTenantWhere(tenant),
      },
    });

    return raw ? this.mapOccurrence(raw) : null;
  }

  async findMeetingById(
    meetingId: string,
    tenant: TenantContext
  ): Promise<MeetingOccurrenceRecord | null> {
    const raw = await this.prisma.meeting.findFirst({
      where: {
        OR: [{ meetingId }, { id: meetingId }],
        ...this.buildTenantWhere(tenant),
      },
    });

    return raw ? this.mapOccurrence(raw) : null;
  }

  async listOccurrencesByWindow(params: {
    fromInclusive: Date;
    toExclusive: Date;
    tenant: TenantContext;
    seriesId?: string;
  }): Promise<readonly MeetingOccurrenceRecord[]> {
    const where: Record<string, unknown> = {
      ...this.buildTenantWhere(params.tenant),
      scheduledAt: {
        gte: params.fromInclusive,
        lt: params.toExclusive,
      },
    };

    if (params.seriesId) {
      where.seriesId = params.seriesId;
    }

    const rawList = await this.prisma.meeting.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
    });

    return rawList.map((m) => this.mapOccurrence(m));
  }

  async upsertOccurrence(params: {
    seriesId?: string | null;
    seed: CreateOccurrenceSeedParams;
    tenant: TenantContext;
    createdBy?: string;
  }): Promise<{ occurrence: MeetingOccurrenceRecord; created: boolean }> {
    if (params.seriesId) {
      const series = await this.findSeriesById(params.seriesId, params.tenant);
      if (!series) {
        throw new Error(`SERIES_NOT_FOUND: ${params.seriesId}`);
      }

      const existing = await this.prisma.meeting.findUnique({
        where: {
          seriesId_occurrenceKey: {
            seriesId: series.id,
            occurrenceKey: params.seed.occurrenceKey,
          },
        },
      });

      if (existing) {
        return { occurrence: this.mapOccurrence(existing), created: false };
      }

      const created = await this.prisma.meeting.create({
        data: {
          meetingId: params.seed.meetingId,
          organizationId: series.organizationId,
          teamId: series.teamId,
          createdBy: series.createdBy,
          title: params.seed.title ?? series.title,
          description: params.seed.description ?? series.description,
          privacy: params.seed.privacy ?? series.privacy,
          seriesId: series.id,
          occurrenceKey: params.seed.occurrenceKey,
          scheduledAt: params.seed.scheduledAt,
          scheduledTime: params.seed.scheduledAt,
          eventTimeZone: params.seed.eventTimeZone,
          durationMinutes: params.seed.durationMinutes,
          duration: params.seed.durationMinutes,
          status: 'scheduled',
          lifecycleRevision: 1,
        },
      });

      return { occurrence: this.mapOccurrence(created), created: true };
    }

    // Standalone meeting occurrence
    const existing = await this.findMeetingById(params.seed.meetingId, params.tenant);
    if (existing) {
      return { occurrence: existing, created: false };
    }

    const created = await this.prisma.meeting.create({
      data: {
        meetingId: params.seed.meetingId,
        organizationId: params.tenant.organizationId ?? null,
        teamId: params.tenant.teamId ?? null,
        createdBy: params.createdBy ?? '00000000-0000-0000-0000-000000000000',
        title: params.seed.title ?? 'Untitled Meeting',
        description: params.seed.description ?? null,
        privacy: params.seed.privacy ?? 'public',
        seriesId: null,
        occurrenceKey: null,
        scheduledAt: params.seed.scheduledAt,
        scheduledTime: params.seed.scheduledAt,
        eventTimeZone: params.seed.eventTimeZone,
        durationMinutes: params.seed.durationMinutes,
        duration: params.seed.durationMinutes,
        status: 'scheduled',
        lifecycleRevision: 1,
      },
    });

    return { occurrence: this.mapOccurrence(created), created: true };
  }

  async createException(params: {
    seriesId: string;
    occurrenceKey: string;
    kind: 'CANCELLED' | 'OVERRIDDEN';
    overrideMeetingId?: string | null;
    seriesRevision: number;
    tenant: TenantContext;
  }): Promise<MeetingRecurrenceExceptionRecord> {
    const series = await this.findSeriesById(params.seriesId, params.tenant);
    if (!series) {
      throw new Error(`SERIES_NOT_FOUND: ${params.seriesId}`);
    }

    const raw = await this.prisma.meetingRecurrenceException.create({
      data: {
        seriesId: series.id,
        occurrenceKey: params.occurrenceKey,
        kind: params.kind,
        overrideMeetingId: params.overrideMeetingId ?? null,
        seriesRevision: params.seriesRevision,
      },
    });

    return {
      id: raw.id,
      seriesId: raw.seriesId,
      occurrenceKey: raw.occurrenceKey,
      kind: raw.kind as 'CANCELLED' | 'OVERRIDDEN',
      overrideMeetingId: raw.overrideMeetingId,
      seriesRevision: raw.seriesRevision,
      createdAt: raw.createdAt,
    };
  }

  async findExceptionsBySeries(
    seriesId: string,
    tenant: TenantContext
  ): Promise<readonly MeetingRecurrenceExceptionRecord[]> {
    const series = await this.findSeriesById(seriesId, tenant);
    if (!series) return [];

    const rawList = await this.prisma.meetingRecurrenceException.findMany({
      where: { seriesId: series.id },
      orderBy: { createdAt: 'asc' },
    });

    return rawList.map((raw) => ({
      id: raw.id,
      seriesId: raw.seriesId,
      occurrenceKey: raw.occurrenceKey,
      kind: raw.kind as 'CANCELLED' | 'OVERRIDDEN',
      overrideMeetingId: raw.overrideMeetingId,
      seriesRevision: raw.seriesRevision,
      createdAt: raw.createdAt,
    }));
  }

  async updateSeriesStatus(params: {
    seriesId: string;
    status: MeetingSeriesStatus;
    expectedRevision: number;
    tenant: TenantContext;
  }): Promise<MeetingSeriesRecord> {
    const series = await this.findSeriesById(params.seriesId, params.tenant);
    if (!series) {
      throw new Error(`SERIES_NOT_FOUND: ${params.seriesId}`);
    }

    if (series.revision !== params.expectedRevision) {
      throw new Error(
        `SERIES_REVISION_CONFLICT: expected ${params.expectedRevision}, found ${series.revision}`
      );
    }

    const updated = await this.prisma.meetingSeries.update({
      where: { id: series.id },
      data: {
        status: params.status,
        revision: { increment: 1 },
      },
    });

    return this.mapSeries(updated);
  }

  async updateMeetingStatus(params: {
    meetingId: string;
    status: MeetingLifecycleStatus;
    expectedRevision: number;
    tenant: TenantContext;
  }): Promise<MeetingOccurrenceRecord> {
    const meeting = await this.findMeetingById(params.meetingId, params.tenant);
    if (!meeting) {
      throw new Error(`MEETING_NOT_FOUND: ${params.meetingId}`);
    }

    if (meeting.lifecycleRevision !== params.expectedRevision) {
      throw new Error(
        `MEETING_REVISION_CONFLICT: expected ${params.expectedRevision}, found ${meeting.lifecycleRevision}`
      );
    }

    const updated = await this.prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        status: params.status,
        lifecycleRevision: { increment: 1 },
      },
    });

    return this.mapOccurrence(updated);
  }

  async advanceMaterializedThrough(
    seriesId: string,
    throughExclusive: Date,
    tenant?: TenantContext
  ): Promise<void> {
    const series = await this.findSeriesById(seriesId, tenant ?? {});
    if (series) {
      await this.prisma.meetingSeries.update({
        where: { id: series.id },
        data: { materializedThrough: throughExclusive },
      });
    }
  }

  async findDueSeriesForMaterialization(
    horizon: Date,
    limit: number
  ): Promise<readonly MeetingSeriesRecord[]> {
    const rawList = await this.prisma.meetingSeries.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { materializedThrough: null },
          { materializedThrough: { lt: horizon } },
        ],
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    return rawList.map((raw) => this.mapSeries(raw));
  }
}
