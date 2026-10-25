import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import worker, { RoomCoordinatorDO } from './index.js';
import { InMemoryRoomStorage } from './storage.js';
import { ClientMessage } from './types.js';

export function createEdgeRoomCoordinatorServer(port = 8787, publicKeyJwk?: any) {
  const roomDoInstances = new Map<string, RoomCoordinatorDO>();

  const env = {
    ENVIRONMENT: 'local-docker',
    CAPABILITY_AUDIENCE: 'meetlite-edge-coordinator',
    CLOUDFLARE_CALLS_APP_ID: process.env.CLOUDFLARE_CALLS_APP_ID,
    CLOUDFLARE_CALLS_APP_SECRET: process.env.CLOUDFLARE_CALLS_APP_SECRET,
    ROOM_COORDINATOR: {
      idFromName(roomId: string) {
        return { toString: () => roomId, roomId };
      },
      get(idObj: any) {
        const roomId = idObj.roomId;
        if (!roomDoInstances.has(roomId)) {
          const coordinator = new RoomCoordinatorDO({}, env, new InMemoryRoomStorage());
          if (publicKeyJwk) {
            coordinator.setPublicKeyJwk(publicKeyJwk);
          }
          roomDoInstances.set(roomId, coordinator);
        }
        const instance = roomDoInstances.get(roomId)!;
        return {
          async fetch(req: Request) {
            return instance.fetch(req);
          },
        };
      },
    },
  };

  const server = http.createServer(async (req, res) => {
    const host = req.headers.host || `localhost:${port}`;
    const url = new URL(req.url || '/', `http://${host}`);

    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers.set(k, v);
      else if (Array.isArray(v)) v.forEach((val) => headers.append(k, val));
    }

    const webReq = new Request(url.toString(), {
      method: req.method,
      headers,
    });

    try {
      const webRes = await worker.fetch(webReq, env, {});
      res.statusCode = webRes.status;
      webRes.headers.forEach((v, k) => {
        res.setHeader(k, v);
      });
      const body = await webRes.text();
      res.end(body);
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const host = req.headers.host || `localhost:${port}`;
    const url = new URL(req.url || '/', `http://${host}`);
    const match = url.pathname.match(/^\/rooms\/([^/]+)(\/.*)?$/);

    if (!match) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    const roomId = decodeURIComponent(match[1]);
    const token = url.searchParams.get('token');

    wss.handleUpgrade(req, socket, head, async (ws: any) => {
      const coordinatorRef = env.ROOM_COORDINATOR.get(env.ROOM_COORDINATOR.idFromName(roomId));
      // Access coordinator directly for websocket routing
      const coordinatorInstance = roomDoInstances.get(roomId)!;

      if (token) {
        try {
          await coordinatorInstance.handleAdmitSocket(ws, token, roomId);
        } catch (err: any) {
          try {
            ws.send(
              JSON.stringify({
                type: 'error',
                code: 'AUTHENTICATION_FAILED',
                message: err.message || 'Invalid capability token',
              })
            );
            ws.close(4003, 'Unauthorized');
          } catch {
            // Ignore
          }
          return;
        }
      }

      ws.on('message', async (data: any) => {
        try {
          const parsed: ClientMessage = JSON.parse(data.toString());
          if (parsed.type === 'join' && parsed.token && !token) {
            await coordinatorInstance.handleAdmitSocket(ws, parsed.token, roomId);
          } else {
            await coordinatorInstance.handleMessage(ws, parsed);
          }
        } catch (err: any) {
          try {
            ws.send(
              JSON.stringify({
                type: 'error',
                code: 'INVALID_MESSAGE',
                message: err.message || 'Malformed message',
              })
            );
          } catch {
            // Ignore
          }
        }
      });

      ws.on('close', async () => {
        await coordinatorInstance.handleDisconnect(ws);
      });

      ws.on('error', async () => {
        await coordinatorInstance.handleDisconnect(ws);
      });
    });
  });

  return {
    server,
    wss,
    env,
    roomDoInstances,
    listen: (customPort = port) => {
      return new Promise<void>((resolve) => {
        server.listen(customPort, () => resolve());
      });
    },
    close: () => {
      return new Promise<void>((resolve) => {
        wss.close(() => {
          server.close(() => resolve());
        });
      });
    },
  };
}

if (process.env.NODE_ENV !== 'test' && process.env.RUN_STANDALONE === 'true') {
  const port = parseInt(process.env.PORT || '8787', 10);
  let pubKeyJwk: any;
  if (process.env.CAPABILITY_PUBLIC_KEY_JWK) {
    try {
      pubKeyJwk = JSON.parse(process.env.CAPABILITY_PUBLIC_KEY_JWK);
    } catch {
      // Ignored
    }
  }

  const { listen } = createEdgeRoomCoordinatorServer(port, pubKeyJwk);
  listen().then(() => {
    console.log(`[edge-room-coordinator] Local server listening on http://0.0.0.0:${port}`);
  });
}
