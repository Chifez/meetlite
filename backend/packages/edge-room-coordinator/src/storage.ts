import {
  MembershipRecord,
  TrackPublication,
  ParticipantSummary,
  RoomSnapshot,
  MediaTrackKind,
} from './types.js';

export interface CollaborationSnapshot {
  documentName: string;
  data: Uint8Array;
  revision: number;
  compactedAt: number;
}

export interface CollaborationUpdate {
  updateId: number;
  documentName: string;
  data: Uint8Array;
  createdAt: number;
}

export interface IRoomStorage {
  initialize(): Promise<void>;
  getRevision(): Promise<number>;
  incrementRevision(): Promise<number>;
  saveMembership(member: MembershipRecord): Promise<void>;
  deleteMembership(membershipId: string): Promise<void>;
  getMembership(membershipId: string): Promise<MembershipRecord | null>;
  getMembershipByUserId(userId: string): Promise<MembershipRecord | null>;
  listMemberships(): Promise<MembershipRecord[]>;
  savePublication(pub: TrackPublication): Promise<void>;
  deletePublication(publicationId: string): Promise<void>;
  deletePublicationsByMembership(membershipId: string): Promise<string[]>;
  getPublication(publicationId: string): Promise<TrackPublication | null>;
  listPublications(): Promise<TrackPublication[]>;
  getSnapshot(roomId: string): Promise<RoomSnapshot>;
  clearAll(): Promise<void>;

  // Room metadata & durable authority
  getRoomMeta(): Promise<{ revision: number; tier: string; createdAt: number }>;
  setRoomMeta(meta: { revision?: number; tier?: string; createdAt?: number }): Promise<void>;
  isJtiConsumed(jti: string): Promise<boolean>;
  consumeJti(jti: string): Promise<void>;

  // Collaboration State Persistence (CRDTs)
  saveCollaborationSnapshot(documentName: string, data: Uint8Array, revision: number): Promise<void>;
  getCollaborationSnapshot(documentName: string): Promise<CollaborationSnapshot | null>;
  appendCollaborationUpdates(documentName: string, updates: Uint8Array[]): Promise<void>;
  listCollaborationUpdates(documentName: string): Promise<CollaborationUpdate[]>;
  pruneCollaborationUpdates(documentName: string, upToId?: number): Promise<void>;
}

/**
 * In-Memory room storage for unit tests, local emulation, and environments without DO SQLite.
 */
export class InMemoryRoomStorage implements IRoomStorage {
  private revision = 0;
  private readonly memberships = new Map<string, MembershipRecord>();
  private readonly publications = new Map<string, TrackPublication>();
  private readonly snapshots = new Map<string, CollaborationSnapshot>();
  private readonly updates = new Map<string, CollaborationUpdate[]>();
  private readonly consumedJtis = new Set<string>();
  private roomTier = 'free';
  private roomCreatedAt = Date.now();
  private nextUpdateId = 1;

  async initialize(): Promise<void> {
    // No-op for in-memory
  }

  async getRevision(): Promise<number> {
    return this.revision;
  }

  async incrementRevision(): Promise<number> {
    this.revision += 1;
    return this.revision;
  }

  async saveMembership(member: MembershipRecord): Promise<void> {
    this.memberships.set(member.membershipId, member);
  }

  async deleteMembership(membershipId: string): Promise<void> {
    this.memberships.delete(membershipId);
  }

  async getMembership(membershipId: string): Promise<MembershipRecord | null> {
    return this.memberships.get(membershipId) ?? null;
  }

  async getMembershipByUserId(userId: string): Promise<MembershipRecord | null> {
    for (const member of this.memberships.values()) {
      if (member.userId === userId) return member;
    }
    return null;
  }

  async listMemberships(): Promise<MembershipRecord[]> {
    return Array.from(this.memberships.values());
  }

  async savePublication(pub: TrackPublication): Promise<void> {
    this.publications.set(pub.publicationId, pub);
  }

