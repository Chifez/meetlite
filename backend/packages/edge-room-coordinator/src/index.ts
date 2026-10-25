import { RoomCoordinatorDO, RoomCoordinatorEnv } from './room-coordinator.do.js';

export { RoomCoordinatorDO };
export type { RoomCoordinatorEnv };
export * from './types.js';
export * from './storage.js';
export * from './sfu-adapter.js';
export * from './collaboration-manager.js';
export * from './hyperdrive-client.js';
export * from './spend-alarm.js';

export default {
  async fetch(request: Request, env: RoomCoordinatorEnv, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/live' || url.pathname === '/ready') {
      return new Response(
        JSON.stringify({
          status: 'healthy',
          service: 'edge-room-coordinator',
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT || 'local',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Match /rooms/:roomId/*
    const match = url.pathname.match(/^\/rooms\/([^/]+)(\/.*)?$/);
    if (match) {
      const roomId = decodeURIComponent(match[1]);
      if (!env.ROOM_COORDINATOR) {
        return new Response(
          JSON.stringify({ error: 'ROOM_COORDINATOR Durable Object binding not available' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Canonical routing: exactly one Durable Object per roomId
      const id = env.ROOM_COORDINATOR.idFromName(roomId);
      const stub = env.ROOM_COORDINATOR.get(id);

      // Forward request to Durable Object
      return stub.fetch(request);
    }

    return new Response(
      JSON.stringify({
        error: 'Not found',
        availableRoutes: [
          'GET /health',
          'GET /rooms/:roomId/websocket?token=<capability_token>',
          'GET /rooms/:roomId/snapshot',
          'POST /rooms/:roomId/terminate',
        ],
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  },
};
