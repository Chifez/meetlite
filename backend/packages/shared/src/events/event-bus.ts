import { Redis } from 'ioredis';

export type DomainEvent =
  | { type: 'room:validated'; payload: { roomId: string; userId: string } }
  | { type: 'recording:finalized'; payload: { recordingId: string; url: string; roomId: string } }
  | { type: 'participant:joined'; payload: { roomId: string; userId: string } }
  | { type: 'participant:left'; payload: { roomId: string; userId: string } };

export class EventBus {
  private publisher: Redis;
  private subscriber: Redis;
  private handlers: Map<string, Set<(payload: any) => void>> = new Map();
  private isListening = false;

  constructor(redisUrl: string) {
    this.publisher = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);
  }

  async publish(event: DomainEvent): Promise<void> {
    await this.publisher.publish(event.type, JSON.stringify(event.payload));
  }

  async subscribe<T extends DomainEvent['type']>(
    channel: T,
    handler: (payload: Extract<DomainEvent, { type: T }>['payload']) => void
  ): Promise<void> {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }
    this.handlers.get(channel)!.add(handler);

    if (!this.isListening) {
      this.isListening = true;
      this.subscriber.on('message', (ch, message) => {
        const channelHandlers = this.handlers.get(ch);
        if (channelHandlers) {
          try {
            const parsed = JSON.parse(message);
            channelHandlers.forEach((h) => {
              try {
                h(parsed);
              } catch (err) {
                console.error(`Error in event handler for channel ${ch}:`, err);
              }
            });
          } catch (err) {
            console.error(`Failed to parse event message on channel ${ch}:`, err);
          }
        }
      });
    }
  }

  async unsubscribe<T extends DomainEvent['type']>(
    channel: T,
    handler: (payload: Extract<DomainEvent, { type: T }>['payload']) => void
  ): Promise<void> {
    const channelHandlers = this.handlers.get(channel);
    if (channelHandlers) {
      channelHandlers.delete(handler);
      if (channelHandlers.size === 0) {
        this.handlers.delete(channel);
        await this.subscriber.unsubscribe(channel);
      }
    }
  }

  async close(): Promise<void> {
    await Promise.all([
      this.publisher.quit(),
      this.subscriber.quit(),
    ]);
  }
}
