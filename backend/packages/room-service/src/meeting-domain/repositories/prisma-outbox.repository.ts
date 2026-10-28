/**
 * MLTR-02: Prisma Outbox Repository Implementation
 * Handles transactional appending and fetching of unpublished events.
 */

import { PrismaClient } from '@prisma/client';
import { OutboxRepository } from './outbox.repository.js';
import { OutboxEventRecord, AppendOutboxParams } from './meeting-repository.types.js';

export class PrismaOutboxRepository implements OutboxRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapEvent(raw: any): OutboxEventRecord {
    return {
      id: raw.id,
      eventId: raw.eventId,
      aggregateType: raw.aggregateType,
      aggregateId: raw.aggregateId,
      eventType: raw.eventType,
      schemaVersion: raw.schemaVersion,
      payload: raw.payload as Record<string, unknown>,
      occurredAt: raw.occurredAt,
      publishedAt: raw.publishedAt,
      attempts: raw.attempts,
      lastErrorCode: raw.lastErrorCode,
    };
  }

  async append(params: AppendOutboxParams): Promise<OutboxEventRecord> {
    const raw = await this.prisma.outboxEvent.create({
      data: {
        eventId: params.eventId,
        aggregateType: params.aggregateType,
        aggregateId: params.aggregateId,
        eventType: params.eventType,
        schemaVersion: params.schemaVersion,
        payload: params.payload as any,
        occurredAt: params.occurredAt ?? new Date(),
      },
    });

    return this.mapEvent(raw);
  }

  async fetchUnpublished(limit: number): Promise<readonly OutboxEventRecord[]> {
    const rawList = await this.prisma.outboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { occurredAt: 'asc' },
      take: limit,
    });

    return rawList.map((e) => this.mapEvent(e));
  }

  async markPublished(eventId: string, publishedAt: Date = new Date()): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { eventId },
      data: { publishedAt },
    });
  }

  async recordAttempt(eventId: string, lastErrorCode: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { eventId },
      data: {
        attempts: { increment: 1 },
        lastErrorCode,
      },
    });
  }
}