  async deletePublication(publicationId: string): Promise<void> {
    this.publications.delete(publicationId);
  }

  async deletePublicationsByMembership(membershipId: string): Promise<string[]> {
    const deletedIds: string[] = [];
    for (const [id, pub] of this.publications.entries()) {
      if (pub.ownerMembershipId === membershipId) {
        deletedIds.push(id);
        this.publications.delete(id);
      }
    }
    return deletedIds;
  }

  async getPublication(publicationId: string): Promise<TrackPublication | null> {
    return this.publications.get(publicationId) ?? null;
  }

  async listPublications(): Promise<TrackPublication[]> {
    return Array.from(this.publications.values());
  }

  async getSnapshot(roomId: string): Promise<RoomSnapshot> {
    const participants: ParticipantSummary[] = Array.from(this.memberships.values()).map((m) => ({
      membershipId: m.membershipId,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
    }));

    const pubs: TrackPublication[] = Array.from(this.publications.values());

    return {
      roomId,
      revision: this.revision,
      participants,
      publications: pubs,
    };
  }

  async clearAll(): Promise<void> {
    this.revision = 0;
    this.memberships.clear();
    this.publications.clear();
    this.snapshots.clear();
    this.updates.clear();
    this.consumedJtis.clear();
    this.roomTier = 'free';
    this.roomCreatedAt = Date.now();
    this.nextUpdateId = 1;
  }

  async isJtiConsumed(jti: string): Promise<boolean> {
    return this.consumedJtis.has(jti);
  }

  async consumeJti(jti: string): Promise<void> {
    this.consumedJtis.add(jti);
  }

  async getRoomMeta(): Promise<{ revision: number; tier: string; createdAt: number }> {
    return {
      revision: this.revision,
      tier: this.roomTier,
      createdAt: this.roomCreatedAt,
    };
  }

  async setRoomMeta(meta: { revision?: number; tier?: string; createdAt?: number }): Promise<void> {
    if (meta.revision !== undefined) this.revision = meta.revision;
    if (meta.tier !== undefined) this.roomTier = meta.tier;
    if (meta.createdAt !== undefined) this.roomCreatedAt = meta.createdAt;
  }

  // Collaboration State Persistence (CRDTs)
  async saveCollaborationSnapshot(
    documentName: string,
    data: Uint8Array,
    revision: number
  ): Promise<void> {
    this.snapshots.set(documentName, {
      documentName,
      data,
      revision,
      compactedAt: Date.now(),
    });
  }

  async getCollaborationSnapshot(documentName: string): Promise<CollaborationSnapshot | null> {
    return this.snapshots.get(documentName) ?? null;
  }

  async appendCollaborationUpdates(documentName: string, updates: Uint8Array[]): Promise<void> {
    if (!this.updates.has(documentName)) {
      this.updates.set(documentName, []);
    }
    const list = this.updates.get(documentName)!;
    const now = Date.now();
    for (const data of updates) {
      list.push({
        updateId: this.nextUpdateId++,
        documentName,
        data,
        createdAt: now,
      });
    }
  }

  async listCollaborationUpdates(documentName: string): Promise<CollaborationUpdate[]> {
    return [...(this.updates.get(documentName) ?? [])];
  }

  async pruneCollaborationUpdates(documentName: string, upToId?: number): Promise<void> {
    if (!this.updates.has(documentName)) return;
    if (upToId === undefined) {
      this.updates.set(documentName, []);
    } else {
      const remaining = (this.updates.get(documentName) ?? []).filter((u) => u.updateId > upToId);
      this.updates.set(documentName, remaining);
    }
  }
}

/**
 * Cloudflare Durable Object SQLite storage adapter utilizing `ctx.storage.sql`.
 */
export class SqliteRoomStorage implements IRoomStorage {
  constructor(private readonly sql: any) {}

