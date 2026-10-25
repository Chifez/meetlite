import { prisma } from '@minimeet/shared';
import { ResponseHelpers, AppError } from '@minimeet/shared';
import { Response } from 'express';
import { ParticipantRoomRole } from '@minimeet/shared';
import {
  issueRoomCapability,
  normalizeRoomTier,
} from '../services/room-capability.service.js';

async function resolveAuthoritativeRoomTier(room: any) {
  if (room.organizationId) {
    const organization = await prisma.organization.findUnique({
      where: { id: room.organizationId },
      select: { planType: true, planStatus: true },
    });
    return organization?.planStatus === 'active'
      ? normalizeRoomTier(organization.planType)
      : 'free';
  }

  const owner = await prisma.user.findUnique({
    where: { id: room.createdBy },
    select: { planType: true, planStatus: true },
  });
  return owner?.planStatus === 'active' ? normalizeRoomTier(owner.planType) : 'free';
}

async function assertRoomJoinAccess(req: any, room: any): Promise<void> {
  const userId = req.user.userId;
  const userOrgId = req.user.organizationId || null;
  const roomOrgId = room.organizationId || null;

  if (room.createdBy === userId) return;

  const meeting = await prisma.meeting.findFirst({
    where: { roomId: room.roomId },
    select: { createdBy: true, privacy: true, invites: true },
  });

  if (meeting) {
    if (meeting.createdBy === userId || meeting.privacy === 'public') return;
    const invite = meeting.invites?.find(
      (candidate: any) => candidate.email === req.user.email && candidate.status !== 'declined'
    );
    if (invite) return;
  }

  if (!meeting) {
    if (roomOrgId && userOrgId?.toString() !== roomOrgId?.toString()) {
      throw AppError.forbidden('Access denied. Room belongs to a different workspace.');
    }
    return;
  }

  if (userOrgId?.toString() !== roomOrgId?.toString()) {
    throw AppError.forbidden('Access denied. Room belongs to a different workspace.');
  }

  throw AppError.forbidden('Access denied to this room');
}

async function joinResponse(req: any, roomId: string, room: any, participant: any) {
  const response: Record<string, unknown> = {
    participant,
    collaborationMode: room.collaborationMode,
    activeTool: room.activeTool,
    settings: room.settings,
  };

  if (req.query.includeCapability === 'true') {
    if (!req.principal) {
      throw AppError.unauthorized('Verified principal is required to issue a room capability');
    }
    response.capabilityToken = issueRoomCapability(
      req.principal,
      roomId,
      participant.role as ParticipantRoomRole,
      await resolveAuthoritativeRoomTier(room)
    );
  }

  return response;
}

export const updateCollaborationMode = async (req: any, res: Response) => {
  const { roomId } = req.params;
  const { mode } = req.body;

  const room = await prisma.room.findUnique({ where: { roomId } }) as any;

  if (!room) {
    throw AppError.notFound('Room');
  }

  const participant = room.participants.find(
    (p: any) => p.userId === req.user.userId
  );
  if (!participant) {
    throw AppError.forbidden('User is not a participant in this room');
  }

  if (participant.role === 'viewer') {
    throw AppError.forbidden('Viewers cannot change collaboration mode');
  }

  room.collaborationMode = mode;
  room.activeTool = mode;
  await prisma.room.update({
    where: { id: room.id },
    data: {
      collaborationMode: mode,
      activeTool: mode
    }
  });

  return ResponseHelpers.ok(res, {
    collaborationMode: room.collaborationMode,
    activeTool: room.activeTool,
  });
};

export const updateParticipantRole = async (req: any, res: Response) => {
  const { roomId, userId } = req.params;
  const { role } = req.body;

  const room = await prisma.room.findUnique({ where: { roomId } }) as any;

  if (!room) {
    throw AppError.notFound('Room');
  }

  const requester = room.participants.find((p: any) => p.userId === req.user.userId);
  if (!requester || requester.role !== 'host') {
    throw AppError.forbidden('Only host can update participant roles');
  }

  const participant = room.participants.find((p: any) => p.userId === userId);
  if (!participant) {
    throw AppError.notFound('Participant');
  }

  participant.role = role;
  await prisma.room.update({
    where: { id: room.id },
    data: {
      participants: room.participants
    }
  });

  return ResponseHelpers.ok(res, { userId, role });
};

export const updateRoomSettings = async (req: any, res: Response) => {
  const { roomId } = req.params;
  const { settings } = req.body;

  const room = await prisma.room.findUnique({ where: { roomId } }) as any;

  if (!room) {
    throw AppError.notFound('Room');
  }

  const requester = room.participants.find((p: any) => p.userId === req.user.userId);
  if (!requester || requester.role !== 'host') {
    throw AppError.forbidden('Only host can update room settings');
  }

  room.settings = { ...(room.settings as any), ...settings };
  await prisma.room.update({
    where: { id: room.id },
    data: {
      settings: room.settings
    }
  });

  return ResponseHelpers.ok(res, { settings: room.settings });
};

export const joinRoom = async (req: any, res: Response) => {
  const { roomId } = req.params;
  const userId = req.user.userId;
  const now = new Date();

  const room = await prisma.room.findUnique({ where: { roomId } }) as any;

  if (!room) {
    throw AppError.notFound('Room');
  }

  await assertRoomJoinAccess(req, room);

  const existingParticipant = room.participants.find((p: any) => p.userId === userId);

  if (existingParticipant) {
    existingParticipant.lastActive = now;
    await prisma.room.update({
      where: { id: room.id },
      data: { participants: room.participants }
    });
    return ResponseHelpers.ok(res, await joinResponse(req, roomId, room, existingParticipant));
  }

  if (room.participants.length >= (room.settings as any).maxParticipants) {
    throw AppError.forbidden('Room is at maximum capacity');
  }

  const role = userId === room.createdBy ? 'host' : 'viewer';
  const newParticipant = {
    userId,
    role,
    joinedAt: now,
    lastActive: now,
  };

  room.participants.push(newParticipant);

  await prisma.room.update({
    where: { id: room.id },
    data: { participants: room.participants }
  });

  // Log MEETING_JOINED activity for non-host participants
  if (role !== 'host') {
    try {
      await (prisma as any).activity.create({
        data: {
          action: 'MEETING_JOINED',
          userId,
          organizationId: (room as any).organizationId || null,
          metadata: {
            roomId,
            createdBy: room.createdBy,
          }
        }
      });
    } catch (err) {
      console.error('[Activity] Failed to log MEETING_JOINED', err);
    }
  }

  return ResponseHelpers.ok(res, await joinResponse(req, roomId, room, newParticipant));

};
