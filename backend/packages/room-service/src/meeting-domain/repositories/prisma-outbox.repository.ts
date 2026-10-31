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

  async claimUnpublished(
    limit: number,
    workerId: string,
    leaseUntil: Date
  ): Promise<readonly OutboxEventRecord[]> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.$queryRaw<Array<{ id: string }>>`
        WITH candidates AS (
          SELECT id
          FROM outbox_events
          WHERE published_at IS NULL
            AND dead_lettered_at IS NULL
            AND attempts < 10
            AND (claim_expires_at IS NULL OR claim_expires_at < NOW())
          ORDER BY occurred_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${limit}
        )
        UPDATE outbox_events AS event
        SET claim_expires_at = ${leaseUntil}, claimed_by = ${workerId}
        FROM candidates
        WHERE event.id = candidates.id
        RETURNING event.id
      `;
      if (claimed.length === 0) return [];
      const rows = await tx.outboxEvent.findMany({
        where: { id: { in: claimed.map(({ id }) => id) } },
        orderBy: { occurredAt: 'asc' },
      });
      return rows.map((event) => this.mapEvent(event));
    });
  }

  async markPublished(eventId: string, publishedAt: Date = new Date()): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { eventId },
      data: { publishedAt, claimExpiresAt: null, claimedBy: null },
    });
  }

  async recordAttempt(eventId: string, lastErrorCode: string): Promise<void> {
    const updated = await this.prisma.outboxEvent.update({
      where: { eventId },
      data: {
        attempts: { increment: 1 },
        lastErrorCode,
        claimExpiresAt: null,
        claimedBy: null,
      },
    });
    if (updated.attempts >= 10) {
      await this.prisma.outboxEvent.update({
        where: { eventId },
        data: { deadLetteredAt: new Date() },
      });
    }
  }
}
