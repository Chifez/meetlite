import { Response } from 'express';
import { createHmac } from 'crypto';
import { nanoid } from 'nanoid';
import { prisma } from '@minimeet/shared';
import { ResponseHelpers, AppError } from '@minimeet/shared';
import {
  updateCollaborationMode,
  updateParticipantRole,
  updateRoomSettings,
  joinRoom,
} from './room-collaboration.controller.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { ACTIVITY_TYPES } from '@minimeet/shared';


export class RoomController {
  /**
   * POST /rooms - Create a new room
   */
  async createRoom(req: AuthenticatedRequest, res: Response) {
    try {
      const roomId = nanoid(10);
      const { settings = {} } = req.body;
      const userId = req.user.userId;
      const orgId = req.user.organizationId || null;
      const now = new Date();

      const roomData = {
        roomId,
        createdBy: userId,
        organizationId: orgId,
        settings: {
          allowCollaboration: settings.allowCollaboration ?? true,
          maxParticipants: settings.maxParticipants ?? 50,
        },
        participants: [
          {
            userId,
            role: 'host',
            joinedAt: now,
            lastActive: now,
          },
        ],
        createdAt: now,
      };

      await prisma.room.create({ data: roomData });

      // Log activity for both org and personal workspace instant meetings
      try {
        await (prisma as any).activity.create({
          data: {
            action: ACTIVITY_TYPES.QUICK_MEETING_STARTED,
            userId: userId,
            organizationId: orgId || null,
            metadata: {
              roomId
            }
          }
        });
      } catch (err) {
        console.error('[Activity] Failed to log QUICK_MEETING_STARTED', err);
      }


      return ResponseHelpers.created(
        res,
        { roomId },
        'Room created successfully'
      );
    } catch (error: any) {
      if (error.code === 11000 && error.keyPattern?.roomId) {
        const roomId = nanoid(10);
        const roomData = {
          roomId,
          createdBy: req.user.userId,
          organizationId: req.user.organizationId || null,
          settings: {
            allowCollaboration: req.body.settings?.allowCollaboration ?? true,
            maxParticipants: req.body.settings?.maxParticipants ?? 50,
          },
          participants: [
            {
              userId: req.user.userId,
              role: 'host',
              joinedAt: new Date(),
              lastActive: new Date(),
            },
          ],
          createdAt: new Date(),
        };
        await prisma.room.create({ data: roomData });
        return ResponseHelpers.created(
          res,
          { roomId },
          'Room created successfully'
        );
      }

      throw error;
    }
  }

  /**
   * GET /rooms/:roomId - Get room details (with access control)
   */
  async getRoom(req: AuthenticatedRequest, res: Response) {
    const { roomId } = req.params;
    const userId = req.user.userId;
    const userOrgId = req.user.organizationId || null;

    const room = await prisma.room.findUnique({ where: { roomId: roomId as string } }) as any;
    if (!room) {
      throw AppError.notFound('Room');
    }

    const meeting = await prisma.meeting.findFirst({
      where: { roomId: roomId as string },
      select: { roomId: true, createdBy: true, privacy: true, invites: true }
    });
    room.meeting = meeting || null;

    const roomOrgId = room.organizationId || null;

    if (userOrgId?.toString() !== roomOrgId?.toString()) {
      throw AppError.forbidden(
        'Access denied. Room belongs to a different workspace.'
      );
    }

    if (room.createdBy === userId) {
      const { meeting: _, ...roomResponse } = room;
      return ResponseHelpers.ok(res, roomResponse);
    }

    if (meeting) {
      if (meeting.privacy === 'public') {
        const { meeting: _, ...roomResponse } = room;
        return ResponseHelpers.ok(res, roomResponse);
      }
      if (meeting.createdBy === userId) {
        const { meeting: _, ...roomResponse } = room;
        return ResponseHelpers.ok(res, roomResponse);
      }
      const userInvite = meeting.invites?.find(
        (invite: any) => invite.email === req.user.email
      );
      if (userInvite && userInvite.status !== 'declined') {
        const { meeting: _, ...roomResponse } = room;
        return ResponseHelpers.ok(res, roomResponse);
      }
    } else {
      // Personal workspace instant room — only the creator may access it
      if (room.createdBy !== userId) {
        throw AppError.forbidden('Access denied to this room');
      }
      const { meeting: _, ...roomResponse } = room;
      return ResponseHelpers.ok(res, roomResponse);
    }

    throw AppError.forbidden('Access denied to this room');
  }

  /**
   * GET /rooms/:roomId/ice-config - Generate dynamic ICE/TURN configurations with credential auth
   */
  async getIceConfig(req: AuthenticatedRequest, res: Response) {
    const username = `${Math.floor(Date.now() / 1000) + 3600}:${req.user.userId}`;
    const iceServers: any[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];

    if (process.env.TURN_SECRET && process.env.TURN_SERVER_URL) {
      const hmac = createHmac('sha1', process.env.TURN_SECRET);
      hmac.update(username);
      const credential = hmac.digest('base64');
      iceServers.push({
        urls: process.env.TURN_SERVER_URL,
        username,
        credential,
      });
    }

    return ResponseHelpers.ok(res, { iceServers });
  }

  /**
   * POST /rooms/:roomId/join - Join a room
   */
  async joinRoom(req: AuthenticatedRequest, res: Response) {
    return joinRoom(req, res);
  }

  /**
   * PATCH /rooms/:roomId/collaboration - Update collaboration mode
   */
  async updateCollaborationMode(req: AuthenticatedRequest, res: Response) {
    return updateCollaborationMode(req, res);
  }

  /**
   * PATCH /rooms/:roomId/participants/:userId/role - Update participant role
   */
  async updateParticipantRole(req: AuthenticatedRequest, res: Response) {
    return updateParticipantRole(req, res);
  }

  /**
   * PATCH /rooms/:roomId/settings - Update room settings
   */
  async updateRoomSettings(req: AuthenticatedRequest, res: Response) {
    return updateRoomSettings(req, res);
  }
}

export default RoomController;
