import { prisma } from '@minimeet/shared';
import { ResponseHelpers, AppError } from '@minimeet/shared';
import { Response } from 'express';

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

  const existingParticipant = room.participants.find((p: any) => p.userId === userId);

  if (existingParticipant) {
    existingParticipant.lastActive = now;
    await prisma.room.update({
      where: { id: room.id },
      data: { participants: room.participants }
    });
    return ResponseHelpers.ok(res, {
      participant: existingParticipant,
      collaborationMode: room.collaborationMode,
      activeTool: room.activeTool,
      settings: room.settings,
    });
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

  return ResponseHelpers.ok(res, {
    participant: newParticipant,
    collaborationMode: room.collaborationMode,
    activeTool: room.activeTool,
    settings: room.settings,
  });
};
