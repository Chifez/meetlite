/**
 * MLTR-02: Prisma Meeting Repository Implementation
 * Enforces tenant scoping, transactional boundaries, and persistence invariants.
 */

import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
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
  UpdateOccurrenceParams,
  UpdateSeriesAndOccurrencesParams,
  SplitSeriesAtOccurrenceParams,
} from './meeting-repository.types.js';
import { parseLocalDate, parseLocalTime, parseIanaTimeZone } from '../time/zoned-date-time.js';

export class PrismaMeetingRepository implements MeetingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private async createInvites(
    tx: Prisma.TransactionClient,
    meetingId: string,
    attendeeEmails: readonly string[] = []
  ): Promise<void> {
    const emails = [...new Set(attendeeEmails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
    if (emails.length === 0) return;
    await tx.meetingInvite.createMany({
      data: emails.map((email) => ({ meetingId, email, inviteToken: randomUUID() })),
      skipDuplicates: true,
    });
  }

  private async appendOutbox(
    tx: Prisma.TransactionClient,
    events: CreateSeriesWithFirstOccurrenceParams['outboxEvents'] = []
  ): Promise<void> {
    if (events.length === 0) return;
    await tx.outboxEvent.createMany({
      data: events.map((event) => ({
        eventId: event.eventId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        schemaVersion: event.schemaVersion,
        payload: event.payload as Prisma.InputJsonValue,
        occurredAt: event.occurredAt ?? new Date(),
      })),
      skipDuplicates: true,
    });
  }

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
    outboxCommitted?: boolean;
  }> {
    if (params.idempotencyKey) {
      const existingSeries = await this.prisma.meetingSeries.findUnique({
        where: {
          createdBy_idempotencyKey: {
            createdBy: params.series.createdBy,
            idempotencyKey: params.idempotencyKey,
          },
        },
        include: { occurrences: { orderBy: { scheduledAt: 'asc' }, take: 1 } },
      });
      const firstOccurrence = existingSeries?.occurrences[0];
      if (existingSeries && firstOccurrence) {
        return {
          series: this.mapSeries(existingSeries),
          firstOccurrence: this.mapOccurrence(firstOccurrence),
          outboxCommitted: true,
        };
      }
    }
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
          idempotencyKey: params.idempotencyKey ?? null,
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
          idempotencyKey: params.idempotencyKey ?? null,
        },
      });

      const attendeeEmails = params.attendeeEmails ?? [];
      if (attendeeEmails.length > 0) {
        await tx.meetingSeriesAttendee.createMany({
          data: [...new Set(attendeeEmails.map((email) => email.trim().toLowerCase()).filter(Boolean))]
            .map((email) => ({ seriesId: createdSeries.id, email })),
          skipDuplicates: true,
        });
      }
      await this.createInvites(tx, createdMeeting.id, attendeeEmails);
      await this.appendOutbox(tx, params.outboxEvents);

      return {
        series: this.mapSeries(createdSeries),
        firstOccurrence: this.mapOccurrence(createdMeeting),
        outboxCommitted: true,
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
    idempotencyKey?: string;
    attendeeEmails?: readonly string[];
    outboxEvents?: readonly import('./meeting-repository.types.js').AppendOutboxParams[];
  }): Promise<{ occurrence: MeetingOccurrenceRecord; created: boolean; outboxCommitted?: boolean }> {
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
        return { occurrence: this.mapOccurrence(existing), created: false, outboxCommitted: true };
      }

      const created = await this.prisma.$transaction(async (tx) => {
        const meeting = await tx.meeting.create({
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
        const attendees = await tx.meetingSeriesAttendee.findMany({
          where: { seriesId: series.id },
          select: { email: true },
        });
        await this.createInvites(tx, meeting.id, attendees.map(({ email }) => email));
        await this.appendOutbox(tx, params.outboxEvents);
        return meeting;
      });

      return { occurrence: this.mapOccurrence(created), created: true, outboxCommitted: true };
    }

    // Standalone meeting occurrence
    if (params.idempotencyKey && params.createdBy) {
      const idempotentMeeting = await this.prisma.meeting.findUnique({
        where: {
          createdBy_idempotencyKey: {
            createdBy: params.createdBy,
            idempotencyKey: params.idempotencyKey,
          },
        },
      });
      if (idempotentMeeting) {
        return { occurrence: this.mapOccurrence(idempotentMeeting), created: false, outboxCommitted: true };
      }
    }
    const existing = await this.findMeetingById(params.seed.meetingId, params.tenant);
    if (existing) {
      return { occurrence: existing, created: false, outboxCommitted: true };
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const meeting = await tx.meeting.create({
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
        idempotencyKey: params.idempotencyKey ?? null,
        },
      });
      await this.createInvites(tx, meeting.id, params.attendeeEmails);
      await this.appendOutbox(tx, params.outboxEvents);
      return meeting;
    });

    return { occurrence: this.mapOccurrence(created), created: true, outboxCommitted: true };
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
      seriesId: series.id,
      occurrenceKey: params.occurrenceKey,
      kind: params.kind,
      overrideMeetingId: raw.overrideMeetingId,
      seriesRevision: params.seriesRevision,
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

    return rawList.flatMap((raw) => {
      if (
        !raw.seriesId ||
        !raw.occurrenceKey ||
        !raw.seriesRevision ||
        (raw.kind !== 'CANCELLED' && raw.kind !== 'OVERRIDDEN')
      ) {
        return [];
      }
      return [{
        id: raw.id,
        seriesId: raw.seriesId,
        occurrenceKey: raw.occurrenceKey,
        kind: raw.kind,
        overrideMeetingId: raw.overrideMeetingId,
        seriesRevision: raw.seriesRevision,
        createdAt: raw.createdAt,
      }];
    });
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

    const write = await this.prisma.meetingSeries.updateMany({
      where: { id: series.id, revision: params.expectedRevision },
      data: {
        status: params.status,
        revision: { increment: 1 },
      },
    });
    if (write.count !== 1) throw Object.assign(new Error('SERIES_REVISION_CONFLICT'), { code: 'SERIES_REVISION_CONFLICT' });
    const updated = await this.prisma.meetingSeries.findUniqueOrThrow({ where: { id: series.id } });
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

    const write = await this.prisma.meeting.updateMany({
      where: { id: meeting.id, lifecycleRevision: params.expectedRevision },
      data: {
        status: params.status,
        lifecycleRevision: { increment: 1 },
      },
    });
    if (write.count !== 1) throw Object.assign(new Error('MEETING_REVISION_CONFLICT'), { code: 'MEETING_REVISION_CONFLICT' });
    const updated = await this.prisma.meeting.findUniqueOrThrow({ where: { id: meeting.id } });
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

  async updateMeetingOccurrence(
    params: UpdateOccurrenceParams
  ): Promise<MeetingOccurrenceRecord> {
    const meeting = await this.findMeetingById(params.meetingId, params.tenant);
    if (!meeting) {
      throw new Error(`MEETING_NOT_FOUND: ${params.meetingId}`);
    }

    if (meeting.lifecycleRevision !== params.expectedRevision) {
      const err: any = new Error(
        `MEETING_REVISION_CONFLICT: expected ${params.expectedRevision}, found ${meeting.lifecycleRevision}`
      );
      err.code = 'MEETING_REVISION_CONFLICT';
      throw err;
    }

    const data: any = {
      lifecycleRevision: { increment: 1 },
    };
    if (params.patch.title !== undefined) data.title = params.patch.title;
    if (params.patch.description !== undefined) data.description = params.patch.description;
    if (params.patch.scheduledAt !== undefined) {
      data.scheduledAt = params.patch.scheduledAt;
      data.scheduledTime = params.patch.scheduledAt; // Compatibility
    }
    if (params.patch.eventTimeZone !== undefined) data.eventTimeZone = params.patch.eventTimeZone;
    if (params.patch.durationMinutes !== undefined) {
      data.durationMinutes = params.patch.durationMinutes;
      data.duration = params.patch.durationMinutes; // Compatibility
    }
    if (params.patch.privacy !== undefined) data.privacy = params.patch.privacy;

    const write = await this.prisma.meeting.updateMany({
      where: { id: meeting.id, lifecycleRevision: params.expectedRevision },
      data,
    });
    if (write.count !== 1) throw Object.assign(new Error('MEETING_REVISION_CONFLICT'), { code: 'MEETING_REVISION_CONFLICT' });
    const updated = await this.prisma.meeting.findUniqueOrThrow({ where: { id: meeting.id } });
    return this.mapOccurrence(updated);
  }

  async cancelMeetingOccurrence(params: {
    meetingId: string;
    expectedRevision: number;
    tenant: TenantContext;
  }): Promise<MeetingOccurrenceRecord> {
    return this.updateMeetingStatus({
      meetingId: params.meetingId,
      status: 'cancelled',
      expectedRevision: params.expectedRevision,
      tenant: params.tenant,
    });
  }

  async cancelSeries(params: {
    seriesId: string;
    expectedRevision: number;
    tenant: TenantContext;
  }): Promise<{ series: MeetingSeriesRecord; cancelledOccurrencesCount: number }> {
    return await this.prisma.$transaction(async (tx) => {
      const series = await this.findSeriesById(params.seriesId, params.tenant);
      if (!series) {
        throw new Error(`SERIES_NOT_FOUND: ${params.seriesId}`);
      }

      if (series.revision !== params.expectedRevision) {
        const err: any = new Error(
          `SERIES_REVISION_CONFLICT: expected ${params.expectedRevision}, found ${series.revision}`
        );
        err.code = 'SERIES_REVISION_CONFLICT';
        throw err;
      }

      const seriesWrite = await tx.meetingSeries.updateMany({
        where: { id: series.id, revision: params.expectedRevision },
        data: {
          status: 'CANCELLED',
          revision: { increment: 1 },
        },
      });
      if (seriesWrite.count !== 1) throw Object.assign(new Error('SERIES_REVISION_CONFLICT'), { code: 'SERIES_REVISION_CONFLICT' });
      const updatedSeries = await tx.meetingSeries.findUniqueOrThrow({ where: { id: series.id } });

      const updatedOccurrences = await tx.meeting.updateMany({
        where: {
          seriesId: series.id,
          status: { in: ['scheduled', 'ongoing'] },
        },
        data: {
          status: 'cancelled',
          lifecycleRevision: { increment: 1 },
        },
      });

      return {
        series: this.mapSeries(updatedSeries),
        cancelledOccurrencesCount: updatedOccurrences.count,
      };
    });
  }

  async cancelFollowingOccurrences(params: {
    seriesId: string;
    fromOccurrenceKey: string;
    expectedRevision: number;
    cappedRule: string;
    tenant: TenantContext;
  }): Promise<{ series: MeetingSeriesRecord; cancelledOccurrencesCount: number }> {
    return await this.prisma.$transaction(async (tx) => {
      const series = await this.findSeriesById(params.seriesId, params.tenant);
      if (!series) {
        throw new Error(`SERIES_NOT_FOUND: ${params.seriesId}`);
      }

      if (series.revision !== params.expectedRevision) {
        const err: any = new Error(
          `SERIES_REVISION_CONFLICT: expected ${params.expectedRevision}, found ${series.revision}`
        );
        err.code = 'SERIES_REVISION_CONFLICT';
        throw err;
      }

      const seriesWrite = await tx.meetingSeries.updateMany({
        where: { id: series.id, revision: params.expectedRevision },
        data: {
          recurrenceRule: params.cappedRule,
          revision: { increment: 1 },
        },
      });
      if (seriesWrite.count !== 1) throw Object.assign(new Error('SERIES_REVISION_CONFLICT'), { code: 'SERIES_REVISION_CONFLICT' });
      const updatedSeries = await tx.meetingSeries.findUniqueOrThrow({ where: { id: series.id } });

      const updatedOccurrences = await tx.meeting.updateMany({
        where: {
          seriesId: series.id,
          occurrenceKey: { gte: params.fromOccurrenceKey },
          status: { in: ['scheduled', 'ongoing'] },
        },
        data: {
          status: 'cancelled',
          lifecycleRevision: { increment: 1 },
        },
      });

      return {
        series: this.mapSeries(updatedSeries),
        cancelledOccurrencesCount: updatedOccurrences.count,
      };
    });
  }

  async updateSeriesAndOccurrences(
    params: UpdateSeriesAndOccurrencesParams
  ): Promise<{ series: MeetingSeriesRecord; updatedOccurrencesCount: number }> {
    return await this.prisma.$transaction(async (tx) => {
      const series = await this.findSeriesById(params.seriesId, params.tenant);
      if (!series) {
        throw new Error(`SERIES_NOT_FOUND: ${params.seriesId}`);
      }

      if (series.revision !== params.expectedRevision) {
        const err: any = new Error(
          `SERIES_REVISION_CONFLICT: expected ${params.expectedRevision}, found ${series.revision}`
        );
        err.code = 'SERIES_REVISION_CONFLICT';
        throw err;
      }

      const seriesData: any = {
        revision: { increment: 1 },
      };
      if (params.seriesPatch.title !== undefined) seriesData.title = params.seriesPatch.title;
      if (params.seriesPatch.description !== undefined) seriesData.description = params.seriesPatch.description;
      if (params.seriesPatch.durationMinutes !== undefined) seriesData.durationMinutes = params.seriesPatch.durationMinutes;
      if (params.seriesPatch.privacy !== undefined) seriesData.privacy = params.seriesPatch.privacy;
      if (params.seriesPatch.recurrenceRule !== undefined) seriesData.recurrenceRule = params.seriesPatch.recurrenceRule;

      const seriesWrite = await tx.meetingSeries.updateMany({
        where: { id: series.id, revision: params.expectedRevision },
        data: seriesData,
      });
      if (seriesWrite.count !== 1) throw Object.assign(new Error('SERIES_REVISION_CONFLICT'), { code: 'SERIES_REVISION_CONFLICT' });
      const updatedSeries = await tx.meetingSeries.findUniqueOrThrow({ where: { id: series.id } });

      const occData: any = {
        lifecycleRevision: { increment: 1 },
      };
      if (params.seriesPatch.title !== undefined) occData.title = params.seriesPatch.title;
      if (params.seriesPatch.description !== undefined) occData.description = params.seriesPatch.description;
      if (params.seriesPatch.durationMinutes !== undefined) {
        occData.durationMinutes = params.seriesPatch.durationMinutes;
        occData.duration = params.seriesPatch.durationMinutes;
      }
      if (params.seriesPatch.privacy !== undefined) occData.privacy = params.seriesPatch.privacy;

      const updatedOccurrences = await tx.meeting.updateMany({
        where: {
          seriesId: series.id,
          status: 'scheduled',
        },
        data: occData,
      });

      return {
        series: this.mapSeries(updatedSeries),
        updatedOccurrencesCount: updatedOccurrences.count,
      };
    });
  }

  async splitSeriesAtOccurrence(
    params: SplitSeriesAtOccurrenceParams
  ): Promise<{
    predecessorSeries: MeetingSeriesRecord;
    successorSeries: MeetingSeriesRecord;
    updatedMeeting: MeetingOccurrenceRecord;
  }> {
    return await this.prisma.$transaction(async (tx) => {
      const predecessor = await this.findSeriesById(params.predecessorSeriesId, params.tenant);
      if (!predecessor) {
        throw new Error(`SERIES_NOT_FOUND: ${params.predecessorSeriesId}`);
      }

      if (predecessor.revision !== params.expectedRevision) {
        const err: any = new Error(
          `SERIES_REVISION_CONFLICT: expected ${params.expectedRevision}, found ${predecessor.revision}`
        );
        err.code = 'SERIES_REVISION_CONFLICT';
        throw err;
      }

      // 1. Cap predecessor
      const predecessorWrite = await tx.meetingSeries.updateMany({
        where: { id: predecessor.id, revision: params.expectedRevision },
        data: {
          recurrenceRule: params.cappedPredecessorRule,
          revision: { increment: 1 },
        },
      });
      if (predecessorWrite.count !== 1) throw Object.assign(new Error('SERIES_REVISION_CONFLICT'), { code: 'SERIES_REVISION_CONFLICT' });
      const updatedPredecessor = await tx.meetingSeries.findUniqueOrThrow({ where: { id: predecessor.id } });

      // 2. Create successor series
      const successor = await tx.meetingSeries.create({
        data: {
          seriesId: params.successorSeries.seriesId,
          organizationId: params.successorSeries.organizationId ?? predecessor.organizationId,
          teamId: params.successorSeries.teamId ?? predecessor.teamId,
          createdBy: params.successorSeries.createdBy,
          title: params.successorSeries.title,
          description: params.successorSeries.description ?? null,
          durationMinutes: params.successorSeries.durationMinutes,
          privacy: params.successorSeries.privacy,
          timeZone: params.successorSeries.timeZone,
          localStartDate: params.successorSeries.localStartDate,
          localStartTime: params.successorSeries.localStartTime,
          recurrenceRule: params.successorSeries.recurrenceRule,
          status: 'ACTIVE',
          revision: 1,
        },
      });

      // 3. Re-parent target occurrence and any following unstarted occurrences
      const targetMeeting = await this.findMeetingById(params.targetMeetingId, params.tenant);
      if (!targetMeeting) {
        throw new Error(`MEETING_NOT_FOUND: ${params.targetMeetingId}`);
      }

      const updatedMeeting = await tx.meeting.update({
        where: { id: targetMeeting.id },
        data: {
          seriesId: successor.id,
          lifecycleRevision: { increment: 1 },
        },
      });

      const splitKey = targetMeeting.occurrenceKey;
      if (splitKey) {
        await tx.meeting.updateMany({
          where: {
            seriesId: predecessor.id,
            occurrenceKey: { gt: splitKey },
            id: { not: targetMeeting.id },
          },
          data: {
            seriesId: successor.id,
            lifecycleRevision: { increment: 1 },
          },
        });
      }

      return {
        predecessorSeries: this.mapSeries(updatedPredecessor),
        successorSeries: this.mapSeries(successor),
        updatedMeeting: this.mapOccurrence(updatedMeeting),
      };
    });
  }
}
