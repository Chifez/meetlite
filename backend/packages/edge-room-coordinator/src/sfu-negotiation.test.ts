import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  AsymmetricCapabilityService,
  generateEd25519KeyPair,
} from '@minimeet/shared';
import { RoomCoordinatorDO } from './room-coordinator.do.js';
import { InMemoryRoomStorage } from './storage.js';
import { MockSfuSessionAdapter } from './sfu-adapter.js';
import { MockWebSocket } from './mock-websocket.js';

describe('S2-02: Realtime SFU Session Broker & WebRTC SDP Negotiation Pipeline', () => {
  let capabilityService: AsymmetricCapabilityService;
  let keyPair: ReturnType<typeof generateEd25519KeyPair>;
  let sfuAdapter: MockSfuSessionAdapter;
  let storage: InMemoryRoomStorage;
  let coordinator: RoomCoordinatorDO;

  beforeEach(() => {
    keyPair = generateEd25519KeyPair('test-sfu-kid');
    capabilityService = new AsymmetricCapabilityService({
      privateKeyPem: keyPair.privateKeyPem,
      publicKeyPem: keyPair.publicKeyPem,
      keyId: keyPair.keyId,
    });

    sfuAdapter = new MockSfuSessionAdapter();
    storage = new InMemoryRoomStorage();
    coordinator = new RoomCoordinatorDO({}, {}, storage, sfuAdapter);
    coordinator.setPublicKeyJwk(keyPair.publicKeyJwk);
  });

  it('allocates separate publisher and subscriber SFU sessions upon admission', async () => {
    const [clientWs, serverWs] = MockWebSocket.createPair();
    const token = capabilityService.issueRoomCapability({
      sub: 'usr_alice_sfu',
      roomId: 'room_sfu_1',
      role: 'host',
    });

    const context = await coordinator.handleAdmitSocket(serverWs, token, 'room_sfu_1');

    assert.ok(context.publisherSessionId);
    assert.ok(context.subscriberSessionId);
    assert.notEqual(context.publisherSessionId, context.subscriberSessionId);

    // Verify SFU adapter created both sessions
    assert.ok(sfuAdapter.isSessionActive(context.publisherSessionId));
    assert.ok(sfuAdapter.isSessionActive(context.subscriberSessionId));

    // Verify client received media_session_ready
    const mediaReady = clientWs.receivedMessages.find((m) => m.type === 'media_session_ready');
    assert.ok(mediaReady);
    assert.equal(mediaReady.publisherSessionId, context.publisherSessionId);
    assert.equal(mediaReady.subscriberSessionId, context.subscriberSessionId);
  });

  it('performs publish_media SDP offer/answer exchange and notifies peers', async () => {
    const [aliceClient, aliceServer] = MockWebSocket.createPair();
    const [bobClient, bobServer] = MockWebSocket.createPair();

    const aliceToken = capabilityService.issueRoomCapability({
      sub: 'usr_alice_pub',
      roomId: 'room_negotiate',
      role: 'host',
    });
    const bobToken = capabilityService.issueRoomCapability({
      sub: 'usr_bob_sub',
      roomId: 'room_negotiate',
      role: 'participant',
    });

    await coordinator.handleAdmitSocket(aliceServer, aliceToken, 'room_negotiate');
    await coordinator.handleAdmitSocket(bobServer, bobToken, 'room_negotiate');

    // Alice sends WebRTC SDP offer
    const mockOfferSdp = 'v=0\r\no=- 111 2 IN IP4 127.0.0.1\r\ns=-\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n';
    await coordinator.handleMessage(aliceServer, {
      type: 'publish_media',
      kind: 'video',
      sdpOffer: mockOfferSdp,
      mid: '0',
      simulcast: true,
    });

    // Alice receives publish_media_success with SDP answer
    const successMsg = aliceClient.receivedMessages.find((m) => m.type === 'publish_media_success');
    assert.ok(successMsg);
    assert.ok(successMsg.sdpAnswer.includes('v=0'));
    assert.equal(successMsg.publication.kind, 'video');
    assert.ok(successMsg.publication.sfuTrackId);

    // Bob receives publication_added notification
    const pubAdded = bobClient.receivedMessages.find((m) => m.type === 'publication_added');
    assert.ok(pubAdded);
    assert.equal(pubAdded.publication.publicationId, successMsg.publication.publicationId);
  });

  it('performs subscribe_media negotiation pulling remote publisher tracks', async () => {
    const [, aliceServer] = MockWebSocket.createPair();
    const [bobClient, bobServer] = MockWebSocket.createPair();

    const aliceToken = capabilityService.issueRoomCapability({
      sub: 'usr_alice_streamer',
      roomId: 'room_bridge',
      role: 'host',
    });
    const bobToken = capabilityService.issueRoomCapability({
      sub: 'usr_bob_viewer',
      roomId: 'room_bridge',
      role: 'participant',
    });

    await coordinator.handleAdmitSocket(aliceServer, aliceToken, 'room_bridge');
    await coordinator.handleAdmitSocket(bobServer, bobToken, 'room_bridge');

    // Alice publishes camera track
    await coordinator.handleMessage(aliceServer, {
      type: 'publish_media',
      kind: 'video',
      sdpOffer: 'mock-offer-alice-cam',
      mid: '0',
    });

    const snapshot = await storage.getSnapshot('room_bridge');
    const pubId = snapshot.publications[0].publicationId;

    const subscription = coordinator.handleMessage(bobServer, {
      type: 'subscribe_media',
      publicationIds: [pubId],
      requestId: 'req-bob-sub',
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    const subOffer = bobClient.receivedMessages.find((m) => m.type === 'subscribe_media_offer');
    assert.ok(subOffer);
    await coordinator.handleMessage(bobServer, {
      type: 'renegotiate_media',
      requestId: 'req-bob-sub',
      sdpAnswer: 'mock-answer-bob-sub',
    });
    await subscription;

    // Bob receives success after the answer is forwarded to Cloudflare.
    const subSuccess = bobClient.receivedMessages.find((m) => m.type === 'subscribe_media_success');
    assert.ok(subSuccess);
    assert.ok(Array.isArray(subSuccess.tracks));
    assert.ok(subSuccess.tracks.length > 0);
  });

  it('rejects unauthorized publish_media attempt by viewer role', async () => {
    const [viewerClient, viewerServer] = MockWebSocket.createPair();

    const viewerToken = capabilityService.issueRoomCapability({
      sub: 'usr_viewer_denied',
      roomId: 'room_perm_check',
      role: 'viewer', // viewer has no publish permissions
    });

    await coordinator.handleAdmitSocket(viewerServer, viewerToken, 'room_perm_check');

    await coordinator.handleMessage(viewerServer, {
      type: 'publish_media',
      kind: 'video',
      sdpOffer: 'mock-offer',
    });

    const err = viewerClient.receivedMessages.find((m) => m.code === 'FORBIDDEN_PUBLISH');
    assert.ok(err);
    assert.match(err.message, /lacks publish_video permission/);
  });

  it('tears down active SFU publisher and subscriber sessions upon disconnect', async () => {
    const [, serverWs] = MockWebSocket.createPair();
    const token = capabilityService.issueRoomCapability({
      sub: 'usr_teardown',
      roomId: 'room_teardown',
    });

    const context = await coordinator.handleAdmitSocket(serverWs, token, 'room_teardown');
    const pubSession = context.publisherSessionId!;
    const subSession = context.subscriberSessionId!;

    assert.ok(sfuAdapter.isSessionActive(pubSession));
    assert.ok(sfuAdapter.isSessionActive(subSession));

    // Participant leaves/disconnects
    await coordinator.handleDisconnect(serverWs);

    // Both SFU sessions must be cleanly closed
    assert.equal(sfuAdapter.isSessionActive(pubSession), false);
    assert.equal(sfuAdapter.isSessionActive(subSession), false);
  });

  it('fails admission closed when SFU session allocation fails', async () => {
    const [clientWs, serverWs] = MockWebSocket.createPair();
    sfuAdapter.shouldSimulateFailure = true;

    const token = capabilityService.issueRoomCapability({
      sub: 'usr_fault_tolerance',
      roomId: 'room_fault',
    });

    await assert.rejects(
      coordinator.handleAdmitSocket(serverWs, token, 'room_fault'),
      /Simulated SFU Failure/
    );

    // No membership is committed and the caller does not receive a false joined state.
    const joined = clientWs.receivedMessages.find((m) => m.type === 'joined');
    assert.equal(joined, undefined);
    assert.equal((await storage.listMemberships()).length, 0);
    assert.equal(serverWs.closed, true);
  });
});
