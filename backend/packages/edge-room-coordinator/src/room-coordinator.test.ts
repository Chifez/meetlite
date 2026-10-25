import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  AsymmetricCapabilityService,
  createVerifiedPrincipal,
  generateEd25519KeyPair,
} from '@minimeet/shared';
import { RoomCoordinatorDO } from './room-coordinator.do.js';
import { InMemoryRoomStorage } from './storage.js';
import { MockWebSocket } from './mock-websocket.js';
import worker from './index.js';

describe('S2-01: Edge Room Coordinator (Cloudflare Durable Object & WebSockets)', () => {
  let capabilityService: AsymmetricCapabilityService;
  let keyPair: ReturnType<typeof generateEd25519KeyPair>;

  beforeEach(() => {
    keyPair = generateEd25519KeyPair('test-edge-kid');
    capabilityService = new AsymmetricCapabilityService({
      privateKeyPem: keyPair.privateKeyPem,
      publicKeyPem: keyPair.publicKeyPem,
      keyId: keyPair.keyId,
    });
  });

  it('worker health probe returns 200 OK with service identifier', async () => {
    const req = new Request('https://edge.meetlite.dev/health');
    const res = await worker.fetch(req, { ENVIRONMENT: 'test' }, {});
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.status, 'healthy');
    assert.equal(body.service, 'edge-room-coordinator');
    assert.equal(body.environment, 'test');
  });

  it('worker returns 404 with helpful routes on unhandled path', async () => {
    const req = new Request('https://edge.meetlite.dev/unknown-route');
    const res = await worker.fetch(req, {}, {});
    assert.equal(res.status, 404);
    const body = (await res.json()) as any;
    assert.ok(body.error);
    assert.ok(Array.isArray(body.availableRoutes));
  });

  it('admits participant with valid Ed25519 capability token and initializes room state', async () => {
    const storage = new InMemoryRoomStorage();
    const coordinator = new RoomCoordinatorDO({}, {}, storage);
    coordinator.setPublicKeyJwk(keyPair.publicKeyJwk);

    const [clientWs, serverWs] = MockWebSocket.createPair();

    const principal = createVerifiedPrincipal({
      userId: 'usr_alice',
      organizationId: 'org_test',
      role: 'owner',
    });

    const token = capabilityService.issueRoomCapabilityFromPrincipal(
      principal,
      'room_scale_101',
      'host'
    );

    const context = await coordinator.handleAdmitSocket(serverWs, token, 'room_scale_101');
    assert.equal(context.userId, 'usr_alice');
    assert.equal(context.role, 'host');
    assert.equal(context.generation, 1);

    // Verify client received 'joined' message and 'media_session_ready'
    const joinedMsg = clientWs.receivedMessages.find((m) => m.type === 'joined');
    assert.ok(joinedMsg);
    assert.equal(joinedMsg.revision, 1);
    assert.equal(joinedMsg.snapshot.roomId, 'room_scale_101');
    assert.equal(joinedMsg.snapshot.participants.length, 1);
    assert.equal(joinedMsg.snapshot.participants[0].userId, 'usr_alice');

    const mediaReady = clientWs.receivedMessages.find((m) => m.type === 'media_session_ready');
    assert.ok(mediaReady);
  });

  it('enforces single-use capability token (replay attack prevention)', async () => {
    const storage = new InMemoryRoomStorage();
    const coordinator = new RoomCoordinatorDO({}, {}, storage);
    coordinator.setPublicKeyJwk(keyPair.publicKeyJwk);

    const [, serverWs1] = MockWebSocket.createPair();
    const [, serverWs2] = MockWebSocket.createPair();

    const token = capabilityService.issueRoomCapability({
      sub: 'usr_single_use',
      roomId: 'room_replay_test',
    });

    // First use succeeds
    await coordinator.handleAdmitSocket(serverWs1, token, 'room_replay_test');

    // Attacker tries to replay the exact same capability token
    await assert.rejects(
      async () => {
        await coordinator.handleAdmitSocket(serverWs2, token, 'room_replay_test');
      },
      /already been consumed/
    );
  });

  it('rejects capability token with room mismatch', async () => {
    const storage = new InMemoryRoomStorage();
    const coordinator = new RoomCoordinatorDO({}, {}, storage);
    coordinator.setPublicKeyJwk(keyPair.publicKeyJwk);

    const [, serverWs] = MockWebSocket.createPair();

    // Token issued for room_A
    const token = capabilityService.issueRoomCapability({
      sub: 'usr_mismatch',
      roomId: 'room_A',
    });

    // Presented to coordinator for room_B
    await assert.rejects(
      async () => {
        await coordinator.handleAdmitSocket(serverWs, token, 'room_B');
      },
      /does not match expected room/
    );
  });

  it('protects snapshot and room termination HTTP endpoints with room-scoped capabilities', async () => {
    const storage = new InMemoryRoomStorage();
    const coordinator = new RoomCoordinatorDO({}, {}, storage);
    coordinator.setPublicKeyJwk(keyPair.publicKeyJwk);

    const hostToken = capabilityService.issueRoomCapability({
      sub: 'usr_host',
      roomId: 'room_http_auth',
      role: 'host',
    });
    const viewerToken = capabilityService.issueRoomCapability({
      sub: 'usr_viewer',
      roomId: 'room_http_auth',
      role: 'viewer',
    });

    const unauthenticatedSnapshot = await coordinator.fetch(
      new Request('https://edge.test/rooms/room_http_auth/snapshot')
    );
    assert.equal(unauthenticatedSnapshot.status, 401);

    const authenticatedSnapshot = await coordinator.fetch(
      new Request('https://edge.test/rooms/room_http_auth/snapshot', {
        headers: { authorization: `Bearer ${viewerToken}` },
      })
    );
    assert.equal(authenticatedSnapshot.status, 200);

    const viewerTerminate = await coordinator.fetch(
      new Request('https://edge.test/rooms/room_http_auth/terminate', {
        method: 'POST',
        headers: { authorization: `Bearer ${viewerToken}` },
      })
    );
    assert.equal(viewerTerminate.status, 403);

    const hostTerminate = await coordinator.fetch(
      new Request('https://edge.test/rooms/room_http_auth/terminate', {
        method: 'POST',
        headers: { authorization: `Bearer ${hostToken}` },
      })
    );
    assert.equal(hostTerminate.status, 200);
  });

  it('supersedes older session generation when user reconnects (generational replacement)', async () => {
    const storage = new InMemoryRoomStorage();
    const coordinator = new RoomCoordinatorDO({}, {}, storage);
    coordinator.setPublicKeyJwk(keyPair.publicKeyJwk);

    const [clientWs1, serverWs1] = MockWebSocket.createPair();
    const [clientWs2, serverWs2] = MockWebSocket.createPair();

    const token1 = capabilityService.issueRoomCapability({
      sub: 'usr_reconnect',
      roomId: 'room_gen_test',
    });

    const token2 = capabilityService.issueRoomCapability({
      sub: 'usr_reconnect',
      roomId: 'room_gen_test',
    });

    // Alice connects from tab 1 (gen 1)
    const ctx1 = await coordinator.handleAdmitSocket(serverWs1, token1, 'room_gen_test');
    assert.equal(ctx1.generation, 1);

    // Alice connects from tab 2 (gen 2)
    const ctx2 = await coordinator.handleAdmitSocket(serverWs2, token2, 'room_gen_test');
    assert.equal(ctx2.generation, 2);

    // Old socket was notified and closed
    assert.equal(serverWs1.closed, true);
    assert.equal(serverWs1.closeCode, 4001);

    // Latest snapshot shows single participant
    const snapshot = await storage.getSnapshot('room_gen_test');
    assert.equal(snapshot.participants.length, 1);
  });

  it('preserves capacity and generation authority across coordinator eviction', async () => {
    const storage = new InMemoryRoomStorage();
    const firstCoordinator = new RoomCoordinatorDO({}, {}, storage);
    firstCoordinator.setPublicKeyJwk(keyPair.publicKeyJwk);
    const [, firstSocket] = MockWebSocket.createPair();
    const firstToken = capabilityService.issueRoomCapability({
      sub: 'usr_eviction',
      roomId: 'room_eviction',
    });
    const firstContext = await firstCoordinator.handleAdmitSocket(
      firstSocket,
      firstToken,
      'room_eviction'
    );

    const restartedCoordinator = new RoomCoordinatorDO({}, {}, storage);
    restartedCoordinator.setPublicKeyJwk(keyPair.publicKeyJwk);
    const [, replacementSocket] = MockWebSocket.createPair();
    const replacementToken = capabilityService.issueRoomCapability({
      sub: 'usr_eviction',
      roomId: 'room_eviction',
    });
    const replacementContext = await restartedCoordinator.handleAdmitSocket(
      replacementSocket,
      replacementToken,
      'room_eviction'
    );

    assert.equal(replacementContext.generation, firstContext.generation + 1);
    assert.equal((await storage.listMemberships()).length, 1);
  });

  it('enforces track publication permissions and notifies peers', async () => {
    const storage = new InMemoryRoomStorage();
    const coordinator = new RoomCoordinatorDO({}, {}, storage);
    coordinator.setPublicKeyJwk(keyPair.publicKeyJwk);

    const [aliceClient, aliceServer] = MockWebSocket.createPair();
    const [bobClient, bobServer] = MockWebSocket.createPair();

    // Alice (host - can publish)
    const aliceToken = capabilityService.issueRoomCapability({
      sub: 'usr_alice',
      roomId: 'room_pub_test',
      role: 'host',
    });
    await coordinator.handleAdmitSocket(aliceServer, aliceToken, 'room_pub_test');

    // Bob (viewer - cannot publish)
    const bobToken = capabilityService.issueRoomCapability({
      sub: 'usr_bob',
      roomId: 'room_pub_test',
      role: 'viewer',
    });
    await coordinator.handleAdmitSocket(bobServer, bobToken, 'room_pub_test');

    // Alice publishes video track
    await coordinator.handleMessage(aliceServer, {
      type: 'publish',
      kind: 'video',
      simulcast: true,
    });

    // Alice gets publish_success
    const aliceSuccess = aliceClient.receivedMessages.find((m) => m.type === 'publish_success');
    assert.ok(aliceSuccess);
    assert.equal(aliceSuccess.publication.kind, 'video');
    assert.equal(aliceSuccess.publication.simulcast, true);

    // Bob receives publication_added notification
    const bobNotification = bobClient.receivedMessages.find((m) => m.type === 'publication_added');
    assert.ok(bobNotification);
    assert.equal(bobNotification.publication.kind, 'video');

    // Bob (viewer) attempts to publish video -> rejected
    await coordinator.handleMessage(bobServer, {
      type: 'publish',
      kind: 'video',
    });

    const bobError = bobClient.receivedMessages.find((m) => m.code === 'FORBIDDEN_PUBLISH');
    assert.ok(bobError);
  });

  it('enforces track withdrawal ownership and moderation authority', async () => {
    const storage = new InMemoryRoomStorage();
    const coordinator = new RoomCoordinatorDO({}, {}, storage);
    coordinator.setPublicKeyJwk(keyPair.publicKeyJwk);

    const [aliceClient, aliceServer] = MockWebSocket.createPair();
    const [bobClient, bobServer] = MockWebSocket.createPair();

    // Alice (participant - owns track)
    const aliceToken = capabilityService.issueRoomCapability({
      sub: 'usr_alice',
      roomId: 'room_withdraw_test',
      role: 'participant',
    });
    await coordinator.handleAdmitSocket(aliceServer, aliceToken, 'room_withdraw_test');

    // Bob (participant without moderate permission)
    const bobToken = capabilityService.issueRoomCapability({
      sub: 'usr_bob',
      roomId: 'room_withdraw_test',
      role: 'participant',
    });
    await coordinator.handleAdmitSocket(bobServer, bobToken, 'room_withdraw_test');

    // Alice publishes audio track
    await coordinator.handleMessage(aliceServer, {
      type: 'publish',
      kind: 'audio',
    });

    const aliceSuccess = aliceClient.receivedMessages.find((m) => m.type === 'publish_success');
    const pubId = aliceSuccess.publication.publicationId;

    // Bob attempts to withdraw Alice's track -> rejected
    await coordinator.handleMessage(bobServer, {
      type: 'withdraw',
      publicationId: pubId,
    });
    const bobErr = bobClient.receivedMessages.find((m) => m.code === 'FORBIDDEN_WITHDRAW');
    assert.ok(bobErr);

    // Alice withdraws her own track -> succeeds
    await coordinator.handleMessage(aliceServer, {
      type: 'withdraw',
      publicationId: pubId,
    });
    const aliceWithdraw = aliceClient.receivedMessages.find((m) => m.type === 'withdraw_success');
    assert.ok(aliceWithdraw);

    // Storage is updated
    const remainingPubs = await storage.listPublications();
    assert.equal(remainingPubs.length, 0);
  });

  it('broadcasts chat messages with server-verified sender identity', async () => {
    const storage = new InMemoryRoomStorage();
    const coordinator = new RoomCoordinatorDO({}, {}, storage);
    coordinator.setPublicKeyJwk(keyPair.publicKeyJwk);

    const [, aliceServer] = MockWebSocket.createPair();
    const [bobClient, bobServer] = MockWebSocket.createPair();

    const aliceToken = capabilityService.issueRoomCapability({
      sub: 'usr_alice_sender',
      roomId: 'room_chat_test',
      role: 'host',
    });
    await coordinator.handleAdmitSocket(aliceServer, aliceToken, 'room_chat_test');

    const bobToken = capabilityService.issueRoomCapability({
      sub: 'usr_bob_receiver',
      roomId: 'room_chat_test',
      role: 'participant',
    });
    await coordinator.handleAdmitSocket(bobServer, bobToken, 'room_chat_test');

    // Alice sends chat
    await coordinator.handleMessage(aliceServer, {
      type: 'chat',
      text: 'Hello Room 2026!',
    });

    // Bob receives chat with verified senderId
    const chatMsg = bobClient.receivedMessages.find((m) => m.type === 'chat_message');
    assert.ok(chatMsg);
    assert.equal(chatMsg.text, 'Hello Room 2026!');
    assert.equal(chatMsg.senderId, 'usr_alice_sender');
    assert.equal(chatMsg.senderRole, 'host');
  });

  it('rejects collaboration writes from read-only viewers', async () => {
    const storage = new InMemoryRoomStorage();
    const coordinator = new RoomCoordinatorDO({}, {}, storage);
    coordinator.setPublicKeyJwk(keyPair.publicKeyJwk);
    const [viewerClient, viewerServer] = MockWebSocket.createPair();
    const viewerToken = capabilityService.issueRoomCapability({
      sub: 'usr_read_only',
      roomId: 'room_read_only',
      role: 'viewer',
    });
    await coordinator.handleAdmitSocket(viewerServer, viewerToken, 'room_read_only');

    await coordinator.handleMessage(viewerServer, {
      type: 'collab_update',
      documentName: 'whiteboard_main',
      update: 'AQID',
    });

    assert.ok(viewerClient.receivedMessages.some((message) => message.code === 'FORBIDDEN_COLLABORATION'));
    assert.equal((await storage.listCollaborationUpdates('whiteboard_main')).length, 0);
  });

  it('cleans up participant publications and notifies peers on explicit leave', async () => {
    const storage = new InMemoryRoomStorage();
    const coordinator = new RoomCoordinatorDO({}, {}, storage);
    coordinator.setPublicKeyJwk(keyPair.publicKeyJwk);

    const [aliceClient, aliceServer] = MockWebSocket.createPair();
    const [, bobServer] = MockWebSocket.createPair();

    const aliceToken = capabilityService.issueRoomCapability({
      sub: 'usr_alice',
      roomId: 'room_leave_test',
      role: 'host',
    });
    await coordinator.handleAdmitSocket(aliceServer, aliceToken, 'room_leave_test');

    const bobToken = capabilityService.issueRoomCapability({
      sub: 'usr_bob',
      roomId: 'room_leave_test',
      role: 'participant',
    });
    const bobContext = await coordinator.handleAdmitSocket(bobServer, bobToken, 'room_leave_test');

    // Bob publishes screen share
    await coordinator.handleMessage(bobServer, {
      type: 'publish',
      kind: 'screen',
    });

    // Bob leaves
    await coordinator.handleMessage(bobServer, { type: 'leave' });

    // Alice received publication_removed and participant_left
    const pubRemoved = aliceClient.receivedMessages.find((m) => m.type === 'publication_removed');
    assert.ok(pubRemoved);

    const partLeft = aliceClient.receivedMessages.find((m) => m.type === 'participant_left');
    assert.ok(partLeft);
    assert.equal(partLeft.membershipId, bobContext.membershipId);
    assert.equal(partLeft.userId, 'usr_bob');

    // Storage is cleaned up
    const finalSnapshot = await storage.getSnapshot('room_leave_test');
    assert.equal(finalSnapshot.participants.length, 1);
    assert.equal(finalSnapshot.publications.length, 0);
  });
});
