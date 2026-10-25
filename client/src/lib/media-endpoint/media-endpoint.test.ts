/**
 * MediaEndpoint Unit & Contract Test Suite
 *
 * Validates the IMediaEndpoint abstraction, state-machine transitions,
 * publication/subscription lifecycle, and Cloudflare dual-session signaling.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MockMediaEndpoint,
  CloudflareMediaEndpoint,
  MediaEndpointState,
  RemoteParticipantTrack,
} from './index';

describe('R3-03 / P3-01: MediaEndpoint State Machine & Contract (Mock Adapter)', () => {
  it('initializes in idle state and transitions cleanly to connected and disconnected', async () => {
    const endpoint = new MockMediaEndpoint('user-alice');
    assert.equal(endpoint.state, 'idle');
    assert.equal(endpoint.participantId, 'user-alice');

    const stateHistory: MediaEndpointState[] = [];
    endpoint.on('state_changed', ({ state }) => stateHistory.push(state));

    await endpoint.connect();
    assert.equal(endpoint.state, 'connected');

    await endpoint.disconnect();
    assert.equal(endpoint.state, 'disconnected');

    assert.deepEqual(stateHistory, ['connecting', 'connected', 'leaving', 'disconnected']);
  });

  it('rejects publishing when not in connected state', async () => {
    const endpoint = new MockMediaEndpoint('user-bob');
    const mockTrack = { id: 'track-1', kind: 'video' } as any;

    await assert.rejects(
      async () => {
        await endpoint.publishTrack({ kind: 'video', track: mockTrack });
      },
      { message: /Cannot publish track in state: idle/ }
    );
  });

  it('publishes and withdraws local media tracks', async () => {
    const endpoint = new MockMediaEndpoint('user-carol');
    await endpoint.connect();

    const mockVideoTrack = { id: 'track-v1', kind: 'video' } as any;
    const pubResult = await endpoint.publishTrack({
      kind: 'video',
      track: mockVideoTrack,
      simulcast: true,
    });

    assert.ok(pubResult.publicationId.startsWith('pub-video-'));
    assert.equal(pubResult.kind, 'video');

    let withdrawnPubId: string | null = null;
    endpoint.on('track_withdrawn', ({ publicationId }) => {
      withdrawnPubId = publicationId;
    });

    await endpoint.withdrawTrack(pubResult.publicationId);
    assert.equal(withdrawnPubId, pubResult.publicationId);

    await endpoint.disconnect();
  });

  it('tracks remote participants and dispatches remote track events', async () => {
    const endpoint = new MockMediaEndpoint('user-dan');
    await endpoint.connect();

    let joinedParticipant: string | null = null;
    endpoint.on('participant_joined', ({ participantId }) => {
      joinedParticipant = participantId;
    });

    endpoint.simulateRemoteJoin('remote-user-1', 'moderator');
    assert.equal(joinedParticipant, 'remote-user-1');
    assert.equal(endpoint.participants.size, 1);

    let addedTrack: RemoteParticipantTrack | null = null;
    endpoint.on('remote_track_added', (track) => {
      addedTrack = track;
    });

    const mockRemoteTrack = { id: 'audio-remote-1', kind: 'audio' } as any;
    const mockStream = { id: 'stream-1' } as any;

    endpoint.simulateRemoteTrack('remote-user-1', 'pub-remote-a1', 'audio', mockRemoteTrack, mockStream);
    assert.ok(addedTrack);
    assert.equal((addedTrack as RemoteParticipantTrack).participantId, 'remote-user-1');
    assert.equal((addedTrack as RemoteParticipantTrack).kind, 'audio');

    // Simulate remote leave cleans up tracks
    let removedPubId: string | null = null;
    endpoint.on('remote_track_removed', ({ publicationId }) => {
      removedPubId = publicationId;
    });

    endpoint.simulateRemoteLeave('remote-user-1');
    assert.equal(removedPubId, 'pub-remote-a1');
    assert.equal(endpoint.remoteTracks.size, 0);
    assert.equal(endpoint.participants.size, 0);

    await endpoint.disconnect();
  });

  it('handles connection failure and transitions to failed state', async () => {
    const endpoint = new MockMediaEndpoint('user-eve');
    endpoint.simulateFailureOnConnect = true;

    await assert.rejects(async () => {
      await endpoint.connect();
    });

    assert.equal(endpoint.state, 'failed');
  });
});

describe('R3-03 / P3-01: CloudflareMediaEndpoint Dual-Session Signaling Contract', () => {
  // Test fake WebSocket
  class FakeTestWebSocket {
    public readyState: number = 0;
    public sentMessages: any[] = [];
    public onopen?: (ev: any) => void;
    public onmessage?: (ev: any) => void;
    public onerror?: (ev: any) => void;
    public onclose?: (ev: any) => void;

    constructor(public readonly url: string) {
      setTimeout(() => {
        this.readyState = 1;
        this.onopen?.({});
      }, 5);
    }

    send(data: string) {
      this.sentMessages.push(JSON.parse(data));
    }

    close() {
      this.readyState = 3;
      this.onclose?.({});
    }

    // Helper to simulate incoming message from server
    receiveFromServer(msg: Record<string, any>) {
      this.onmessage?.({ data: JSON.stringify(msg) });
    }
  }

  // Test fake RTCPeerConnection
  class FakeTestPeerConnection {
    public localDescription: any = null;
    public remoteDescription: any = null;
    public senders: any[] = [];
    public receivers: any[] = [];
    public transceivers: any[] = [];
    public ontrack?: (ev: any) => void;
    public closed: boolean = false;

    constructor(public readonly config?: any) {}

    async createOffer() {
      return { type: 'offer', sdp: 'v=0\r\no=fake 1 1 IN IP4 127.0.0.1\r\ns=test\r\n' };
    }

    async createAnswer() {
      return { type: 'answer', sdp: 'v=0\r\no=fake-answer 1 1 IN IP4 127.0.0.1\r\ns=test\r\n' };
    }

    async setLocalDescription(desc: any) {
      this.localDescription = desc;
    }

    async setRemoteDescription(desc: any) {
      this.remoteDescription = desc;
    }

    addTrack(track: any, stream: any) {
      const sender = { track };
      this.senders.push(sender);
      this.transceivers.push({ sender, receiver: { track: { id: 'recv-t1', kind: track.kind } }, mid: String(this.transceivers.length) });
      return sender;
    }

    addTransceiver(trackOrKind: any, init?: any) {
      const transceiver = { sender: { track: trackOrKind }, receiver: { track: { id: 'recv-t1', kind: 'video' } }, mid: String(this.transceivers.length) };
      this.transceivers.push(transceiver);
      this.receivers.push(transceiver.receiver);
      return transceiver;
    }

    getSenders() {
      return this.senders;
    }

    getReceivers() {
      return this.receivers;
    }

    getTransceivers() {
      return this.transceivers;
    }

    close() {
      this.closed = true;
    }
  }

  it('performs authenticated join and media session initialization', async () => {
    let fakeWs: FakeTestWebSocket | null = null;
    const createdPcs: FakeTestPeerConnection[] = [];

    const endpoint = new CloudflareMediaEndpoint({
      roomId: 'room-alpha',
      capabilityToken: 'signed-capability-token-123',
      coordinatorWsUrl: 'ws://localhost:8787',
      webSocketFactory: (url) => {
        fakeWs = new FakeTestWebSocket(url);
        return fakeWs as any;
      },
      peerConnectionFactory: (cfg) => {
        const pc = new FakeTestPeerConnection(cfg);
        createdPcs.push(pc);
        return pc as any;
      },
    });

    const connectPromise = endpoint.connect();

    // Wait for fakeWs to be instantiated and open
    await new Promise((r) => setTimeout(r, 10));
    assert.ok(fakeWs);
    const ws = fakeWs as unknown as FakeTestWebSocket;
    assert.equal(ws.url, 'ws://localhost:8787/rooms/room-alpha/websocket');

    // Verify join message sent with token
    assert.equal(ws.sentMessages[0]?.type, 'join');
    assert.equal(ws.sentMessages[0]?.token, 'signed-capability-token-123');

    // Simulate coordinator admitting and granting media sessions
    ws.receiveFromServer({
      type: 'joined',
      membershipId: 'mem-101',
      userId: 'usr-charlie',
      role: 'host',
      revision: 1,
      snapshot: {
        roomId: 'room-alpha',
        revision: 1,
        participants: [
          {
            membershipId: 'mem-existing',
            userId: 'usr-existing',
            role: 'speaker',
            joinedAt: 1,
          },
        ],
        publications: [
          {
            publicationId: 'pub-existing-video',
            ownerMembershipId: 'mem-existing',
            kind: 'video',
            simulcast: false,
            createdAt: 1,
            sfuTrackId: 'sfu-existing-video',
          },
        ],
      },
    });

    ws.receiveFromServer({
      type: 'media_session_ready',
      publisherSessionId: 'pub-sess-999',
      subscriberSessionId: 'sub-sess-888',
    });

    await connectPromise;
    assert.equal(endpoint.state, 'connected');
    assert.equal(endpoint.participantId, 'usr-charlie');

    // Verify two separate peer connections were created (publisher and subscriber)
    assert.equal(createdPcs.length, 2);
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.ok(
      ws.sentMessages.some(
        (message) =>
          message.type === 'subscribe_media' &&
          message.publicationIds?.[0] === 'pub-existing-video'
      ),
      'existing room publications must be subscribed from the join snapshot'
    );

    await endpoint.disconnect();
    assert.equal(endpoint.state, 'disconnected');
    assert.ok(createdPcs[0].closed);
    assert.ok(createdPcs[1].closed);
  });

  it('performs publish_media SDP offer/answer exchange', async () => {
    let fakeWs: FakeTestWebSocket | null = null;
    const createdPcs: FakeTestPeerConnection[] = [];

    const endpoint = new CloudflareMediaEndpoint({
      roomId: 'room-beta',
      capabilityToken: 'signed-token-456',
      coordinatorWsUrl: 'ws://localhost:8787',
      webSocketFactory: (url) => {
        fakeWs = new FakeTestWebSocket(url);
        return fakeWs as any;
      },
      peerConnectionFactory: (cfg) => {
        const pc = new FakeTestPeerConnection(cfg);
        createdPcs.push(pc);
        return pc as any;
      },
    });

    const connectPromise = endpoint.connect();
    await new Promise((r) => setTimeout(r, 10));

    fakeWs!.receiveFromServer({
      type: 'joined',
      membershipId: 'mem-102',
      userId: 'usr-david',
      role: 'speaker',
      revision: 1,
    });

    fakeWs!.receiveFromServer({
      type: 'media_session_ready',
      publisherSessionId: 'pub-sess-1',
      subscriberSessionId: 'sub-sess-1',
    });

    await connectPromise;

    // Publish track
    const mockAudioTrack = { id: 'mic-1', kind: 'audio', stop: () => {} } as any;
    const publishPromise = endpoint.publishTrack({ kind: 'audio', track: mockAudioTrack });

    await new Promise((r) => setTimeout(r, 5));

    // Verify publish_media message sent to coordinator
    const publishMsg = fakeWs!.sentMessages.find((m) => m.type === 'publish_media');
    assert.ok(publishMsg);
    assert.equal(publishMsg.kind, 'audio');
    assert.ok(publishMsg.offerSdp);
    assert.equal(publishMsg.mid, '0');

    // Simulate coordinator answering
    fakeWs!.receiveFromServer({
      type: 'publish_media_success',
      publicationId: 'pub-media-mic-777',
      sfuTrackId: 'sfu-track-xyz',
      answerSdp: 'v=0\r\ns=fake-answer\r\n',
    });

    const result = await publishPromise;
    assert.equal(result.publicationId, 'pub-media-mic-777');
    assert.equal(result.sfuTrackId, 'sfu-track-xyz');
    assert.equal(result.kind, 'audio');

    // Test withdrawing the published track
    let withdrawnEmitted = false;
    endpoint.on('track_withdrawn', ({ publicationId }) => {
      if (publicationId === 'pub-media-mic-777') withdrawnEmitted = true;
    });

    const withdrawPromise = endpoint.withdrawTrack('pub-media-mic-777');
    await new Promise((r) => setTimeout(r, 5));

    const withdrawMsg = fakeWs!.sentMessages.find((m) => m.type === 'withdraw');
    assert.ok(withdrawMsg);
    assert.equal(withdrawMsg.publicationId, 'pub-media-mic-777');

    fakeWs!.receiveFromServer({
      type: 'withdraw_success',
      publicationId: 'pub-media-mic-777',
    });

    await withdrawPromise;
    assert.ok(withdrawnEmitted);

    await endpoint.disconnect();
  });

  it('subscribes automatically when coordinator announces publication_added', async () => {
    let fakeWs: FakeTestWebSocket | null = null;
    const createdPcs: FakeTestPeerConnection[] = [];

    const endpoint = new CloudflareMediaEndpoint({
      roomId: 'room-gamma',
      capabilityToken: 'signed-token-789',
      coordinatorWsUrl: 'ws://localhost:8787',
      webSocketFactory: (url) => {
        fakeWs = new FakeTestWebSocket(url);
        return fakeWs as any;
      },
      peerConnectionFactory: (cfg) => {
        const pc = new FakeTestPeerConnection(cfg);
        createdPcs.push(pc);
        return pc as any;
      },
    });

    const connectPromise = endpoint.connect();
    await new Promise((r) => setTimeout(r, 10));

    fakeWs!.receiveFromServer({
      type: 'joined',
      membershipId: 'mem-103',
      userId: 'usr-subscriber',
      role: 'member',
      revision: 1,
    });

    fakeWs!.receiveFromServer({
      type: 'media_session_ready',
      publisherSessionId: 'pub-sess-2',
      subscriberSessionId: 'sub-sess-2',
    });

    await connectPromise;

    // Simulate coordinator announcing remote publication
    fakeWs!.receiveFromServer({
      type: 'publication_added',
      publicationId: 'pub-remote-cam-1',
      sfuTrackId: 'sfu-track-cam-1',
      ownerMembershipId: 'mem-remote-host',
      kind: 'video',
    });

    await new Promise((r) => setTimeout(r, 10));

    // Verify subscribe_media message was dispatched
    const subscribeMsg = fakeWs!.sentMessages.find((m) => m.type === 'subscribe_media');
    assert.ok(subscribeMsg);
    assert.equal(subscribeMsg.tracks[0]?.publicationId, 'pub-remote-cam-1');
    assert.equal(subscribeMsg.offerSdp, undefined);

    // Cloudflare supplies the subscription offer; browser answers it through renegotiation.
    fakeWs!.receiveFromServer({
      type: 'subscribe_media_offer',
      requestId: subscribeMsg.requestId,
      sdpOffer: 'v=0\r\ns=sub-offer\r\n',
      tracks: [{ trackId: 'sfu-track-cam-1', mid: '0' }],
    });
    await new Promise((r) => setTimeout(r, 5));
    const renegotiateMsg = fakeWs!.sentMessages.find((m) => m.type === 'renegotiate_media');
    assert.ok(renegotiateMsg);
    assert.equal(renegotiateMsg.requestId, subscribeMsg.requestId);
    assert.ok(renegotiateMsg.sdpAnswer);

    fakeWs!.receiveFromServer({
      type: 'subscribe_media_success',
      requestId: subscribeMsg.requestId,
      tracks: [{ trackId: 'sfu-track-cam-1', mid: '0' }],
    });

    // The SFU offer has already been installed. A success acknowledgement must
    // not be treated as a second SDP answer.
    assert.equal(createdPcs[1].remoteDescription?.type, 'offer');

    let remoteTrackStopped = false;
    createdPcs[1].ontrack?.({
      track: {
        id: 'remote-camera-track',
        kind: 'video',
        stop: () => {
          remoteTrackStopped = true;
        },
      },
      streams: [{ id: 'remote-camera-stream' }],
      transceiver: { mid: '0' },
    });

    // Simulate remote withdrawal
    let trackRemovedEmitted = false;
    endpoint.on('remote_track_removed', ({ publicationId, participantId }) => {
      if (publicationId === 'pub-remote-cam-1' && participantId === 'mem-remote-host') {
        trackRemovedEmitted = true;
      }
    });

    fakeWs!.receiveFromServer({
      type: 'publication_removed',
      publicationId: 'pub-remote-cam-1',
      ownerMembershipId: 'mem-remote-host',
    });

    assert.ok(trackRemovedEmitted);
    assert.equal(remoteTrackStopped, true);
    assert.equal(endpoint.remoteTracks.size, 0);

    // A participant departure must perform the same receiver cleanup as an
    // explicit publication withdrawal.
    fakeWs!.receiveFromServer({
      type: 'publication_added',
      publicationId: 'pub-remote-cam-2',
      sfuTrackId: 'sfu-track-cam-2',
      ownerMembershipId: 'mem-remote-host',
      kind: 'video',
    });
    await new Promise((r) => setTimeout(r, 5));

    let departedTrackStopped = false;
    createdPcs[1].ontrack?.({
      track: {
        id: 'departed-camera-track',
        kind: 'video',
        stop: () => {
          departedTrackStopped = true;
        },
      },
      streams: [{ id: 'departed-camera-stream' }],
      transceiver: { mid: '0' },
    });

    fakeWs!.receiveFromServer({
      type: 'participant_left',
      membershipId: 'mem-remote-host',
    });

    assert.equal(departedTrackStopped, true);
    assert.equal(endpoint.remoteTracks.size, 0);

    await endpoint.disconnect();
  });
});
