import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { setupSocketRoutes } from './socket.js';

describe('Mediasoup socket lifecycle', () => {
  it('cleans participant resources during disconnecting, before room memberships disappear', async () => {
    const handlers = new Map<string, (...args: any[]) => unknown>();
    const socket = {
      user: { userId: 'user-1', email: 'user-1@meetlite.test' },
      id: 'socket-1',
      rooms: new Set(['socket-1', 'room-1']),
      on(event: string, handler: (...args: any[]) => unknown) {
        handlers.set(event, handler);
      },
    };
    const io = {
      on(event: string, handler: (connectedSocket: any) => void) {
        assert.equal(event, 'connection');
        handler(socket);
      },
    };
    const disconnectCalls: unknown[] = [];
    const noOpController = new Proxy({}, { get: () => () => undefined });
    const roomController = {
      ...noOpController,
      handleDisconnect(receivedSocket: unknown) {
        disconnectCalls.push(receivedSocket);
      },
      handleUserLeft() {},
      handleLeaveRoom() {},
    };

    setupSocketRoutes(
      io as any,
      noOpController,
      noOpController,
      roomController,
      noOpController
    );

    assert.equal(handlers.has('disconnecting'), true);
    assert.equal(handlers.has('disconnect'), false);
    await handlers.get('disconnecting')?.();
    assert.deepEqual(disconnectCalls, [socket]);
  });
});
