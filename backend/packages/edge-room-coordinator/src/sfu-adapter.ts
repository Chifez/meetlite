export interface CreateSessionResult {
  sessionId: string;
}

export interface PublishTrackResult {
  trackId: string;
  mid?: string;
  sdpAnswer: string;
}

export interface TrackPullRequest {
  publisherSessionId: string;
  trackName: string;
}

export interface SubscribeTracksResult {
  sdpOffer: string;
  requiresRenegotiation: boolean;
  tracks: Array<{ trackId: string; mid?: string }>;
}

export interface ISfuSessionAdapter {
  createSession(): Promise<CreateSessionResult>;
  closeSession(sessionId: string): Promise<void>;
  publishTrack(sessionId: string, sdpOffer: string, trackName: string, mid: string): Promise<PublishTrackResult>;
  closeTrack(sessionId: string, trackName: string): Promise<void>;
  subscribeTracks(
    subscriberSessionId: string,
    tracksToPull: TrackPullRequest[]
  ): Promise<SubscribeTracksResult>;
  renegotiateSession(sessionId: string, sdpAnswer: string): Promise<void>;
}

/**
 * Mock / Loopback SFU Session Adapter for deterministic local development,
 * Docker Compose testing, and unit tests without Cloudflare credentials.
 */
export class MockSfuSessionAdapter implements ISfuSessionAdapter {
  private readonly activeSessions = new Set<string>();
  private readonly publishedTracks = new Map<string, { sessionId: string; trackName: string }>();
  public shouldSimulateFailure = false;
  public failureErrorMessage = 'Simulated SFU Failure';

  async createSession(): Promise<CreateSessionResult> {
    if (this.shouldSimulateFailure) {
      throw new Error(this.failureErrorMessage);
    }
    const sessionId = `sfu_sess_${crypto.randomUUID()}`;
    this.activeSessions.add(sessionId);
    return { sessionId };
  }

  async closeSession(sessionId: string): Promise<void> {
    this.activeSessions.delete(sessionId);
    for (const [trackId, data] of this.publishedTracks.entries()) {
      if (data.sessionId === sessionId) {
        this.publishedTracks.delete(trackId);
      }
    }
  }

  async publishTrack(
    sessionId: string,
    sdpOffer: string,
    trackName: string,
    _mid: string
  ): Promise<PublishTrackResult> {
    if (this.shouldSimulateFailure) {
      throw new Error(this.failureErrorMessage);
    }
    if (!this.activeSessions.has(sessionId)) {
      throw new Error(`SFU session ${sessionId} not found or already closed`);
    }

    const trackId = `track_${crypto.randomUUID().slice(0, 8)}`;
    this.publishedTracks.set(trackId, { sessionId, trackName });

    // Generate simulated compliant SDP answer
    const sdpAnswer = [
      'v=0',
      'o=- 123456789 2 IN IP4 127.0.0.1',
      's=Cloudflare Realtime SFU Mock',
      't=0 0',
      'm=video 9 UDP/TLS/RTP/SAVPF 96',
      'c=IN IP4 127.0.0.1',
      'a=recvonly',
      'a=rtpmap:96 VP8/90000',
      `a=mid:${trackName}`,
    ].join('\r\n');

    return {
      trackId,
      mid: trackName,
      sdpAnswer,
    };
  }

  async closeTrack(_sessionId: string, trackName: string): Promise<void> {
    for (const [trackId, data] of this.publishedTracks.entries()) {
      if (data.trackName === trackName) this.publishedTracks.delete(trackId);
    }
  }

  async subscribeTracks(
    subscriberSessionId: string,
    tracksToPull: TrackPullRequest[]
  ): Promise<SubscribeTracksResult> {
    if (this.shouldSimulateFailure) {
      throw new Error(this.failureErrorMessage);
    }
    if (!this.activeSessions.has(subscriberSessionId)) {
      throw new Error(`SFU subscriber session ${subscriberSessionId} not found`);
    }

    const tracks = tracksToPull.map((t, idx) => ({
      trackId: `remote_${t.trackName}`,
      mid: `mid_${idx}`,
    }));

    const sdpOffer = [
      'v=0',
      'o=- 987654321 2 IN IP4 127.0.0.1',
      's=Cloudflare Realtime SFU Mock',
      't=0 0',
      'm=audio 9 UDP/TLS/RTP/SAVPF 111',
      'c=IN IP4 127.0.0.1',
      'a=sendonly',
      'a=rtpmap:111 opus/48000/2',
      'm=video 9 UDP/TLS/RTP/SAVPF 96',
      'c=IN IP4 127.0.0.1',
      'a=sendonly',
      'a=rtpmap:96 VP8/90000',
    ].join('\r\n');

    return {
      sdpOffer,
      requiresRenegotiation: true,
      tracks,
    };
  }

  async renegotiateSession(subscriberSessionId: string, _sdpAnswer: string): Promise<void> {
    if (!this.activeSessions.has(subscriberSessionId)) {
      throw new Error(`SFU subscriber session ${subscriberSessionId} not found`);
    }
  }

