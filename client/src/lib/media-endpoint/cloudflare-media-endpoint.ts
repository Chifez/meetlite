/**
 * Cloudflare Realtime SFU Media Endpoint Adapter
 *
 * Implements IMediaEndpoint for Cloudflare Workers & Durable Object Edge Room Coordinator.
 * Manages dual RTCPeerConnections (independent publisher and subscriber endpoints)
 * and serializes SDP negotiation over WebSocket.
 */

import {
  IMediaEndpoint,
  MediaEndpointState,
  MediaEndpointConfig,
  MediaEndpointParticipant,
  RemoteParticipantTrack,
  TrackPublicationRequest,
  TrackPublicationResult,
  SpatialLayer,
  MediaEndpointEventMap,
  MediaEndpointEventHandler,
  WebSocketLike,
} from './types';

export class CloudflareMediaEndpoint implements IMediaEndpoint {
  private _state: MediaEndpointState = 'idle';
  private _participantId: string | null = null;
  private readonly _participants = new Map<string, MediaEndpointParticipant>();
  private readonly _remoteTracks = new Map<string, RemoteParticipantTrack>();
  private readonly _eventListeners = new Map<keyof MediaEndpointEventMap, Set<MediaEndpointEventHandler<any>>>();

  private _ws: WebSocketLike | null = null;
  private _publisherPc: RTCPeerConnection | null = null;
  private _subscriberPc: RTCPeerConnection | null = null;
  private _publisherSessionId: string | null = null;
  private _subscriberSessionId: string | null = null;
  private _publisherMutationQueue: Promise<unknown> = Promise.resolve();
  private _subscriberMutationQueue: Promise<unknown> = Promise.resolve();

  // Pending request resolvers for async SDP exchanges
  private readonly _pendingPublishRequests = new Map<
    string,
    { resolve: (res: any) => void; reject: (err: Error) => void }
  >();
  private readonly _pendingSubscribeRequests = new Map<
    string,
    { resolve: (res: any) => void; reject: (err: Error) => void }
  >();
  private readonly _pendingWithdrawRequests = new Map<
    string,
    { resolve: () => void; reject: (err: Error) => void }
  >();

  // Map sfuTrackId or mid to publicationId and owner
  private readonly _knownRemotePublications = new Map<
    string,
    {
      publicationId: string;
      ownerMembershipId: string;
      kind: 'audio' | 'video' | 'screen';
      sfuTrackId: string;
    }
  >();
  private readonly _remotePublicationByMid = new Map<string, string>();
  private readonly _subscriptionRequests = new Set<string>();

  constructor(private readonly config: MediaEndpointConfig) {}

  public get state(): MediaEndpointState {
    return this._state;
  }

  public get participantId(): string | null {
    return this._participantId;
  }

  public get participants(): ReadonlyMap<string, MediaEndpointParticipant> {
    return this._participants;
  }

  public get remoteTracks(): ReadonlyMap<string, RemoteParticipantTrack> {
    return this._remoteTracks;
  }

  public async connect(): Promise<void> {
    if (this._state === 'connected' || this._state === 'connecting') return;

    this.transitionState('connecting');

    return new Promise<void>((resolve, reject) => {
      let resolved = false;

      const onConnectedSuccess = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      const onConnectionFailed = (err: Error) => {
        if (!resolved) {
          resolved = true;
          this.transitionState('failed', err);
          reject(err);
        }
      };

      try {
        const coordinatorUrl = new URL(this.config.coordinatorWsUrl);
        const basePath = coordinatorUrl.pathname.replace(/\/$/, '');
        coordinatorUrl.pathname = `${basePath}/rooms/${encodeURIComponent(this.config.roomId)}/websocket`;
        coordinatorUrl.search = '';
        const wsUrl = coordinatorUrl.toString();
        this._ws = this.config.webSocketFactory
          ? this.config.webSocketFactory(wsUrl)
          : new WebSocket(wsUrl);

        this._ws.onopen = () => {
          // Immediately authenticate using asymmetric room capability token
          this.sendMessage({
            type: 'join',
            token: this.config.capabilityToken,
          });
        };

        this._ws.onmessage = (event: any) => {
          try {
            const rawData = typeof event.data === 'string' ? event.data : '';
            if (!rawData) return;
            const message = JSON.parse(rawData);
            this.handleSignalingMessage(message, onConnectedSuccess, onConnectionFailed);
          } catch (err: any) {
            console.error('Failed to parse signaling message:', err);
          }
        };

        this._ws.onerror = (err: any) => {
          const error = new Error(`WebSocket error: ${err.message || 'connection failed'}`);
          onConnectionFailed(error);
        };

        this._ws.onclose = () => {
          if (this._state !== 'leaving' && this._state !== 'disconnected') {
            this.rejectPendingRequests(new Error('Coordinator connection closed'));
            this.transitionState('disconnected');
          }
        };
      } catch (err: any) {
        onConnectionFailed(err);
      }
    });
  }

