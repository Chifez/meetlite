/**
 * Mock Media Endpoint Adapter
 *
 * Deterministic in-memory fake implementing IMediaEndpoint.
 * Used for unit testing, characterization testing, and offline UI development.
 */

import {
  IMediaEndpoint,
  MediaEndpointState,
  MediaEndpointParticipant,
  RemoteParticipantTrack,
  TrackPublicationRequest,
  TrackPublicationResult,
  SpatialLayer,
  MediaEndpointEventMap,
  MediaEndpointEventHandler,
} from './types';

export class MockMediaEndpoint implements IMediaEndpoint {
  private _state: MediaEndpointState = 'idle';
  private _participantId: string | null = null;
  private readonly _participants = new Map<string, MediaEndpointParticipant>();
  private readonly _remoteTracks = new Map<string, RemoteParticipantTrack>();
  private readonly _localPublications = new Map<string, TrackPublicationResult>();
  private readonly _eventListeners = new Map<keyof MediaEndpointEventMap, Set<MediaEndpointEventHandler<any>>>();

  public simulateFailureOnConnect: boolean = false;
  public simulateFailureOnPublish: boolean = false;

  constructor(participantId: string = 'test-user-1') {
    this._participantId = participantId;
  }

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
    if (this._state === 'connected') return;

    this.transitionState('connecting');

    if (this.simulateFailureOnConnect) {
      const err = new Error('Simulated connection failure');
      this.transitionState('failed', err);
      this.emit('error', { code: 'CONNECT_FAILED', message: err.message, fatal: true });
      throw err;
    }

    // Simulate instant deterministic connection
    this.transitionState('connected');
  }

  public async disconnect(): Promise<void> {
    if (this._state === 'disconnected' || this._state === 'idle') return;

    this.transitionState('leaving');

    this._remoteTracks.clear();
    this._participants.clear();
    this._localPublications.clear();

    this.transitionState('disconnected');
  }

  public async publishTrack(request: TrackPublicationRequest): Promise<TrackPublicationResult> {
    if (this._state !== 'connected') {
      throw new Error(`Cannot publish track in state: ${this._state}`);
    }

    if (this.simulateFailureOnPublish) {
      throw new Error('Simulated publish failure');
    }

    const publicationId = `pub-${request.kind}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const result: TrackPublicationResult = {
      publicationId,
      kind: request.kind,
      sfuTrackId: `sfu-track-${publicationId}`,
    };

    this._localPublications.set(publicationId, result);
    this.emit('track_published', { publicationId, kind: request.kind });
    return result;
  }

  public async withdrawTrack(publicationId: string): Promise<void> {
    if (!this._localPublications.has(publicationId)) {
      return;
    }
    this._localPublications.delete(publicationId);
    this.emit('track_withdrawn', { publicationId });
  }

  public async setPreferredLayer(_publicationId: string, _layer: SpatialLayer): Promise<void> {
    // In-memory layer switch simulation
  }

  // Testing helpers to simulate remote events
  public simulateRemoteJoin(participantId: string, role: string = 'member'): void {
    const participant: MediaEndpointParticipant = {
      participantId,
      role,
      tracks: new Map(),
      joinedAt: Date.now(),
    };
    this._participants.set(participantId, participant);
    this.emit('participant_joined', { participantId, role });
  }

  public simulateRemoteLeave(participantId: string): void {
    this._participants.delete(participantId);
    // Remove all associated tracks
    for (const [pubId, track] of this._remoteTracks.entries()) {
      if (track.participantId === participantId) {
        this._remoteTracks.delete(pubId);
        this.emit('remote_track_removed', { publicationId: pubId, participantId });
      }
    }
    this.emit('participant_left', { participantId });
  }

  public simulateRemoteTrack(
    participantId: string,
    publicationId: string,
    kind: 'audio' | 'video' | 'screen',
    mockTrack?: MediaStreamTrack,
    mockStream?: MediaStream
  ): RemoteParticipantTrack {
    const track = mockTrack || ({} as MediaStreamTrack);
    const stream = mockStream || ({} as MediaStream);

    const remoteTrack: RemoteParticipantTrack = {
      publicationId,
      participantId,
      kind,
      track,
      stream,
    };

    this._remoteTracks.set(publicationId, remoteTrack);
    this.emit('remote_track_added', remoteTrack);
    return remoteTrack;
  }

  public simulateActiveSpeaker(participantId: string | null, audioLevel: number): void {
    this.emit('active_speaker_changed', { participantId, audioLevel });
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
          console.error(`Error in MediaEndpoint event handler for ${event}:`, err);
        }
      }
    }
  }
}