  isSessionActive(sessionId: string): boolean {
    return this.activeSessions.has(sessionId);
  }
}

export interface CloudflareCallsConfig {
  appId: string;
  appSecret: string;
  apiBaseUrl?: string;
}

/**
 * Production Cloudflare Calls Realtime SFU adapter targeting:
 * https://rtc.live.cloudflare.com/v1/apps/{appId}
 */
export class CloudflareCallsAdapter implements ISfuSessionAdapter {
  private readonly baseUrl: string;

  constructor(private readonly config: CloudflareCallsConfig) {
    const apiBase = config.apiBaseUrl || 'https://rtc.live.cloudflare.com/v1';
    this.baseUrl = `${apiBase}/apps/${config.appId}`;
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.appSecret}`,
      'Content-Type': 'application/json',
    };
  }

  async createSession(): Promise<CreateSessionResult> {
    const res = await fetch(`${this.baseUrl}/sessions/new`, {
      method: 'POST',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Cloudflare Calls createSession failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as any;
    return {
      sessionId: data.sessionId,
    };
  }

  async closeSession(sessionId: string): Promise<void> {
    const tracks = await this.getSessionTracks(sessionId);
    const mids = tracks
      .filter((track: any) => track.status !== 'inactive' && typeof track.mid === 'string')
      .map((track: any) => ({ mid: track.mid }));
    if (mids.length > 0) {
      await this.closeTrackMids(sessionId, mids);
    }
  }

  private async getSessionTracks(sessionId: string): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (res.status === 404 || res.status === 410) return [];
    if (!res.ok) throw new Error(`Cloudflare Calls inspect session failed (${res.status})`);
    const data = (await res.json()) as any;
    return Array.isArray(data.tracks) ? data.tracks : [];
  }

  private async closeTrackMids(sessionId: string, tracks: Array<{ mid: string }>): Promise<void> {
    const res = await fetch(`${this.baseUrl}/sessions/${sessionId}/tracks/close`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ tracks, force: true }),
    });
    if (!res.ok) throw new Error(`Cloudflare Calls close tracks failed (${res.status})`);
  }

  async closeTrack(sessionId: string, trackName: string): Promise<void> {
    const tracks = await this.getSessionTracks(sessionId);
    const matching = tracks.find(
      (track: any) =>
        track.location === 'local' && track.trackName === trackName && track.status !== 'inactive'
    );
    if (matching?.mid) await this.closeTrackMids(sessionId, [{ mid: matching.mid }]);
  }

  async publishTrack(
    sessionId: string,
    sdpOffer: string,
    trackName: string,
    mid: string
  ): Promise<PublishTrackResult> {
    const res = await fetch(`${this.baseUrl}/sessions/${sessionId}/tracks/new`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        sessionDescription: {
          type: 'offer',
          sdp: sdpOffer,
        },
        tracks: [
          {
            location: 'local',
            mid,
            trackName,
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Cloudflare Calls publishTrack failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as any;
    const track = data.tracks?.[0];
    if (!track || track.errorCode) {
      throw new Error(`Cloudflare Calls publishTrack rejected: ${track?.errorDescription || 'missing track result'}`);
    }
    return {
      trackId: track.trackName || trackName,
      mid: track.mid,
      sdpAnswer: data.sessionDescription?.sdp,
    };
  }

  async subscribeTracks(
    subscriberSessionId: string,
    tracksToPull: TrackPullRequest[]
  ): Promise<SubscribeTracksResult> {
    const body: Record<string, any> = {
      tracks: tracksToPull.map((t) => ({
        location: 'remote',
        sessionId: t.publisherSessionId,
        trackName: t.trackName,
      })),
    };

    const res = await fetch(`${this.baseUrl}/sessions/${subscriberSessionId}/tracks/new`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Cloudflare Calls subscribeTracks failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as any;
    const rejected = (data.tracks || []).find((track: any) => track.errorCode);
    if (rejected) {
      throw new Error(`Cloudflare Calls subscribeTracks rejected: ${rejected.errorDescription || rejected.errorCode}`);
    }
    if (!data.sessionDescription?.sdp || !data.requiresImmediateRenegotiation) {
      throw new Error('Cloudflare Calls subscribeTracks did not return the required renegotiation offer');
    }
    return {
      sdpOffer: data.sessionDescription.sdp,
      requiresRenegotiation: Boolean(data.requiresImmediateRenegotiation),
      tracks: (data.tracks || []).map((t: any) => ({
        trackId: t.trackName,
        mid: t.mid,
      })),
    };
  }


  async renegotiateSession(sessionId: string, sdpAnswer: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/sessions/${sessionId}/renegotiate`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ sessionDescription: { type: 'answer', sdp: sdpAnswer } }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Cloudflare Calls renegotiation failed (${res.status}): ${err}`);
    }
  }
}
