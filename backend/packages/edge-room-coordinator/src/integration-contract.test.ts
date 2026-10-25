import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import {
  AsymmetricCapabilityService,
  generateEd25519KeyPair,
} from '@minimeet/shared';
import { RoomCoordinatorDO } from './room-coordinator.do.js';
import { InMemoryRoomStorage } from './storage.js';
import { MockSfuSessionAdapter } from './sfu-adapter.js';
import { MockWebSocket } from './mock-websocket.js';

describe('S2-03: End-to-End Client-Coordinator Integration & Protocol Contract', () => {
  let capabilityService: AsymmetricCapabilityService;
  let keyPair: ReturnType<typeof generateEd25519KeyPair>;
  let sfuAdapter: MockSfuSessionAdapter;
  let storage: InMemoryRoomStorage;
  let coordinator: RoomCoordinatorDO;

  beforeEach(async () => {
    keyPair = generateEd25519KeyPair('integration-contract-kid');
    capabilityService = new AsymmetricCapabilityService({
      privateKeyPem: keyPair.privateKeyPem,
      publicKeyPem: keyPair.publicKeyPem,
      keyId: keyPair.keyId,
    });

    sfuAdapter = new MockSfuSessionAdapter();
    storage = new InMemoryRoomStorage();
    await storage.initialize();

    coordinator = new RoomCoordinatorDO(
      {},
      { CAPABILITY_AUDIENCE: 'meetlite-edge-coordinator' },
      storage,
      sfuAdapter
    );
    coordinator.setPublicKeyJwk(keyPair.publicKeyJwk);
  });

  it('exchanges dual-property SDP offer/answers and preserves requestId correlation', async () => {
    const [aliceClient, aliceServer] = MockWebSocket.createPair();
    const [bobClient, bobServer] = MockWebSocket.createPair();

    const aliceToken = capabilityService.issueRoomCapability({
      sub: 'usr_alice',
      roomId: 'room_contract_1',
      role: 'host',
    });
    const bobToken = capabilityService.issueRoomCapability({
      sub: 'usr_bob',
      roomId: 'room_contract_1',
      role: 'participant',
    });

    await coordinator.handleAdmitSocket(aliceServer, aliceToken, 'room_contract_1');
    await coordinator.handleAdmitSocket(bobServer, bobToken, 'room_contract_1');

    // Alice publishes video sending offerSdp (client format) and requestId
    const mockOfferSdp = 'v=0\r\no=- 42 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n';
    await coordinator.handleMessage(aliceServer, {
      type: 'publish_media',
      kind: 'video',
      offerSdp: mockOfferSdp,
      mid: '0',
      requestId: 'req_pub_123',
      simulcast: true,
    });

    // Verify Alice receives publish_media_success with both flat and nested properties + requestId
    const aliceSuccess = aliceClient.receivedMessages.find((m) => m.type === 'publish_media_success');
    assert.ok(aliceSuccess, 'Alice must receive publish_media_success');
    assert.equal(aliceSuccess.requestId, 'req_pub_123', 'requestId must correlate');
    assert.ok(aliceSuccess.publicationId, 'Flat publicationId must be present');
    assert.ok(aliceSuccess.sfuTrackId, 'Flat sfuTrackId must be present');
    assert.ok(aliceSuccess.answerSdp, 'Flat answerSdp must be present');
    assert.ok(aliceSuccess.sdpAnswer, 'sdpAnswer must be present for backwards compatibility');
    assert.equal(aliceSuccess.publication?.kind, 'video', 'Nested publication must match');
    assert.equal(aliceSuccess.publication?.publicationId, aliceSuccess.publicationId);

    // Verify Bob receives publication_added with both flat and nested properties
    const bobPubAdded = bobClient.receivedMessages.find((m) => m.type === 'publication_added');
    assert.ok(bobPubAdded, 'Bob must receive publication_added');
    assert.equal(bobPubAdded.publicationId, aliceSuccess.publicationId);
    assert.equal(bobPubAdded.sfuTrackId, aliceSuccess.sfuTrackId);
    assert.equal(bobPubAdded.kind, 'video');
    assert.equal(bobPubAdded.publication?.publicationId, aliceSuccess.publicationId);

    // Bob subscribes using tracks array with publicationId (client format)
    const subscription = coordinator.handleMessage(bobServer, {
      type: 'subscribe_media',
      tracks: [{ publicationId: bobPubAdded.publicationId }],
      requestId: 'req_sub_456',
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    const bobOffer = bobClient.receivedMessages.find((m) => m.type === 'subscribe_media_offer');
    assert.ok(bobOffer, 'Bob must receive the SFU subscription offer');
    await coordinator.handleMessage(bobServer, {
      type: 'renegotiate_media',
      requestId: 'req_sub_456',
      sdpAnswer: 'v=0\r\ns=browser-answer\r\n',
    });
    await subscription;

    // Bob receives completion only after the browser answer is accepted.
    const bobSuccess = bobClient.receivedMessages.find((m) => m.type === 'subscribe_media_success');
    assert.ok(bobSuccess, 'Bob must receive subscribe_media_success');
    assert.equal(bobSuccess.requestId, 'req_sub_456', 'Subscription requestId must correlate');
    assert.ok(Array.isArray(bobSuccess.tracks), 'Subscribed tracks list must be present');
  });

  it('coordinates real-time Yjs CRDT collaboration and awareness state across peers', async () => {
    const [aliceClient, aliceServer] = MockWebSocket.createPair();
    const [bobClient, bobServer] = MockWebSocket.createPair();

    const aliceToken = capabilityService.issueRoomCapability({
      sub: 'usr_alice_crdt',
      roomId: 'room_crdt_doc',
      role: 'host',
    });
    const bobToken = capabilityService.issueRoomCapability({
      sub: 'usr_bob_crdt',
      roomId: 'room_crdt_doc',
      role: 'participant',
    });

    await coordinator.handleAdmitSocket(aliceServer, aliceToken, 'room_crdt_doc');
    await coordinator.handleAdmitSocket(bobServer, bobToken, 'room_crdt_doc');

    // 1. Alice creates Yjs update (e.g. text edit in whiteboard notes)
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText('notes');
    let binaryUpdate: Uint8Array | null = null;
    ydoc.on('update', (u: Uint8Array) => {
      binaryUpdate = u;
    });
    ytext.insert(0, 'MeetLite scalable edge collaboration');

    assert.ok(binaryUpdate, 'Yjs binary update must be generated');
    const updateB64 = Buffer.from(binaryUpdate).toString('base64');

    // Alice dispatches collab_update
    await coordinator.handleMessage(aliceServer, {
      type: 'collab_update',
      documentName: 'whiteboard_main',
      update: updateB64,
    });

    // Bob receives collab_update
    const bobCollabMsg = bobClient.receivedMessages.find((m) => m.type === 'collab_update');
    assert.ok(bobCollabMsg, 'Bob must receive broadcasted collab_update');
    assert.equal(bobCollabMsg.documentName, 'whiteboard_main');
    assert.equal(bobCollabMsg.update, updateB64);

    // Apply update to Bob's local Yjs doc
    const bobDoc = new Y.Doc();
    const bobText = bobDoc.getText('notes');
    Y.applyUpdate(bobDoc, Buffer.from(bobCollabMsg.update, 'base64'));
    assert.equal(bobText.toString(), 'MeetLite scalable edge collaboration');

    // 2. Alice sends awareness_update (cursor / presence)
    const awarenessPayload = Buffer.from(JSON.stringify({ x: 120, y: 350, user: 'Alice' })).toString('base64');
    await coordinator.handleMessage(aliceServer, {
      type: 'awareness_update',
      documentName: 'whiteboard_main',
      state: awarenessPayload,
    });

    // Bob receives awareness_broadcast
    const bobAwareness = bobClient.receivedMessages.find((m) => m.type === 'awareness_broadcast');
    assert.ok(bobAwareness, 'Bob must receive awareness_broadcast');
    assert.equal(bobAwareness.documentName, 'whiteboard_main');
    assert.ok(bobAwareness.states.length > 0);
    assert.equal(bobAwareness.states[0].state, awarenessPayload);

    // 3. New / reconnected participant syncs document state via collab_sync
    const [charlieClient, charlieServer] = MockWebSocket.createPair();
    const charlieToken = capabilityService.issueRoomCapability({
      sub: 'usr_charlie_sync',
      roomId: 'room_crdt_doc',
      role: 'participant',
    });
    await coordinator.handleAdmitSocket(charlieServer, charlieToken, 'room_crdt_doc');

    await coordinator.handleMessage(charlieServer, {
      type: 'collab_sync',
      documentName: 'whiteboard_main',
      requestId: 'req_sync_789',
    });

    const charlieSnapshot = charlieClient.receivedMessages.find((m) => m.type === 'collab_snapshot');
    assert.ok(charlieSnapshot, 'Charlie must receive collab_snapshot');
    assert.equal(charlieSnapshot.documentName, 'whiteboard_main');
    assert.equal(charlieSnapshot.requestId, 'req_sync_789');
    assert.ok(charlieSnapshot.snapshot, 'Snapshot payload must not be null');
  });

  it('enforces generational replacement and isolates old SFU session resources', async () => {
    const [aliceClient1, aliceServer1] = MockWebSocket.createPair();
    const [bobClient, bobServer] = MockWebSocket.createPair();

    const aliceToken1 = capabilityService.issueRoomCapability({
      sub: 'usr_reconnect_alice',
      roomId: 'room_gen_replace',
      role: 'host',
    });
    const bobToken = capabilityService.issueRoomCapability({
      sub: 'usr_bob_observer',
      roomId: 'room_gen_replace',
      role: 'participant',
    });

    const ctx1 = await coordinator.handleAdmitSocket(aliceServer1, aliceToken1, 'room_gen_replace');
    await coordinator.handleAdmitSocket(bobServer, bobToken, 'room_gen_replace');

    const oldPubSession = ctx1.publisherSessionId!;
    const oldSubSession = ctx1.subscriberSessionId!;
    assert.ok(sfuAdapter.isSessionActive(oldPubSession));
    assert.ok(sfuAdapter.isSessionActive(oldSubSession));

    // Alice publishes a track
    await coordinator.handleMessage(aliceServer1, {
      type: 'publish_media',
      kind: 'audio',
      offerSdp: 'v=0\r\ns=alice-mic\r\n',
      mid: '0',
    });

    // Now Alice reconnects (newer generation)
    const [aliceClient2, aliceServer2] = MockWebSocket.createPair();
    const aliceToken2 = capabilityService.issueRoomCapability({
      sub: 'usr_reconnect_alice',
      roomId: 'room_gen_replace',
      role: 'host',
    });

    const ctx2 = await coordinator.handleAdmitSocket(aliceServer2, aliceToken2, 'room_gen_replace');
    assert.equal(ctx2.generation, ctx1.generation + 1, 'Generation must increment');
    assert.notEqual(ctx2.publisherSessionId, oldPubSession, 'New publisher session must be allocated');

    // Old socket must be closed with SESSION_REPLACED
    assert.ok(aliceServer1.closed);
    const sessionReplacedMsg = aliceClient1.receivedMessages.find((m) => m.code === 'SESSION_REPLACED');
    assert.ok(sessionReplacedMsg, 'Old connection must receive SESSION_REPLACED');

    // Old SFU sessions must be closed
    assert.equal(sfuAdapter.isSessionActive(oldPubSession), false, 'Old publisher SFU session must be torn down');
    assert.equal(sfuAdapter.isSessionActive(oldSubSession), false, 'Old subscriber SFU session must be torn down');
  });
});
