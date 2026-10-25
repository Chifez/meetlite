import { EventEmitter } from 'events';

export class MockWebSocket extends EventEmitter {
  public readyState = 1; // OPEN
  public sentMessages: any[] = [];
  public receivedMessages: any[] = [];
  public closed = false;
  public closeCode?: number;
  public closeReason?: string;
  private peer?: MockWebSocket;
  private attachment?: unknown;

  static createPair(): [MockWebSocket, MockWebSocket] {
    const client = new MockWebSocket();
    const server = new MockWebSocket();
    client.peer = server;
    server.peer = client;
    return [client, server];
  }

  send(data: string): void {
    if (this.closed) throw new Error('WebSocket is already closed');
    const parsed = JSON.parse(data);
    this.sentMessages.push(parsed);
    if (this.peer && !this.peer.closed) {
      this.peer.receivedMessages.push(parsed);
      this.peer.emit('message', { data });
    }
  }

  close(code = 1000, reason = ''): void {
    if (this.closed) return;
    this.closed = true;
    this.closeCode = code;
    this.closeReason = reason;
    this.readyState = 3; // CLOSED
    this.emit('close', { code, reason });
    if (this.peer && !this.peer.closed) {
      this.peer.closed = true;
      this.peer.closeCode = code;
      this.peer.closeReason = reason;
      this.peer.readyState = 3;
      this.peer.emit('close', { code, reason });
    }
  }

  accept(): void {
    this.readyState = 1;
  }

  serializeAttachment(value: unknown): void {
    this.attachment = structuredClone(value);
  }

  deserializeAttachment(): unknown {
    return this.attachment === undefined ? undefined : structuredClone(this.attachment);
  }

  addEventListener(event: string, listener: (...args: any[]) => void): void {
    this.on(event, listener);
  }

  removeEventListener(event: string, listener: (...args: any[]) => void): void {
    this.off(event, listener);
  }
}
