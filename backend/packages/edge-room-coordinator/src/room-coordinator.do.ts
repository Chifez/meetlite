import {
  AsymmetricCapabilityService,
  RoomCapabilityClaims,
  Ed25519JwkPublicKey,
  RoomTier,
} from '@minimeet/shared';
import {
  ClientMessage,
  ServerMessage,
  ConnectionContext,
  RoomSnapshot,
  TrackPublication,
  MembershipRecord,
} from './types.js';
import { IRoomStorage, SqliteRoomStorage, InMemoryRoomStorage } from './storage.js';
import {
  ISfuSessionAdapter,
  MockSfuSessionAdapter,
  CloudflareCallsAdapter,
} from './sfu-adapter.js';
import { SpendAlarmManager } from './spend-alarm.js';
import { CollaborationManager } from './collaboration-manager.js';
import { HyperdriveBinding } from './hyperdrive-client.js';

class SessionMutationQueue {
  private queues = new Map<string, Promise<unknown>>();

  enqueue<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(sessionId) ?? Promise.resolve();
    const next = prev.then(task, task);
    this.queues.set(sessionId, next);
    return next as Promise<T>;
  }

  clear(sessionId: string): void {
    this.queues.delete(sessionId);
  }
}

export const TIER_LIMITS: Record<RoomTier, { maxParticipants: number; maxDurationMinutes: number }> = {
  free: { maxParticipants: 8, maxDurationMinutes: 40 },
  pro: { maxParticipants: 50, maxDurationMinutes: Infinity },
  enterprise: { maxParticipants: 100, maxDurationMinutes: Infinity },
};

export interface RoomCoordinatorEnv {
  ROOM_COORDINATOR?: any;
  CAPABILITY_PUBLIC_KEY_JWK?: string;
  CAPABILITY_AUDIENCE?: string;
  ENVIRONMENT?: string;
  CLOUDFLARE_CALLS_APP_ID?: string;
  CLOUDFLARE_CALLS_APP_SECRET?: string;
  HYPERDRIVE?: HyperdriveBinding;
  HYPERDRIVE_CACHED?: HyperdriveBinding;
  HYPERDRIVE_UNCACHED?: HyperdriveBinding;
}

export class RoomCoordinatorDO {
  private readonly storage: IRoomStorage;
  private readonly sfuAdapter: ISfuSessionAdapter;
  private readonly spendAlarmManager: SpendAlarmManager;
  private readonly collaborationManager: CollaborationManager;
  private readonly mutationQueue = new SessionMutationQueue();
  private readonly pendingRenegotiations = new Map<
    string,
    { membershipId: string; resolve: (answer: string) => void; reject: (error: Error) => void }
  >();
  private readonly connections = new Map<any, ConnectionContext>();
  private readonly userActiveConnections = new Map<string, { socket: any; generation: number }>();
  private readonly usedJtis = new Set<string>();
  private initialized = false;
  private cachedPublicKeyJwk?: Ed25519JwkPublicKey;
  private tier: RoomTier = 'free';
  private roomCreatedAt: number = Date.now();

  constructor(
    public readonly ctx: any,
    public readonly env: RoomCoordinatorEnv,
    storageOverride?: IRoomStorage,
    sfuAdapterOverride?: ISfuSessionAdapter,
    spendAlarmManagerOverride?: SpendAlarmManager
  ) {
    if (storageOverride) {
      this.storage = storageOverride;
    } else if (ctx?.storage?.sql) {
      this.storage = new SqliteRoomStorage(ctx.storage.sql);
    } else {
      this.storage = new InMemoryRoomStorage();
    }

    this.spendAlarmManager = spendAlarmManagerOverride ?? new SpendAlarmManager();
    this.collaborationManager = new CollaborationManager({
      storage: this.storage,
      maxBatchSize: 20,
      compactionThreshold: 50,
      flushIntervalMs: 500,
    });

    if (sfuAdapterOverride) {
      this.sfuAdapter = sfuAdapterOverride;
    } else if (env?.CLOUDFLARE_CALLS_APP_ID && env?.CLOUDFLARE_CALLS_APP_SECRET) {
      this.sfuAdapter = new CloudflareCallsAdapter({
        appId: env.CLOUDFLARE_CALLS_APP_ID,
        appSecret: env.CLOUDFLARE_CALLS_APP_SECRET,
      });
    } else {
      this.sfuAdapter = new MockSfuSessionAdapter();
    }
  }

