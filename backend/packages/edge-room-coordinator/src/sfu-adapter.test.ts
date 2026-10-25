import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CloudflareCallsAdapter } from './sfu-adapter.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Cloudflare Realtime SFU HTTP contract', () => {
  it('uses documented mid, remote-offer renegotiation, and forced track cleanup flows', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = input.toString();
      calls.push({ url, init });
      if (url.endsWith('/sessions/new')) {
        return Response.json({ sessionId: 'session-1' });
      }
      if (url.endsWith('/tracks/new')) {
        const body = JSON.parse(String(init.body));
        if (body.tracks[0].location === 'local') {
          return Response.json({
            sessionDescription: { type: 'answer', sdp: 'publish-answer' },
            tracks: [{ trackName: 'publication-1', mid: '3' }],
          });
        }
        return Response.json({
          sessionDescription: { type: 'offer', sdp: 'subscribe-offer' },
          requiresImmediateRenegotiation: true,
          tracks: [{ trackName: 'publication-1', mid: '7' }],
        });
      }
      if (url.endsWith('/renegotiate') || url.endsWith('/tracks/close')) {
        return Response.json({ tracks: [] });
      }
      if (url.endsWith('/sessions/session-1')) {
        return Response.json({
          tracks: [{ location: 'local', trackName: 'publication-1', mid: '3', status: 'active' }],
        });
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;

    const adapter = new CloudflareCallsAdapter({ appId: 'app-1', appSecret: 'secret-1' });
    assert.equal((await adapter.createSession()).sessionId, 'session-1');
    await adapter.publishTrack('session-1', 'publish-offer', 'publication-1', '3');
    const subscription = await adapter.subscribeTracks('session-1', [
      { publisherSessionId: 'publisher-1', trackName: 'publication-1' },
    ]);
    assert.equal(subscription.sdpOffer, 'subscribe-offer');
    await adapter.renegotiateSession('session-1', 'subscriber-answer');
    await adapter.closeTrack('session-1', 'publication-1');

    const publishCall = calls.find((call) => {
      const body = call.init.body ? JSON.parse(String(call.init.body)) : null;
      return body?.tracks?.[0]?.location === 'local';
    });
    assert.equal(JSON.parse(String(publishCall?.init.body)).tracks[0].mid, '3');

    const subscribeCall = calls.find((call) => {
      const body = call.init.body ? JSON.parse(String(call.init.body)) : null;
      return body?.tracks?.[0]?.location === 'remote';
    });
    const subscribeBody = JSON.parse(String(subscribeCall?.init.body));
    assert.equal(subscribeBody.sessionDescription, undefined);

    const renegotiateCall = calls.find((call) => call.url.endsWith('/renegotiate'));
    assert.equal(renegotiateCall?.init.method, 'PUT');
    assert.equal(
      JSON.parse(String(renegotiateCall?.init.body)).sessionDescription.type,
      'answer'
    );

    const closeCall = calls.find((call) => call.url.endsWith('/tracks/close'));
    assert.equal(closeCall?.init.method, 'PUT');
    assert.equal(JSON.parse(String(closeCall?.init.body)).force, true);
  });
});
