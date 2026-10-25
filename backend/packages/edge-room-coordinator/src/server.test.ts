import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import {
  AsymmetricCapabilityService,
  generateEd25519KeyPair,
} from '@minimeet/shared';
import { createEdgeRoomCoordinatorServer } from './server.js';

describe('S2-01: Local Edge Coordinator Server (HTTP + Live WebSocket E2E)', () => {
  const TEST_PORT = 18787;
  let serverInstance: ReturnType<typeof createEdgeRoomCoordinatorServer>;
  let capabilityService: AsymmetricCapabilityService;
  let keyPair: ReturnType<typeof generateEd25519KeyPair>;

  before(async () => {
    keyPair = generateEd25519KeyPair('test-local-server-kid');
    capabilityService = new AsymmetricCapabilityService({
      privateKeyPem: keyPair.privateKeyPem,
      publicKeyPem: keyPair.publicKeyPem,
      keyId: keyPair.keyId,
    });

    serverInstance = createEdgeRoomCoordinatorServer(TEST_PORT, keyPair.publicKeyJwk);
    await serverInstance.listen();
  });

  after(async () => {
    await serverInstance.close();
  });

  it('serves HTTP GET /health over real network port with 200 OK', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.status, 'healthy');
    assert.equal(body.service, 'edge-room-coordinator');
    assert.equal(body.environment, 'local-docker');
  });

  it('handles live WebSocket connection, token admission, and chat broadcast over network', async () => {
    const roomId = 'live_net_room_1';

    const tokenAlice = capabilityService.issueRoomCapability({
      sub: 'usr_alice_live',
      roomId,
      role: 'host',
    });

    const tokenBob = capabilityService.issueRoomCapability({
      sub: 'usr_bob_live',
      roomId,
      role: 'participant',
    });

    // Connect Alice over real WebSocket
    const wsAlice = new WebSocket(`ws://127.0.0.1:${TEST_PORT}/rooms/${roomId}/websocket?token=${tokenAlice}`);
    const aliceReceived: any[] = [];
    wsAlice.on('message', (data: any) => {
      aliceReceived.push(JSON.parse(data.toString()));
    });

    await new Promise<void>((resolve, reject) => {
      wsAlice.on('open', () => resolve());
      wsAlice.on('error', reject);
    });

    // Wait for Alice's 'joined' confirmation
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (aliceReceived.some((m) => m.type === 'joined')) {
          clearInterval(check);
          resolve();
        }
      }, 20);
    });

    // Connect Bob over real WebSocket
    const wsBob = new WebSocket(`ws://127.0.0.1:${TEST_PORT}/rooms/${roomId}/websocket?token=${tokenBob}`);
    const bobReceived: any[] = [];
    wsBob.on('message', (data: any) => {
      bobReceived.push(JSON.parse(data.toString()));
    });

    await new Promise<void>((resolve, reject) => {
      wsBob.on('open', () => resolve());
      wsBob.on('error', reject);
    });

    // Alice should receive participant_joined for Bob
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (aliceReceived.some((m) => m.type === 'participant_joined' && m.participant?.userId === 'usr_bob_live')) {
          clearInterval(check);
          resolve();
        }
      }, 20);
    });

    // Alice sends chat message
    wsAlice.send(JSON.stringify({ type: 'chat', text: 'Live WebSocket Test Passed!' }));

    // Bob receives chat with verified senderId
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        const msg = bobReceived.find((m) => m.type === 'chat_message');
        if (msg && msg.text === 'Live WebSocket Test Passed!' && msg.senderId === 'usr_alice_live') {
          clearInterval(check);
          resolve();
        }
      }, 20);
    });

    wsAlice.close();
    wsBob.close();
  });
});
