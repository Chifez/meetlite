/**
 * MLTR-02: In-Memory Fake Outbox Repository
 * Enforces transactional append and publishing state in memory.
 */

import { randomUUID } from 'node:crypto';
import { OutboxRepository } from './outbox.repository.js';
import { OutboxEventRecord, AppendOutboxParams } from './meeting-repository.types.js';

export class FakeOutboxRepository implements OutboxRepository {
  private events: OutboxEventRecord[] = [];
  private claimed = new Set<string>();

  async append(params: AppendOutboxParams): Promise<OutboxEventRecord> {
    const existing = this.events.find((e) => e.eventId === params.eventId);
    if (existing) {
      return { ...existing };
    }

    const event: OutboxEventRecord = {
      id: randomUUID(),
      eventId: params.eventId,
      aggregateType: params.aggregateType,
      aggregateId: params.aggregateId,
      eventType: params.eventType,
      schemaVersion: params.schemaVersion,
      payload: params.payload,
      occurredAt: params.occurredAt ?? new Date(),
      publishedAt: null,
      attempts: 0,
      lastErrorCode: null,
    };

    this.events.push(event);
    return { ...event };
  }

  async fetchUnpublished(limit: number): Promise<readonly OutboxEventRecord[]> {
    return this.events
      .filter((e) => e.publishedAt === null)
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
      .slice(0, limit)
      .map((e) => ({ ...e }));
  }

  async claimUnpublished(limit: number): Promise<readonly OutboxEventRecord[]> {
    const events = this.events
      .filter((event) => event.publishedAt === null && !this.claimed.has(event.eventId))
      .slice(0, limit);
    for (const event of events) this.claimed.add(event.eventId);
    return events;
  }

  async markPublished(eventId: string, publishedAt: Date = new Date()): Promise<void> {
    const event = this.events.find((e) => e.eventId === eventId);
    if (event) {
      event.publishedAt = publishedAt;
    this.claimed.delete(eventId);
    }
  }

  async recordAttempt(eventId: string, lastErrorCode: string): Promise<void> {
    const event = this.events.find((e) => e.eventId === eventId);
    if (event) {
      event.attempts += 1;
      event.lastErrorCode = lastErrorCode;
    this.claimed.delete(eventId);
    }
  }
}
