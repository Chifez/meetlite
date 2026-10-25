export interface FakeParticipant {
  membershipId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  generation: number;
  joinedAt: Date;
}

export interface FakePublication {
  publicationId: string;
  membershipId: string;
  kind: 'audio' | 'video' | 'screen';
  simulcast: boolean;
}

export interface FakeRoomSnapshot {
  roomId: string;
  revision: number;
  participants: FakeParticipant[];
  publications: FakePublication[];
}

/**
 * Deterministic Room Backend Fake.
 * Simulates room coordination, membership generations, and publications.
 */
export class FakeRoomBackend {
  private roomId: string;
  private revision = 0;
  private maxCapacity: number;
  private participants = new Map<string, FakeParticipant>();
  private publications = new Map<string, FakePublication>();
  private membershipCounter = 0;
  private publicationCounter = 0;

  constructor(roomId: string, maxCapacity = 50) {
    this.roomId = roomId;
    this.maxCapacity = maxCapacity;
  }

  join(userId: string, role: FakeParticipant['role'] = 'member'): { membership: FakeParticipant; snapshot: FakeRoomSnapshot } {
    if (this.participants.size >= this.maxCapacity) {
      throw new Error('ROOM_CAPACITY_EXCEEDED');
    }

    const membershipId = `mem_${++this.membershipCounter}`;
    const participant: FakeParticipant = {
      membershipId,
      userId,
      role,
      generation: 1,
      joinedAt: new Date(),
    };

    this.participants.set(membershipId, participant);
    this.revision += 1;

    return {
      membership: participant,
      snapshot: this.getSnapshot(),
    };
  }

  reconnect(membershipId: string): FakeParticipant {
    const participant = this.participants.get(membershipId);
    if (!participant) {
      throw new Error('PARTICIPANT_NOT_FOUND');
    }
    participant.generation += 1;
    this.revision += 1;
    return participant;
  }

  publish(membershipId: string, kind: FakePublication['kind'], simulcast = false): FakePublication {
    const participant = this.participants.get(membershipId);
    if (!participant) {
      throw new Error('UNAUTHORIZED_PARTICIPANT');
    }

    const publicationId = `pub_${++this.publicationCounter}`;
    const pub: FakePublication = {
      publicationId,
      membershipId,
      kind,
      simulcast,
    };

    this.publications.set(publicationId, pub);
    this.revision += 1;
    return pub;
  }

  withdraw(membershipId: string, publicationId: string): void {
    const pub = this.publications.get(publicationId);
    if (!pub || pub.membershipId !== membershipId) {
      return;
    }
    this.publications.delete(publicationId);
    this.revision += 1;
  }

  leave(membershipId: string): void {
    if (!this.participants.has(membershipId)) return;

    // Remove all publications by this participant
    for (const [pubId, pub] of this.publications.entries()) {
      if (pub.membershipId === membershipId) {
        this.publications.delete(pubId);
      }
    }

    this.participants.delete(membershipId);
    this.revision += 1;
  }

  getSnapshot(): FakeRoomSnapshot {
    return {
      roomId: this.roomId,
      revision: this.revision,
      participants: Array.from(this.participants.values()),
      publications: Array.from(this.publications.values()),
    };
  }
}