  public async disconnect(): Promise<void> {
    if (this._state === 'disconnected' || this._state === 'idle') return;

    this.transitionState('leaving');

    try {
      if (this._ws && this._ws.readyState === 1) {
        this.sendMessage({ type: 'leave' });
      }
    } catch {
      // Ignore network errors during teardown
    }

    this.teardownPeerConnections();

    if (this._ws) {
      try {
        this._ws.close();
      } catch {}
      this._ws = null;
    }

    this._remoteTracks.clear();
    this._participants.clear();
    this._knownRemotePublications.clear();
    this._remotePublicationByMid.clear();
    this._subscriptionRequests.clear();
    this.rejectPendingRequests(new Error('Media endpoint disconnected'));

    this.transitionState('disconnected');
  }

  public async publishTrack(request: TrackPublicationRequest): Promise<TrackPublicationResult> {
    return this.enqueuePublisherMutation(() => this.publishTrackInternal(request));
  }

  private async publishTrackInternal(request: TrackPublicationRequest): Promise<TrackPublicationResult> {
    if (this._state !== 'connected' || !this._publisherPc) {
      throw new Error(`Cannot publish track in state: ${this._state}`);
    }

    const pc = this._publisherPc;
    const stream = typeof MediaStream !== 'undefined' ? new MediaStream([request.track]) : ({ id: 'stream-local' } as any);

    // Add track with optional simulcast parameters
    let publishingTransceiver: RTCRtpTransceiver | undefined;
    if (request.kind === 'video' && request.simulcast) {
      publishingTransceiver = pc.addTransceiver(request.track, {
        direction: 'sendonly',
        streams: [stream],
        sendEncodings: [
          { rid: 'high', maxBitrate: 1200000 },
          { rid: 'medium', maxBitrate: 500000, scaleResolutionDownBy: 2 },
          { rid: 'low', maxBitrate: 150000, scaleResolutionDownBy: 4 },
        ],
      });
    } else {
      const sender = pc.addTrack(request.track, stream);
      publishingTransceiver = pc.getTransceivers().find((item) => item.sender === sender);
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const mid = publishingTransceiver?.mid;
    if (!mid) throw new Error('Publisher transceiver mid was not assigned after local description');

    const requestId = `req-pub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    return new Promise<TrackPublicationResult>((resolve, reject) => {
      this._pendingPublishRequests.set(requestId, {
        resolve: async (msg: any) => {
          try {
            const answer = msg.sdpAnswer || msg.answerSdp;
            await pc.setRemoteDescription({ type: 'answer', sdp: answer });
            const pubId = msg.publicationId || msg.publication?.publicationId;
            const sfuId = msg.sfuTrackId || msg.publication?.sfuTrackId;
            const result: TrackPublicationResult = {
              publicationId: pubId,
              kind: request.kind,
              sfuTrackId: sfuId,
            };
            this.emit('track_published', { publicationId: pubId, kind: request.kind });
            resolve(result);
          } catch (err: any) {
            reject(err);
          }
        },
        reject,
      });

      this.sendMessage({
        type: 'publish_media',
        kind: request.kind,
        sdpOffer: offer.sdp,
        offerSdp: offer.sdp,
        mid,
        simulcast: request.simulcast,
        requestId,
      });
    });
  }

  public async withdrawTrack(publicationId: string): Promise<void> {
    return this.enqueuePublisherMutation(() => this.withdrawTrackInternal(publicationId));
  }

  private async withdrawTrackInternal(publicationId: string): Promise<void> {
    if (!this._publisherPc) return;

    return new Promise<void>((resolve, reject) => {
      this._pendingWithdrawRequests.set(publicationId, {
        resolve: () => {
          this.emit('track_withdrawn', { publicationId });
          resolve();
        },
        reject,
      });

      this.sendMessage({
        type: 'withdraw',
        publicationId,
      });
    });
  }

  public async setPreferredLayer(_publicationId: string, _layer: SpatialLayer): Promise<void> {
    // Spatial layer hint dispatched to coordinator if required
  }

  public on<K extends keyof MediaEndpointEventMap>(
    event: K,
    handler: MediaEndpointEventHandler<K>
  ): () => void {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, new Set());
    }
    this._eventListeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  public off<K extends keyof MediaEndpointEventMap>(
    event: K,
    handler: MediaEndpointEventHandler<K>
  ): void {
    const set = this._eventListeners.get(event);
    if (set) {
      set.delete(handler);
    }
  }

  private handleSignalingMessage(
    msg: any,
    onConnectedSuccess: () => void,
    onConnectionFailed: (err: Error) => void
  ): void {
    switch (msg.type) {
      case 'joined': {
        this._participantId = msg.userId || msg.membershipId;
        const participants = Array.isArray(msg.snapshot?.participants)
          ? msg.snapshot.participants
          : [];
        for (const participantData of participants) {
          const participantId = participantData.membershipId;
          if (!participantId || participantId === msg.membershipId) continue;
          const participant: MediaEndpointParticipant = {
            participantId,
            role: participantData.role || 'member',
            tracks: new Map(),
            joinedAt: participantData.joinedAt || Date.now(),
          };
          this._participants.set(participantId, participant);
          this.emit('participant_joined', {
            participantId,
            role: participant.role,
          });
        }

        const publications = Array.isArray(msg.snapshot?.publications)
          ? msg.snapshot.publications
          : [];
        for (const publication of publications) {
          if (
            !publication.publicationId ||
            !publication.ownerMembershipId ||
            !publication.kind
          ) {
            continue;
          }
          this._knownRemotePublications.set(publication.publicationId, {
            publicationId: publication.publicationId,
            ownerMembershipId: publication.ownerMembershipId,
            kind: publication.kind,
            sfuTrackId: publication.sfuTrackId || publication.publicationId,
          });
        }
        break;
      }

      case 'media_session_ready': {
        this._publisherSessionId = msg.publisherSessionId;
        this._subscriberSessionId = msg.subscriberSessionId;
        this.initializePeerConnections();
        this.transitionState('connected');
        onConnectedSuccess();
        for (const publication of this._knownRemotePublications.values()) {
          this.scheduleRemoteSubscription(
            publication.publicationId,
            publication.sfuTrackId
          );
        }
        break;
      }

      case 'publish_media_success': {
        const reqId = msg.requestId;
        if (reqId && this._pendingPublishRequests.has(reqId)) {
          const req = this._pendingPublishRequests.get(reqId);
          this._pendingPublishRequests.delete(reqId);
          req?.resolve(msg);
        } else {
          const matchingKey = Array.from(this._pendingPublishRequests.keys())[0];
          if (matchingKey) {
            const req = this._pendingPublishRequests.get(matchingKey);
            this._pendingPublishRequests.delete(matchingKey);
            req?.resolve(msg);
          }
        }
        break;
      }

      case 'subscribe_media_success': {
        const reqId = msg.requestId;
        if (reqId && this._pendingSubscribeRequests.has(reqId)) {
          const req = this._pendingSubscribeRequests.get(reqId);
          this._pendingSubscribeRequests.delete(reqId);
          req?.resolve(msg);
        } else {
          const matchingKey = Array.from(this._pendingSubscribeRequests.keys())[0];
          if (matchingKey) {
            const req = this._pendingSubscribeRequests.get(matchingKey);
            this._pendingSubscribeRequests.delete(matchingKey);
            req?.resolve(msg);
          }
        }
        break;
      }

      case 'subscribe_media_offer': {
        const req = this._pendingSubscribeRequests.get(msg.requestId);
        if (!req || !this._subscriberPc) break;
        this.completeSubscriberRenegotiation(
          msg.requestId,
          msg.sdpOffer,
          Array.isArray(msg.tracks) ? msg.tracks : []
        ).catch((error) => {
          this._pendingSubscribeRequests.delete(msg.requestId);
          req.reject(error);
        });
        break;
      }

      case 'withdraw_success': {
        const req = this._pendingWithdrawRequests.get(msg.publicationId);
        if (req) {
          this._pendingWithdrawRequests.delete(msg.publicationId);
          req.resolve();
        }
        break;
      }

      case 'publication_added': {
        const pub = msg.publication || msg;
        const pubId = pub.publicationId;
        const ownerId = pub.ownerMembershipId;
        const kind = pub.kind;
        const sfuId = pub.sfuTrackId || pubId;

        this._knownRemotePublications.set(pubId, {
          publicationId: pubId,
          ownerMembershipId: ownerId,
          kind: kind,
          sfuTrackId: sfuId,
        });

        // Automatically trigger downstream subscription for newly discovered remote track
        this.scheduleRemoteSubscription(pubId, sfuId);
        break;
      }

      case 'publication_removed': {
        const pub = this._knownRemotePublications.get(msg.publicationId);
        if (pub) {
          this._knownRemotePublications.delete(msg.publicationId);
          this._subscriptionRequests.delete(msg.publicationId);
          const remoteTrack = this._remoteTracks.get(msg.publicationId);
          remoteTrack?.track.stop();
          this._remoteTracks.delete(msg.publicationId);
          for (const [mid, publicationId] of this._remotePublicationByMid) {
            if (publicationId === msg.publicationId) this._remotePublicationByMid.delete(mid);
          }
          this.emit('remote_track_removed', {
            publicationId: msg.publicationId,
            participantId: pub.ownerMembershipId,
            trackId: remoteTrack?.track.id,
          });
        }
        break;
      }

      case 'participant_joined': {
        const p = msg.participant || msg;
        const pId = p.membershipId || p.participantId || p.userId;
        const participant: MediaEndpointParticipant = {
          participantId: pId,
          role: p.role || 'member',
          tracks: new Map(),
          joinedAt: p.joinedAt || Date.now(),
        };
        this._participants.set(participant.participantId, participant);
        this.emit('participant_joined', {
          participantId: participant.participantId,
          role: participant.role,
        });
        break;
      }

      case 'participant_left': {
        const pId = msg.userId || msg.membershipId || msg.participantId;
        this._participants.delete(pId);
        // Clear all tracks belonging to this participant
        for (const [pubId, track] of this._remoteTracks.entries()) {
          if (track.participantId === pId) {
            track.track.stop();
            this._remoteTracks.delete(pubId);
            this._subscriptionRequests.delete(pubId);
            this.emit('remote_track_removed', {
              publicationId: pubId,
              participantId: pId,
              trackId: track.track.id,
            });
          }
        }
        this.emit('participant_left', { participantId: pId });
        break;
      }

      case 'error': {
        const err = new Error(msg.message || 'Coordinator error');
        if (this._state === 'connecting') {
          onConnectionFailed(err);
        } else {
          this.emit('error', { code: msg.code || 'COORDINATOR_ERROR', message: msg.message, fatal: false });
        }
        break;
      }
    }
  }

  private async subscribeToRemotePublication(publicationId: string, sfuTrackId: string): Promise<void> {
    if (!this._subscriberPc) return;

    const pc = this._subscriberPc;
    const requestId = `req-sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    return new Promise<void>((resolve, reject) => {
      this._pendingSubscribeRequests.set(requestId, {
        resolve: () => resolve(),
        reject,
      });

      this.sendMessage({
        type: 'subscribe_media',
        publicationIds: [publicationId],
        tracks: [{ publicationId, trackName: sfuTrackId }],
        requestId,
      });
    });
  }

  private scheduleRemoteSubscription(publicationId: string, sfuTrackId: string): void {
    if (!this._subscriberPc || this._subscriptionRequests.has(publicationId)) return;
    this._subscriptionRequests.add(publicationId);
    this.enqueueSubscriberMutation(() =>
      this.subscribeToRemotePublication(publicationId, sfuTrackId)
    ).catch((error) => {
      this._subscriptionRequests.delete(publicationId);
      if (this._state !== 'leaving' && this._state !== 'disconnected') {
        console.error('Failed to subscribe to remote publication:', error);
      }
    });
  }

  private enqueuePublisherMutation<T>(task: () => Promise<T>): Promise<T> {
    const result = this._publisherMutationQueue.then(task, task);
    this._publisherMutationQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private enqueueSubscriberMutation<T>(task: () => Promise<T>): Promise<T> {
    const result = this._subscriberMutationQueue.then(task, task);
    this._subscriberMutationQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async completeSubscriberRenegotiation(
    requestId: string,
    sdpOffer: string,
    tracks: ReadonlyArray<{ trackId?: string; mid?: string }>
  ): Promise<void> {
    if (!this._subscriberPc) throw new Error('Subscriber peer connection is unavailable');
    for (const track of tracks) {
      if (!track.mid || !track.trackId) continue;
      const publication = Array.from(this._knownRemotePublications.values()).find(
        (candidate) => candidate.sfuTrackId === track.trackId
      );
      if (publication) this._remotePublicationByMid.set(track.mid, publication.publicationId);
    }
    await this._subscriberPc.setRemoteDescription({ type: 'offer', sdp: sdpOffer });
    const answer = await this._subscriberPc.createAnswer();
    await this._subscriberPc.setLocalDescription(answer);
    if (!answer.sdp) throw new Error('Subscriber renegotiation answer is missing SDP');
    this.sendMessage({ type: 'renegotiate_media', requestId, sdpAnswer: answer.sdp });
  }

  private initializePeerConnections(): void {
    const rtcConfig: RTCConfiguration = {
      iceServers: this.config.iceServers || [{ urls: 'stun:stun.cloudflare.com:3478' }],
    };

    const pcFactory = this.config.peerConnectionFactory || ((cfg) => new RTCPeerConnection(cfg));

    this._publisherPc = pcFactory(rtcConfig);
    this._subscriberPc = pcFactory(rtcConfig);

    // Bind incoming tracks from subscriber PeerConnection
    this._subscriberPc.ontrack = (event: RTCTrackEvent) => {
      const track = event.track;
      const stream = event.streams[0] || (typeof MediaStream !== 'undefined' ? new MediaStream([track]) : ({ id: 'stream-remote' } as any));

      const publicationIdForMid = event.transceiver.mid
        ? this._remotePublicationByMid.get(event.transceiver.mid)
        : undefined;
      const pubEntry = publicationIdForMid
        ? this._knownRemotePublications.get(publicationIdForMid)
        : Array.from(this._knownRemotePublications.values()).find(
            (publication) => publication.kind === track.kind
          );

      const publicationId = pubEntry?.publicationId || `track-${track.id}`;
      const participantId = pubEntry?.ownerMembershipId || 'remote-peer';
      const kind = (track.kind === 'video' ? 'video' : 'audio') as 'audio' | 'video' | 'screen';

      const remoteTrack: RemoteParticipantTrack = {
        publicationId,
        participantId,
        kind,
        track,
        stream,
      };

      this._remoteTracks.set(publicationId, remoteTrack);
      this.emit('remote_track_added', remoteTrack);
    };
  }

  private teardownPeerConnections(): void {
    if (this._publisherPc) {
      try {
        this._publisherPc.getSenders().forEach((s) => s.track?.stop());
        this._publisherPc.close();
      } catch {}
      this._publisherPc = null;
    }

    if (this._subscriberPc) {
      try {
        this._subscriberPc.getReceivers().forEach((r) => r.track?.stop());
        this._subscriberPc.close();
      } catch {}
      this._subscriberPc = null;
    }
  }

  private rejectPendingRequests(error: Error): void {
    for (const request of this._pendingPublishRequests.values()) request.reject(error);
    for (const request of this._pendingSubscribeRequests.values()) request.reject(error);
    for (const request of this._pendingWithdrawRequests.values()) request.reject(error);
    this._pendingPublishRequests.clear();
    this._pendingSubscribeRequests.clear();
    this._pendingWithdrawRequests.clear();
  }

  private sendMessage(msg: Record<string, any>): void {
    if (this._ws && this._ws.readyState === 1) {
      this._ws.send(JSON.stringify(msg));
    }
  }

  private transitionState(newState: MediaEndpointState, error?: Error): void {
    this._state = newState;
    this.emit('state_changed', { state: newState, error });
  }

  private emit<K extends keyof MediaEndpointEventMap>(
    event: K,
    payload: MediaEndpointEventMap[K]
  ): void {
    const listeners = this._eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(payload);
        } catch (err) {
          console.error(`Error in CloudflareMediaEndpoint event handler for ${event}:`, err);
        }
      }
    }
  }
}
