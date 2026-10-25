/**
 * MediaEndpoint Domain Types & Contract
 *
 * Sits at the architectural seam between client React views and underlying WebRTC engines
 * (Cloudflare Realtime SFU, legacy Mediasoup, and deterministic testing fakes).
 */

export type MediaEndpointState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'leaving'
  | 'disconnected'
  | 'failed';

export type TrackPublicationKind = 'audio' | 'video' | 'screen';
export type SpatialLayer = 'high' | 'medium' | 'low';

export interface RemoteParticipantTrack {
  readonly publicationId: string;
  readonly participantId: string;
  readonly kind: TrackPublicationKind;
  readonly track: MediaStreamTrack;
  readonly stream: MediaStream;
}

export interface MediaEndpointParticipant {
  readonly participantId: string;
  readonly role: string;
  readonly tracks: ReadonlyMap<string, RemoteParticipantTrack>;
  readonly joinedAt: number;
}

export interface WebSocketLike {
  readyState: number;
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: (event: any) => void): void;
  removeEventListener(type: string, listener: (event: any) => void): void;
  onopen?: ((event: any) => void) | null;
  onclose?: ((event: any) => void) | null;
  onerror?: ((event: any) => void) | null;
  onmessage?: ((event: any) => void) | null;
}

export interface MediaEndpointConfig {
  readonly roomId: string;
  readonly capabilityToken: string;
  readonly coordinatorWsUrl: string;
  readonly iceServers?: RTCIceServer[];
  readonly webSocketFactory?: (url: string) => WebSocketLike;
  readonly peerConnectionFactory?: (config?: RTCConfiguration) => RTCPeerConnection;
}

export interface TrackPublicationRequest {
  readonly kind: TrackPublicationKind;
  readonly track: MediaStreamTrack;
  readonly simulcast?: boolean;
}

export interface TrackPublicationResult {
  readonly publicationId: string;
  readonly kind: TrackPublicationKind;
  readonly sfuTrackId?: string;
}

export interface MediaEndpointEventMap {
  state_changed: { readonly state: MediaEndpointState; readonly error?: Error };
  participant_joined: { readonly participantId: string; readonly role: string };
  participant_left: { readonly participantId: string };
  track_published: { readonly publicationId: string; readonly kind: TrackKindPublication };
  track_withdrawn: { readonly publicationId: string };
  remote_track_added: RemoteParticipantTrack;
  remote_track_removed: {
    readonly publicationId: string;
    readonly participantId: string;
    readonly trackId?: string;
  };
  active_speaker_changed: { readonly participantId: string | null; readonly audioLevel: number };
  error: { readonly code: string; readonly message: string; readonly fatal: boolean };
}

export type TrackKindPublication = TrackPublicationKind;

export type MediaEndpointEventHandler<K extends keyof MediaEndpointEventMap> = (
  event: MediaEndpointEventMap[K]
) => void;

export interface IMediaEndpoint {
  readonly state: MediaEndpointState;
  readonly participantId: string | null;
  readonly participants: ReadonlyMap<string, MediaEndpointParticipant>;
  readonly remoteTracks: ReadonlyMap<string, RemoteParticipantTrack>;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publishTrack(request: TrackPublicationRequest): Promise<TrackPublicationResult>;
  withdrawTrack(publicationId: string): Promise<void>;
  setPreferredLayer(publicationId: string, layer: SpatialLayer): Promise<void>;

  on<K extends keyof MediaEndpointEventMap>(
    event: K,
    handler: MediaEndpointEventHandler<K>
  ): () => void;
  off<K extends keyof MediaEndpointEventMap>(
    event: K,
    handler: MediaEndpointEventHandler<K>
  ): void;
}
