import { RoomPermission, ParticipantRoomRole } from '@minimeet/shared';

export type MediaTrackKind = 'audio' | 'video' | 'screen';

export interface TrackPublication {
  readonly publicationId: string;
  readonly ownerMembershipId: string;
  readonly kind: MediaTrackKind;
  readonly simulcast: boolean;
  readonly createdAt: number;
  readonly sfuTrackId?: string;
}

export interface ParticipantSummary {
  readonly membershipId: string;
  readonly userId: string;
  readonly role: ParticipantRoomRole;
  readonly joinedAt: number;
}

export interface RoomSnapshot {
  readonly roomId: string;
  readonly revision: number;
  readonly participants: readonly ParticipantSummary[];
  readonly publications: readonly TrackPublication[];
}

export interface MembershipRecord {
  readonly membershipId: string;
  readonly userId: string;
  readonly tenantId: string | null;
  readonly role: ParticipantRoomRole;
  readonly permissions: readonly RoomPermission[];
  readonly generation: number;
  readonly joinedAt: number;
  readonly lastHeartbeat: number;
  readonly publisherSessionId?: string;
  readonly subscriberSessionId?: string;
}

// Client to Coordinator Messages
export type ClientMessage =
  | { type: 'join'; token: string }
  | { type: 'publish'; kind: MediaTrackKind; simulcast?: boolean }
  | {
      type: 'publish_media';
      kind: MediaTrackKind;
      sdpOffer?: string;
      offerSdp?: string;
      mid?: string;
      simulcast?: boolean;
      requestId?: string;
    }
  | { type: 'withdraw'; publicationId: string }
  | { type: 'subscribe'; publicationIds: string[] }
  | {
      type: 'subscribe_media';
      publicationIds?: string[];
      tracks?: Array<{ publicationId: string; trackName?: string }>;
      sdpOffer?: string;
      offerSdp?: string;
      requestId?: string;
    }
  | { type: 'renegotiate_media'; requestId: string; sdpAnswer: string }
  | { type: 'chat'; text: string }
  | { type: 'ping' }
  | { type: 'leave' }
  | { type: 'get_snapshot' }
  | { type: 'collab_update'; documentName: string; update: string; requestId?: string }
  | { type: 'collab_sync'; documentName: string; requestId?: string }
  | { type: 'awareness_update'; documentName: string; state: string };

// Coordinator to Client Messages
export type ServerMessage =
  | {
      type: 'joined';
      membershipId: string;
      userId?: string;
      revision: number;
      snapshot: RoomSnapshot;
    }
  | {
      type: 'media_session_ready';
      publisherSessionId: string;
      subscriberSessionId: string;
    }
  | {
      type: 'publish_success';
      publication: TrackPublication;
      revision: number;
    }
  | {
      type: 'publish_media_success';
      publication: TrackPublication;
      sdpAnswer: string;
      answerSdp?: string;
      publicationId?: string;
      sfuTrackId?: string;
      revision: number;
      requestId?: string;
    }
  | {
      type: 'withdraw_success';
      publicationId: string;
      revision: number;
    }
  | {
      type: 'subscribe_media_offer';
      sdpOffer: string;
      tracks: Array<{ trackId: string; mid?: string }>;
      requestId: string;
    }
  | {
      type: 'subscribe_media_success';
      sdpAnswer?: string;
      answerSdp?: string;
      tracks: Array<{ trackId: string; mid?: string }>;
      revision: number;
      requestId?: string;
    }
  | {
      type: 'publication_added';
      publication: TrackPublication;
      publicationId?: string;
      ownerMembershipId?: string;
      kind?: MediaTrackKind;
      sfuTrackId?: string;
      revision: number;
    }
  | {
      type: 'publication_removed';
      publicationId: string;
      revision: number;
    }
  | {
      type: 'participant_joined';
      participant: ParticipantSummary;
      participantId?: string;
      userId?: string;
      role?: ParticipantRoomRole;
      joinedAt?: number;
      revision: number;
    }
  | {
      type: 'participant_left';
      membershipId: string;
      userId: string;
      participantId?: string;
      revision: number;
    }
  | {
      type: 'chat_message';
      senderId: string;
      senderRole: ParticipantRoomRole;
      text: string;
      timestamp: number;
    }
  | {
      type: 'collab_update';
      documentName: string;
      update: string;
      senderMembershipId: string;
    }
  | {
      type: 'collab_snapshot';
      documentName: string;
      snapshot: string | null;
      revision: number;
      requestId?: string;
    }
  | {
      type: 'awareness_broadcast';
      documentName: string;
      states: Array<{ membershipId: string; state: string }>;
    }
  | { type: 'pong' }
  | { type: 'snapshot'; snapshot: RoomSnapshot }
  | { type: 'error'; code: string; message: string };

export interface ConnectionContext {
  membershipId: string;
  userId: string;
  tenantId: string | null;
  role: ParticipantRoomRole;
  permissions: readonly RoomPermission[];
  generation: number;
  roomId: string;
  joinedAt: number;
  publisherSessionId?: string;
  subscriberSessionId?: string;
}