  setRoomTier(tier: RoomTier): void {
    this.tier = tier;
    this.storage.setRoomMeta({ tier }).catch(() => {});
  }

  getRoomTier(): RoomTier {
    return this.tier;
  }

  setRoomCreatedAt(timestamp: number): void {
    this.roomCreatedAt = timestamp;
    this.storage.setRoomMeta({ createdAt: timestamp }).catch(() => {});
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.storage.initialize();
      const meta = await this.storage.getRoomMeta();
      if (meta.tier) {
        this.tier = meta.tier as RoomTier;
      }
      if (meta.createdAt > 0) {
        this.roomCreatedAt = meta.createdAt;
      } else {
        await this.storage.setRoomMeta({ tier: this.tier, createdAt: this.roomCreatedAt });
      }
      for (const socket of this.ctx?.getWebSockets?.() ?? []) {
        const context = this.deserializeConnectionContext(socket);
        if (!context) continue;
        this.connections.set(socket, context);
        const active = this.userActiveConnections.get(context.userId);
        if (!active || context.generation > active.generation) {
          this.userActiveConnections.set(context.userId, {
            socket,
            generation: context.generation,
          });
        }
      }
      this.initialized = true;
    }
  }

  private deserializeConnectionContext(socket: any): ConnectionContext | undefined {
    const value = socket?.deserializeAttachment?.();
    if (!value || typeof value !== 'object') return undefined;
    const context = value as ConnectionContext;
    if (
      typeof context.membershipId !== 'string' ||
      typeof context.userId !== 'string' ||
      typeof context.roomId !== 'string' ||
      typeof context.generation !== 'number' ||
      !Array.isArray(context.permissions)
    ) {
      return undefined;
    }
    return context;
  }

  private getConnectionContext(socket: any): ConnectionContext | undefined {
    const existing = this.connections.get(socket);
    if (existing) return existing;
    const restored = this.deserializeConnectionContext(socket);
    if (restored) {
      this.connections.set(socket, restored);
      this.userActiveConnections.set(restored.userId, {
        socket,
        generation: restored.generation,
      });
    }
    return restored;
  }

  async alarm(): Promise<void> {
    const tierConfig = TIER_LIMITS[this.tier] || TIER_LIMITS.free;
    if (tierConfig.maxDurationMinutes !== Infinity) {
      const elapsedMinutes = (Date.now() - this.roomCreatedAt) / (60 * 1000);
      if (elapsedMinutes >= tierConfig.maxDurationMinutes) {
        this.broadcast({
          type: 'error',
          code: 'ROOM_DURATION_EXCEEDED',
          message: `Free tier room duration limit of ${tierConfig.maxDurationMinutes} minutes reached`,
        });
        for (const [socket] of this.connections.entries()) {
          try {
            socket.close?.(4429, 'Room duration exceeded');
          } catch {}
        }
        this.connections.clear();
        this.userActiveConnections.clear();
      }
    }
  }

  setPublicKeyJwk(jwk: Ed25519JwkPublicKey): void {
    this.cachedPublicKeyJwk = jwk;
  }

  private getPublicKeyJwk(): Ed25519JwkPublicKey {
    if (this.cachedPublicKeyJwk) {
      return this.cachedPublicKeyJwk;
    }
    if (this.env?.CAPABILITY_PUBLIC_KEY_JWK) {
      try {
        this.cachedPublicKeyJwk = JSON.parse(this.env.CAPABILITY_PUBLIC_KEY_JWK);
        return this.cachedPublicKeyJwk!;
      } catch (err) {
        console.error('Failed to parse CAPABILITY_PUBLIC_KEY_JWK env var', err);
      }
    }
    throw new Error('RoomCoordinatorDO: No public key configured to verify capability tokens');
  }

  private roomIdFromPath(pathname: string): string | null {
    const match = pathname.match(/^\/rooms\/([^/]+)(?:\/|$)/);
    if (!match) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  }

  private async authorizeHttpRequest(
    request: Request,
    roomId: string,
    requireModeration = false
  ): Promise<RoomCapabilityClaims | Response> {
    const authorization = request.headers.get('authorization');
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const claims = await AsymmetricCapabilityService.verifyWithWebCrypto(
        token,
        this.getPublicKeyJwk(),
        { expectedRoomId: roomId, expectedAudience: this.env.CAPABILITY_AUDIENCE }
      );
      if (requireModeration && !claims.permissions.includes('moderate')) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return claims;
    } catch {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureInitialized();
    const url = new URL(request.url);

    const routedRoomId = this.roomIdFromPath(url.pathname);

    // Snapshot HTTP endpoint
    if (url.pathname.endsWith('/snapshot') && request.method === 'GET') {
      if (!routedRoomId) return new Response('Not found', { status: 404 });
      const authorization = await this.authorizeHttpRequest(request, routedRoomId);
      if (authorization instanceof Response) return authorization;
      const roomId = routedRoomId;
      const snapshot = await this.storage.getSnapshot(roomId);
      return new Response(JSON.stringify(snapshot), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Terminate room HTTP endpoint
    if (url.pathname.endsWith('/terminate') && request.method === 'POST') {
      if (!routedRoomId) return new Response('Not found', { status: 404 });
      const authorization = await this.authorizeHttpRequest(request, routedRoomId, true);
      if (authorization instanceof Response) return authorization;
      await this.terminateRoom();
      return new Response(JSON.stringify({ status: 'terminated' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // WebSocket upgrade handler
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const token = url.searchParams.get('token');
      const roomId = url.searchParams.get('roomId') || url.pathname.split('/')[2] || 'default-room';

      // Create WebSocket pair
      // Global WebSocketPair is standard in Cloudflare Workers / workerd
      const WebSocketPairClass = (globalThis as any).WebSocketPair;
      if (!WebSocketPairClass) {
        return new Response('WebSockets not supported in current environment', { status: 501 });
      }

      const pair = new WebSocketPairClass();
      const [clientWs, serverWs] = [pair[0], pair[1]];

      // Accept server socket
      if (this.ctx?.acceptWebSocket) {
        this.ctx.acceptWebSocket(serverWs);
      } else if (serverWs.accept) {
        serverWs.accept();
      }

      // If token provided in handshake URL, verify and admit immediately
      if (token) {
        this.handleAdmitSocket(serverWs, token, roomId).catch((err) => {
          this.sendSocket(serverWs, {
            type: 'error',
            code: 'AUTHENTICATION_FAILED',
            message: err.message || 'Capability verification failed',
          });
          serverWs.close(4003, 'Unauthorized');
        });
      } else {
        // Wait for first message { type: 'join', token }
        serverWs.addEventListener?.('message', async (event: any) => {
          if (!this.connections.has(serverWs)) {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'join' && data.token) {
                await this.handleAdmitSocket(serverWs, data.token, roomId);
              } else {
                this.sendSocket(serverWs, {
                  type: 'error',
                  code: 'UNAUTHENTICATED',
                  message: 'Must send join message with valid capability token',
                });
                serverWs.close(4001, 'Unauthorized');
              }
            } catch (err: any) {
              serverWs.close(4000, err.message || 'Malformed join message');
            }
          }
        });
      }

      this.bindSocketListeners(serverWs);

      return new Response(null, {
        status: 101,
        webSocket: clientWs,
      } as any);
    }

    return new Response('Not found', { status: 404 });
  }

  /**
   * Admits and authenticates a participant socket using their Ed25519 room capability token.
   */
  async handleAdmitSocket(socket: any, token: string, expectedRoomId: string): Promise<ConnectionContext> {
    const pubKeyJwk = this.getPublicKeyJwk();
    const claims: RoomCapabilityClaims = await AsymmetricCapabilityService.verifyWithWebCrypto(
      token,
      pubKeyJwk,
      {
        expectedRoomId,
        expectedAudience: this.env?.CAPABILITY_AUDIENCE,
      }
    );

    // Enforce durable single-use capability token (replay prevention)
    const isConsumed = await this.storage.isJtiConsumed(claims.jti);
    if (isConsumed || this.usedJtis.has(claims.jti)) {
      throw new Error(`Capability token ${claims.jti} has already been consumed`);
    }
    this.usedJtis.add(claims.jti);
    await this.storage.consumeJti(claims.jti);

    // Update room tier from capability claims if upgraded
    if (claims.tier) {
      if (claims.tier === 'enterprise' || (claims.tier === 'pro' && this.tier === 'free')) {
        this.tier = claims.tier;
        this.storage.setRoomMeta({ tier: this.tier }).catch(() => {});
      }
    }
    const tierConfig = TIER_LIMITS[this.tier] || TIER_LIMITS.free;

    // Check duration limit (e.g. Free Tier: 40 minutes)
    if (tierConfig.maxDurationMinutes !== Infinity) {
      const elapsedMinutes = (Date.now() - this.roomCreatedAt) / (60 * 1000);
      if (elapsedMinutes >= tierConfig.maxDurationMinutes) {
        this.sendSocket(socket, {
          type: 'error',
          code: 'ROOM_DURATION_EXCEEDED',
          message: `Free tier room duration limit of ${tierConfig.maxDurationMinutes} minutes exceeded`,
        });
        socket.close?.(4429, 'Room duration exceeded');
        throw new Error(`Room duration limit of ${tierConfig.maxDurationMinutes} minutes exceeded`);
      }

      // Schedule Cloudflare Durable Object alarm to terminate active free room at 40 minutes
      if (this.ctx?.storage?.setAlarm) {
        const alarmTime = this.roomCreatedAt + tierConfig.maxDurationMinutes * 60 * 1000;
        this.ctx.storage.setAlarm(alarmTime).catch?.(() => {});
      }
    }

    // Check application spend alarm admission throttle
    if (this.spendAlarmManager) {
      const spendCheck = this.spendAlarmManager.canAdmit(this.tier);
      if (!spendCheck.allowed) {
        this.sendSocket(socket, {
          type: 'error',
          code: spendCheck.code || 'BILLING_LIMIT_REACHED',
          message: spendCheck.reason || 'Billing limit reached',
        });
        socket.close?.(4429, 'Billing limit reached');
        throw new Error(spendCheck.reason || 'Billing limit reached');
      }
    }

    // Check participant capacity limits (Free: 8, Pro: 50, Enterprise: 100)
    // Note: Reconnecting users supersede an existing slot, so they do not consume additional capacity
    const durableMemberships = await this.storage.listMemberships();
    const durableExisting = await this.storage.getMembershipByUserId(claims.sub);
    const isReconnectingUser = this.userActiveConnections.has(claims.sub) || Boolean(durableExisting);
    const currentUniqueParticipants = new Set(durableMemberships.map((member) => member.userId)).size;
    if (!isReconnectingUser && currentUniqueParticipants >= tierConfig.maxParticipants) {
      this.sendSocket(socket, {
        type: 'error',
        code: 'ROOM_CAPACITY_EXCEEDED',
        message: `Room capacity limit of ${tierConfig.maxParticipants} reached for ${this.tier} tier`,
      });
      socket.close?.(4429, 'Room capacity exceeded');
      throw new Error(`Room capacity limit of ${tierConfig.maxParticipants} reached for ${this.tier} tier`);
    }

    // Generational replacement: if this user already has an active socket in this room,
    // supersede the old connection.
    let generation = 1;
    const existing = this.userActiveConnections.get(claims.sub);
    let oldContextToCleanup: ConnectionContext | undefined;
    if (existing) {
      generation = existing.generation + 1;
      oldContextToCleanup = this.connections.get(existing.socket);
      try {
        this.sendSocket(existing.socket, {
          type: 'error',
          code: 'SESSION_REPLACED',
          message: 'Session replaced by newer connection generation',
        });
        existing.socket.close?.(4001, 'Session replaced');
      } catch {
        // Ignore socket close failure on replaced connection
      }
      this.connections.delete(existing.socket);
    } else if (durableExisting) {
      generation = durableExisting.generation + 1;
      oldContextToCleanup = {
        ...durableExisting,
        roomId: claims.roomId,
      };
    }

    // Allocate separate publisher and subscriber SFU sessions
    let publisherSessionId: string | undefined;
    let subscriberSessionId: string | undefined;
    try {
      const pubSess = await this.sfuAdapter.createSession();
      const subSess = await this.sfuAdapter.createSession();
      publisherSessionId = pubSess.sessionId;
      subscriberSessionId = subSess.sessionId;
    } catch (sfuErr) {
      if (publisherSessionId) {
        await this.sfuAdapter.closeSession(publisherSessionId).catch(() => {});
      }
      this.sendSocket(socket, {
        type: 'error',
        code: 'SFU_UNAVAILABLE',
        message: 'Media service is temporarily unavailable',
      });
      socket.close?.(1013, 'Media service unavailable');
      throw sfuErr;
    }

    // Clean up replaced old session now that new session allocation has finished
    if (oldContextToCleanup) {
      await this.storage.deleteMembership(oldContextToCleanup.membershipId);
      await this.storage.deletePublicationsByMembership(oldContextToCleanup.membershipId);
      if (oldContextToCleanup.publisherSessionId) {
        this.sfuAdapter.closeSession(oldContextToCleanup.publisherSessionId).catch(() => {});
        this.mutationQueue.clear(oldContextToCleanup.publisherSessionId);
      }
      if (oldContextToCleanup.subscriberSessionId) {
        this.sfuAdapter.closeSession(oldContextToCleanup.subscriberSessionId).catch(() => {});
        this.mutationQueue.clear(oldContextToCleanup.subscriberSessionId);
      }
    }

    const now = Date.now();
    const membershipId = `mem_${crypto.randomUUID()}`;
    const context: ConnectionContext = {
      membershipId,
      userId: claims.sub,
      tenantId: claims.tenantId,
      role: claims.role,
      permissions: claims.permissions,
      generation,
      roomId: claims.roomId,
      joinedAt: now,
      publisherSessionId,
      subscriberSessionId,
    };

    const memberRecord: MembershipRecord = {
      membershipId,
      userId: claims.sub,
      tenantId: claims.tenantId,
      role: claims.role,
      permissions: claims.permissions,
      generation,
      joinedAt: now,
      lastHeartbeat: now,
      publisherSessionId,
      subscriberSessionId,
    };

    await this.storage.saveMembership(memberRecord);
    const revision = await this.storage.incrementRevision();

    this.connections.set(socket, context);
    this.userActiveConnections.set(claims.sub, { socket, generation });
    socket.serializeAttachment?.(context);

    // Send joined confirmation with full snapshot to joining client
    const snapshot = await this.storage.getSnapshot(claims.roomId);
    this.sendSocket(socket, {
      type: 'joined',
      membershipId,
      userId: claims.sub,
      revision,
      snapshot,
    });

    if (publisherSessionId && subscriberSessionId) {
      this.sendSocket(socket, {
        type: 'media_session_ready',
        publisherSessionId,
        subscriberSessionId,
      });
    }

    // Broadcast participant_joined to all other participants
    this.broadcast(
      {
        type: 'participant_joined',
        participant: {
          membershipId,
          userId: claims.sub,
          role: claims.role,
          joinedAt: now,
        },
        participantId: claims.sub,
        userId: claims.sub,
        role: claims.role,
        joinedAt: now,
        revision,
      },
      socket // exclude self
    );

    return context;
  }

  /**
   * Processes an incoming message from a verified connection.
   */
  async handleMessage(socket: any, message: ClientMessage): Promise<void> {
    const context = this.getConnectionContext(socket);
    if (!context) {
      this.sendSocket(socket, {
        type: 'error',
        code: 'UNAUTHENTICATED',
        message: 'Must authenticate before sending room commands',
      });
      return;
    }

    switch (message.type) {
      case 'publish': {
        // Permission check
        const requiredPermission =
          message.kind === 'audio'
            ? 'publish_audio'
            : message.kind === 'video'
              ? 'publish_video'
              : 'publish_screen';

        if (!context.permissions.includes(requiredPermission as any)) {
          this.sendSocket(socket, {
            type: 'error',
            code: 'FORBIDDEN_PUBLISH',
            message: `User lacks ${requiredPermission} permission in room ${context.roomId}`,
          });
          return;
        }

        const publication: TrackPublication = {
          publicationId: `pub_${crypto.randomUUID()}`,
          ownerMembershipId: context.membershipId,
          kind: message.kind,
          simulcast: Boolean(message.simulcast),
          createdAt: Date.now(),
        };

        await this.storage.savePublication(publication);
        const revision = await this.storage.incrementRevision();

        this.sendSocket(socket, {
          type: 'publish_success',
          publication,
          revision,
        });

        this.broadcast(
          {
            type: 'publication_added',
            publication,
            revision,
          },
          socket
        );
        break;
      }

      case 'publish_media': {
        const requiredPermission =
          message.kind === 'audio'
            ? 'publish_audio'
            : message.kind === 'video'
              ? 'publish_video'
              : 'publish_screen';

        if (!context.permissions.includes(requiredPermission as any)) {
          this.sendSocket(socket, {
            type: 'error',
            code: 'FORBIDDEN_PUBLISH',
            message: `User lacks ${requiredPermission} permission in room ${context.roomId}`,
          });
          return;
        }

        if (!context.publisherSessionId) {
          this.sendSocket(socket, {
            type: 'error',
            code: 'NO_SFU_SESSION',
            message: 'Publisher SFU session not initialized',
          });
          return;
        }

        const sdpOffer = message.sdpOffer || message.offerSdp;
        if (!sdpOffer || !message.mid) {
          this.sendSocket(socket, {
            type: 'error',
            code: 'INVALID_OFFER',
            message: 'Missing sdpOffer or transceiver mid in publish_media payload',
          });
          return;
        }
        const publicationMid = message.mid;

        await this.mutationQueue.enqueue(context.publisherSessionId, async () => {
          const publicationId = `pub_${crypto.randomUUID()}`;
          const sfuTrackResult = await this.sfuAdapter.publishTrack(
            context.publisherSessionId!,
            sdpOffer,
            publicationId,
            publicationMid
          );

          const publication: TrackPublication = {
            publicationId,
            ownerMembershipId: context.membershipId,
            kind: message.kind,
            simulcast: Boolean(message.simulcast),
            createdAt: Date.now(),
            sfuTrackId: sfuTrackResult.trackId,
          };

          await this.storage.savePublication(publication);
          const revision = await this.storage.incrementRevision();

          this.sendSocket(socket, {
            type: 'publish_media_success',
            publication,
            publicationId: publication.publicationId,
            sfuTrackId: publication.sfuTrackId,
            sdpAnswer: sfuTrackResult.sdpAnswer,
            answerSdp: sfuTrackResult.sdpAnswer,
            revision,
            requestId: message.requestId,
          });

          this.broadcast(
            {
              type: 'publication_added',
              publication,
              publicationId: publication.publicationId,
              ownerMembershipId: publication.ownerMembershipId,
              kind: publication.kind,
              sfuTrackId: publication.sfuTrackId,
              revision,
            },
            socket
          );
        });
        break;
      }

      case 'withdraw': {
        const publication = await this.storage.getPublication(message.publicationId);
        if (!publication) {
          this.sendSocket(socket, {
            type: 'error',
            code: 'PUBLICATION_NOT_FOUND',
            message: 'Track publication not found',
          });
          return;
        }

        // Must own the publication OR be moderator/host
        const isOwner = publication.ownerMembershipId === context.membershipId;
        const canModerate = context.permissions.includes('moderate');

        if (!isOwner && !canModerate) {
          this.sendSocket(socket, {
            type: 'error',
            code: 'FORBIDDEN_WITHDRAW',
            message: 'Cannot withdraw publication owned by another participant without moderate permission',
          });
          return;
        }

        if (context.publisherSessionId) {
          await this.sfuAdapter.closeTrack(context.publisherSessionId, publication.publicationId);
        }
        await this.storage.deletePublication(message.publicationId);
        const revision = await this.storage.incrementRevision();

        this.sendSocket(socket, {
          type: 'withdraw_success',
          publicationId: message.publicationId,
          revision,
        });

        this.broadcast(
          {
            type: 'publication_removed',
            publicationId: message.publicationId,
            revision,
          },
          socket
        );
        break;
      }

      case 'subscribe': {
        if (!context.permissions.includes('subscribe')) {
          this.sendSocket(socket, {
            type: 'error',
            code: 'FORBIDDEN_SUBSCRIBE',
            message: 'User lacks subscribe permission',
          });
          return;
        }
        // Subscriptions are confirmed to client
        break;
      }

      case 'subscribe_media': {
        if (!context.permissions.includes('subscribe')) {
          this.sendSocket(socket, {
            type: 'error',
            code: 'FORBIDDEN_SUBSCRIBE',
            message: 'User lacks subscribe permission',
          });
          return;
        }

        if (!context.subscriberSessionId) {
          this.sendSocket(socket, {
            type: 'error',
            code: 'NO_SFU_SESSION',
            message: 'Subscriber SFU session not initialized',
          });
          return;
        }

        const pubIds =
          message.publicationIds ||
          (message.tracks ? message.tracks.map((t: any) => t.publicationId) : []);
        await this.mutationQueue.enqueue(context.subscriberSessionId, async () => {
          const tracksToPull: Array<{ publisherSessionId: string; trackName: string }> = [];
          for (const pubId of pubIds) {
            const pub = await this.storage.getPublication(pubId);
            if (pub) {
              const owner = await this.storage.getMembership(pub.ownerMembershipId);
              if (owner && owner.publisherSessionId) {
                tracksToPull.push({
                  publisherSessionId: owner.publisherSessionId,
                  trackName: pub.sfuTrackId || pub.publicationId,
                });
              }
            }
          }

          const subResult = await this.sfuAdapter.subscribeTracks(
            context.subscriberSessionId!,
            tracksToPull
          );

          const requestId = message.requestId || `sub_${crypto.randomUUID()}`;
          this.sendSocket(socket, {
            type: 'subscribe_media_offer',
            sdpOffer: subResult.sdpOffer,
            tracks: subResult.tracks,
            requestId,
          });

          const sdpAnswer = await new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => {
              const pending = this.pendingRenegotiations.get(requestId);
              if (pending) {
                this.pendingRenegotiations.delete(requestId);
                pending.reject(new Error('SFU renegotiation timed out'));
              }
            }, 15_000);
            this.pendingRenegotiations.set(requestId, {
              membershipId: context.membershipId,
              resolve: (answer) => {
                clearTimeout(timeout);
                resolve(answer);
              },
              reject: (error) => {
                clearTimeout(timeout);
                reject(error);
              },
            });
          });

          await this.sfuAdapter.renegotiateSession(context.subscriberSessionId!, sdpAnswer);

          const revision = await this.storage.getRevision();
          this.sendSocket(socket, {
            type: 'subscribe_media_success',
            tracks: subResult.tracks,
            revision,
            requestId,
          });
        });
        break;
      }

      case 'renegotiate_media': {
        const pending = this.pendingRenegotiations.get(message.requestId);
        if (!pending || pending.membershipId !== context.membershipId) {
          this.sendSocket(socket, {
            type: 'error',
            code: 'INVALID_RENEGOTIATION',
            message: 'No matching subscription renegotiation is pending',
          });
          return;
        }
        this.pendingRenegotiations.delete(message.requestId);
        pending.resolve(message.sdpAnswer);
        break;
      }

      case 'collab_update': {
        if (context.role === 'viewer' || !context.permissions.includes('chat')) {
          this.sendSocket(socket, {
            type: 'error',
            code: 'FORBIDDEN_COLLABORATION',
            message: 'This room role cannot modify collaboration state',
          });
          return;
        }
        if (message.update && message.documentName) {
          const updateBytes = Buffer.from(message.update, 'base64');
          await this.collaborationManager.queueUpdate(message.documentName, updateBytes);
          this.broadcast(
            {
              type: 'collab_update',
              documentName: message.documentName,
              update: message.update,
              senderMembershipId: context.membershipId,
            },
            socket
          );
        }
        break;
      }

      case 'collab_sync': {
        if (message.documentName) {
          const consolidated = await this.collaborationManager.getConsolidatedDocumentState(message.documentName);
          const restored = await this.collaborationManager.restoreDocument(message.documentName);
          const snapshotB64 = consolidated
            ? Buffer.from(consolidated).toString('base64')
            : null;
          this.sendSocket(socket, {
            type: 'collab_snapshot',
            documentName: message.documentName,
            snapshot: snapshotB64,
            revision: restored.totalDeltas,
            requestId: message.requestId,
          });
        }
        break;
      }

      case 'awareness_update': {
        if (message.documentName && message.state) {
          const stateBytes = Buffer.from(message.state, 'base64');
          this.collaborationManager.updateAwareness(
            message.documentName,
            context.membershipId,
            stateBytes
          );
          const allStates = this.collaborationManager.getAwarenessStates(message.documentName);
          const statesArray = Array.from(allStates.entries()).map(([mId, raw]) => ({
            membershipId: mId,
            state: Buffer.from(raw).toString('base64'),
          }));
          this.broadcast({
            type: 'awareness_broadcast',
            documentName: message.documentName,
            states: statesArray,
          });
        }
        break;
      }

      case 'chat': {
        if (!context.permissions.includes('chat')) {
          this.sendSocket(socket, {
            type: 'error',
            code: 'FORBIDDEN_CHAT',
            message: 'User lacks chat permission',
          });
          return;
        }
        if (typeof message.text !== 'string' || message.text.length === 0 || message.text.length > 4_000) {
          this.sendSocket(socket, {
            type: 'error',
            code: 'INVALID_CHAT_MESSAGE',
            message: 'Chat messages must contain between 1 and 4000 characters',
          });
          return;
        }

        // Secure broadcast: senderId and role are attached from trusted context, NOT from client!
        this.broadcast({
          type: 'chat_message',
          senderId: context.userId,
          senderRole: context.role,
          text: message.text,
          timestamp: Date.now(),
        });
        break;
      }

      case 'get_snapshot': {
        const snapshot = await this.storage.getSnapshot(context.roomId);
        this.sendSocket(socket, {
          type: 'snapshot',
          snapshot,
        });
        break;
      }

      case 'ping': {
        this.sendSocket(socket, { type: 'pong' });
        break;
      }

      case 'leave': {
        await this.handleDisconnect(socket);
        try {
          socket.close(1000, 'Left room');
        } catch {
          // Ignore close error
        }
        break;
      }
    }
  }

  /**
   * Cleans up state when a participant leaves or disconnects.
   */
  async handleDisconnect(socket: any): Promise<void> {
    const context = this.getConnectionContext(socket);
    if (!context) return;

    this.connections.delete(socket);
    const active = this.userActiveConnections.get(context.userId);
    if (active && active.socket === socket) {
      this.userActiveConnections.delete(context.userId);
    }

    // Remove participant's publications
    const deletedPubIds = await this.storage.deletePublicationsByMembership(context.membershipId);
    await this.storage.deleteMembership(context.membershipId);
    const revision = await this.storage.incrementRevision();

    // Broadcast track removals if any
    for (const pubId of deletedPubIds) {
      this.broadcast({
        type: 'publication_removed',
        publicationId: pubId,
        revision,
      });
    }

    // Broadcast participant_left
    this.broadcast({
      type: 'participant_left',
      membershipId: context.membershipId,
      userId: context.userId,
      participantId: context.userId,
      revision,
    });

    // Teardown SFU sessions and mutation queues
    if (context.publisherSessionId) {
      await this.sfuAdapter.closeSession(context.publisherSessionId);
      this.mutationQueue.clear(context.publisherSessionId);
    }
    if (context.subscriberSessionId) {
      await this.sfuAdapter.closeSession(context.subscriberSessionId);
      this.mutationQueue.clear(context.subscriberSessionId);
    }

    // Clean up awareness and flush durable collaboration updates
    this.collaborationManager.removeAwarenessForClient(context.membershipId);
    await this.collaborationManager.flush();

    // Record participant duration in spend alarm tracking
    const durationMinutes = (Date.now() - context.joinedAt) / (60 * 1000);
    this.spendAlarmManager.recordUsage(Math.max(0.1, Number(durationMinutes.toFixed(2))));
  }

  /**
   * Forcefully terminates the room (e.g. host ended meeting).
   */
  async terminateRoom(): Promise<void> {
    for (const [socket] of this.connections.entries()) {
      try {
        this.sendSocket(socket, {
          type: 'error',
          code: 'ROOM_TERMINATED',
          message: 'The room has been terminated by an administrator or host',
        });
        socket.close(1000, 'Room terminated');
      } catch {
        // Ignore error
      }
    }

    this.connections.clear();
    this.userActiveConnections.clear();
    this.usedJtis.clear();
    await this.storage.clearAll();
  }

  private sendSocket(socket: any, message: ServerMessage): void {
    try {
      socket.send(JSON.stringify(message));
    } catch (err) {
      console.error('Failed to send message over socket', err);
    }
  }

  private broadcast(message: ServerMessage, excludeSocket?: any): void {
    const payload = JSON.stringify(message);
    for (const [socket] of this.connections.entries()) {
      if (socket !== excludeSocket) {
        try {
          socket.send(payload);
        } catch (err) {
          console.error('Failed to broadcast to socket', err);
        }
      }
    }
  }

  private bindSocketListeners(socket: any): void {
    socket.addEventListener?.('message', async (event: any) => {
      try {
        const message: ClientMessage = JSON.parse(event.data);
        await this.handleMessage(socket, message);
      } catch (err: any) {
        this.sendSocket(socket, {
          type: 'error',
          code: 'INVALID_MESSAGE',
          message: err.message || 'Failed to parse message',
        });
      }
    });

    socket.addEventListener?.('close', async () => {
      await this.handleDisconnect(socket);
    });

    socket.addEventListener?.('error', async () => {
      await this.handleDisconnect(socket);
    });
  }

  // Cloudflare Workers WebSocket Hibernation lifecycle hooks
  async webSocketMessage(ws: any, message: string | ArrayBuffer): Promise<void> {
    try {
      const parsed: ClientMessage = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
      await this.handleMessage(ws, parsed);
    } catch (err: any) {
      this.sendSocket(ws, {
        type: 'error',
        code: 'INVALID_MESSAGE',
        message: err.message || 'Failed to parse message',
      });
    }
  }

  async webSocketClose(ws: any): Promise<void> {
    await this.handleDisconnect(ws);
  }

  async webSocketError(ws: any): Promise<void> {
    await this.handleDisconnect(ws);
  }
}