  async initialize(): Promise<void> {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS room_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS consumed_jtis (
        jti TEXT PRIMARY KEY,
        consumed_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS memberships (
        membership_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        tenant_id TEXT,
        role TEXT NOT NULL,
        permissions TEXT NOT NULL,
        generation INTEGER NOT NULL,
        joined_at INTEGER NOT NULL,
        last_heartbeat INTEGER NOT NULL,
        publisher_session_id TEXT,
        subscriber_session_id TEXT
      );

      CREATE TABLE IF NOT EXISTS publications (
        publication_id TEXT PRIMARY KEY,
        owner_membership_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        simulcast INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        sfu_track_id TEXT
      );

      CREATE TABLE IF NOT EXISTS collaboration_snapshots (
        document_name TEXT PRIMARY KEY,
        data BLOB NOT NULL,
        revision INTEGER NOT NULL,
        compacted_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS collaboration_updates (
        update_id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_name TEXT NOT NULL,
        data BLOB NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_collab_updates_doc ON collaboration_updates(document_name, update_id);

      INSERT OR IGNORE INTO room_meta (key, value) VALUES ('revision', '0');
      INSERT OR IGNORE INTO room_meta (key, value) VALUES ('tier', 'free');
    `);
  }

  async getRevision(): Promise<number> {
    const cursor = this.sql.exec("SELECT value FROM room_meta WHERE key = 'revision'");
    for (const row of cursor) {
      return Number(row.value) || 0;
    }
    return 0;
  }

  async incrementRevision(): Promise<number> {
    this.sql.exec("UPDATE room_meta SET value = value + 1 WHERE key = 'revision'");
    return this.getRevision();
  }

  async saveMembership(member: MembershipRecord): Promise<void> {
    this.sql.exec(
      `INSERT OR REPLACE INTO memberships 
       (membership_id, user_id, tenant_id, role, permissions, generation, joined_at, last_heartbeat, publisher_session_id, subscriber_session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      member.membershipId,
      member.userId,
      member.tenantId,
      member.role,
      JSON.stringify(member.permissions),
      member.generation,
      member.joinedAt,
      member.lastHeartbeat,
      member.publisherSessionId || null,
      member.subscriberSessionId || null
    );
  }

  async deleteMembership(membershipId: string): Promise<void> {
    this.sql.exec('DELETE FROM memberships WHERE membership_id = ?', membershipId);
  }

  async getMembership(membershipId: string): Promise<MembershipRecord | null> {
    const cursor = this.sql.exec(
      'SELECT * FROM memberships WHERE membership_id = ?',
      membershipId
    );
    for (const row of cursor) {
      return {
        membershipId: row.membership_id,
        userId: row.user_id,
        tenantId: row.tenant_id,
        role: row.role,
        permissions: JSON.parse(row.permissions),
        generation: Number(row.generation),
        joinedAt: Number(row.joined_at),
        lastHeartbeat: Number(row.last_heartbeat),
        publisherSessionId: row.publisher_session_id || undefined,
        subscriberSessionId: row.subscriber_session_id || undefined,
      };
    }
    return null;
  }

  async getMembershipByUserId(userId: string): Promise<MembershipRecord | null> {
    const cursor = this.sql.exec(
      'SELECT * FROM memberships WHERE user_id = ? ORDER BY joined_at DESC LIMIT 1',
      userId
    );
    for (const row of cursor) {
      return {
        membershipId: row.membership_id,
        userId: row.user_id,
        tenantId: row.tenant_id,
        role: row.role,
        permissions: JSON.parse(row.permissions),
        generation: Number(row.generation),
        joinedAt: Number(row.joined_at),
        lastHeartbeat: Number(row.last_heartbeat),
        publisherSessionId: row.publisher_session_id || undefined,
        subscriberSessionId: row.subscriber_session_id || undefined,
      };
    }
    return null;
  }

  async listMemberships(): Promise<MembershipRecord[]> {
    const cursor = this.sql.exec('SELECT * FROM memberships ORDER BY joined_at ASC');
    const result: MembershipRecord[] = [];
    for (const row of cursor) {
      result.push({
        membershipId: row.membership_id,
        userId: row.user_id,
        tenantId: row.tenant_id,
        role: row.role,
        permissions: JSON.parse(row.permissions),
        generation: Number(row.generation),
        joinedAt: Number(row.joined_at),
        lastHeartbeat: Number(row.last_heartbeat),
        publisherSessionId: row.publisher_session_id || undefined,
        subscriberSessionId: row.subscriber_session_id || undefined,
      });
    }
    return result;
  }

  async savePublication(pub: TrackPublication): Promise<void> {
    this.sql.exec(
      `INSERT OR REPLACE INTO publications
       (publication_id, owner_membership_id, kind, simulcast, created_at, sfu_track_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      pub.publicationId,
      pub.ownerMembershipId,
      pub.kind,
      pub.simulcast ? 1 : 0,
      pub.createdAt,
      pub.sfuTrackId || null
    );
  }

  async deletePublication(publicationId: string): Promise<void> {
    this.sql.exec('DELETE FROM publications WHERE publication_id = ?', publicationId);
  }

  async deletePublicationsByMembership(membershipId: string): Promise<string[]> {
    const cursor = this.sql.exec(
      'SELECT publication_id FROM publications WHERE owner_membership_id = ?',
      membershipId
    );
    const ids: string[] = [];
    for (const row of cursor) {
      ids.push(row.publication_id);
    }
    if (ids.length > 0) {
      this.sql.exec(
        'DELETE FROM publications WHERE owner_membership_id = ?',
        membershipId
      );
    }
    return ids;
  }

  async getPublication(publicationId: string): Promise<TrackPublication | null> {
    const cursor = this.sql.exec(
      'SELECT * FROM publications WHERE publication_id = ?',
      publicationId
    );
    for (const row of cursor) {
      return {
        publicationId: row.publication_id,
        ownerMembershipId: row.owner_membership_id,
        kind: row.kind as MediaTrackKind,
        simulcast: Boolean(row.simulcast),
        createdAt: Number(row.created_at),
        sfuTrackId: row.sfu_track_id || undefined,
      };
    }
    return null;
  }

  async listPublications(): Promise<TrackPublication[]> {
    const cursor = this.sql.exec('SELECT * FROM publications ORDER BY created_at ASC');
    const result: TrackPublication[] = [];
    for (const row of cursor) {
      result.push({
        publicationId: row.publication_id,
        ownerMembershipId: row.owner_membership_id,
        kind: row.kind as MediaTrackKind,
        simulcast: Boolean(row.simulcast),
        createdAt: Number(row.created_at),
        sfuTrackId: row.sfu_track_id || undefined,
      });
    }
    return result;
  }

  async getSnapshot(roomId: string): Promise<RoomSnapshot> {
    const revision = await this.getRevision();
    const memberships = await this.listMemberships();
    const publications = await this.listPublications();

    const participants: ParticipantSummary[] = memberships.map((m) => ({
      membershipId: m.membershipId,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
    }));

    return {
      roomId,
      revision,
      participants,
      publications,
    };
  }

  async clearAll(): Promise<void> {
    this.sql.exec('DELETE FROM publications');
    this.sql.exec('DELETE FROM memberships');
    this.sql.exec('DELETE FROM collaboration_updates');
    this.sql.exec('DELETE FROM collaboration_snapshots');
    this.sql.exec('DELETE FROM consumed_jtis');
    this.sql.exec("UPDATE room_meta SET value = '0' WHERE key = 'revision'");
    this.sql.exec("UPDATE room_meta SET value = 'free' WHERE key = 'tier'");
    this.sql.exec(`UPDATE room_meta SET value = '${Date.now()}' WHERE key = 'created_at'`);
  }

  async isJtiConsumed(jti: string): Promise<boolean> {
    const cursor = this.sql.exec('SELECT 1 FROM consumed_jtis WHERE jti = ?', jti);
    for (const _ of cursor) {
      return true;
    }
    return false;
  }

  async consumeJti(jti: string): Promise<void> {
    this.sql.exec(
      'INSERT OR REPLACE INTO consumed_jtis (jti, consumed_at) VALUES (?, ?)',
      jti,
      Date.now()
    );
  }

  async getRoomMeta(): Promise<{ revision: number; tier: string; createdAt: number }> {
    const cursor = this.sql.exec("SELECT key, value FROM room_meta WHERE key IN ('revision', 'tier', 'created_at')");
    let revision = 0;
    let tier = 'free';
    let createdAt = Date.now();
    for (const row of cursor) {
      if (row.key === 'revision') revision = Number(row.value) || 0;
      if (row.key === 'tier') tier = String(row.value) || 'free';
      if (row.key === 'created_at') createdAt = Number(row.value) || Date.now();
    }
    return { revision, tier, createdAt };
  }

  async setRoomMeta(meta: { revision?: number; tier?: string; createdAt?: number }): Promise<void> {
    if (meta.revision !== undefined) {
      this.sql.exec("INSERT OR REPLACE INTO room_meta (key, value) VALUES ('revision', ?)", String(meta.revision));
    }
    if (meta.tier !== undefined) {
      this.sql.exec("INSERT OR REPLACE INTO room_meta (key, value) VALUES ('tier', ?)", meta.tier);
    }
    if (meta.createdAt !== undefined) {
      this.sql.exec("INSERT OR REPLACE INTO room_meta (key, value) VALUES ('created_at', ?)", String(meta.createdAt));
    }
  }

  // Collaboration State Persistence (CRDTs)
  async saveCollaborationSnapshot(
    documentName: string,
    data: Uint8Array,
    revision: number
  ): Promise<void> {
    this.sql.exec(
      `INSERT OR REPLACE INTO collaboration_snapshots
       (document_name, data, revision, compacted_at)
       VALUES (?, ?, ?, ?)`,
      documentName,
      data,
      revision,
      Date.now()
    );
  }

  async getCollaborationSnapshot(documentName: string): Promise<CollaborationSnapshot | null> {
    const cursor = this.sql.exec(
      'SELECT * FROM collaboration_snapshots WHERE document_name = ?',
      documentName
    );
    for (const row of cursor) {
      const data = row.data instanceof Uint8Array ? row.data : new Uint8Array(row.data);
      return {
        documentName: row.document_name,
        data,
        revision: Number(row.revision),
        compactedAt: Number(row.compacted_at),
      };
    }
    return null;
  }

  async appendCollaborationUpdates(documentName: string, updates: Uint8Array[]): Promise<void> {
    if (updates.length === 0) return;
    const now = Date.now();
    this.sql.exec('BEGIN TRANSACTION');
    try {
      for (const data of updates) {
        this.sql.exec(
          `INSERT INTO collaboration_updates (document_name, data, created_at)
           VALUES (?, ?, ?)`,
          documentName,
          data,
          now
        );
      }
      this.sql.exec('COMMIT');
    } catch (err) {
      try {
        this.sql.exec('ROLLBACK');
      } catch {}
      throw err;
    }
  }

  async listCollaborationUpdates(documentName: string): Promise<CollaborationUpdate[]> {
    const cursor = this.sql.exec(
      'SELECT update_id, document_name, data, created_at FROM collaboration_updates WHERE document_name = ? ORDER BY update_id ASC',
      documentName
    );
    const result: CollaborationUpdate[] = [];
    for (const row of cursor) {
      const data = row.data instanceof Uint8Array ? row.data : new Uint8Array(row.data);
      result.push({
        updateId: Number(row.update_id),
        documentName: row.document_name,
        data,
        createdAt: Number(row.created_at),
      });
    }
    return result;
  }

  async pruneCollaborationUpdates(documentName: string, upToId?: number): Promise<void> {
    if (upToId !== undefined) {
      this.sql.exec(
        'DELETE FROM collaboration_updates WHERE document_name = ? AND update_id <= ?',
        documentName,
        upToId
      );
    } else {
      this.sql.exec('DELETE FROM collaboration_updates WHERE document_name = ?', documentName);
    }
  }
}
