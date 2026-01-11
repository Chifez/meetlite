import { nanoid } from 'nanoid';
import { models } from '../index.js';
import { ResponseHelpers, AppError } from '@minimeet/shared';
import {
  updateCollaborationMode,
  updateParticipantRole,
  updateRoomSettings,
  joinRoom,
} from './room-collaboration.controller.js';

export class RoomController {
  /**
   * POST /rooms - Create a new room
   */
  async createRoom(req, res) {
    try {
      const roomId = nanoid(10);
      const { settings = {} } = req.body;
      const userId = req.user.userId;
      const orgId = req.user.organizationId || null;
      const now = new Date();

      // Direct insert with lean document (bypasses Mongoose validation overhead)
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

      // Use create() instead of new + save() (single operation, optimized)
      await models.Room.create(roomData);

      return ResponseHelpers.created(
        res,
        { roomId },
        'Room created successfully'
      );
    } catch (error) {
      // Handle duplicate roomId (nanoid collision - extremely rare but possible)
      if (error.code === 11000 && error.keyPattern?.roomId) {
        // Retry once with new ID
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
        await models.Room.create(roomData);
        return ResponseHelpers.created(
          res,
          { roomId },
          'Room created successfully'
        );
      }

      // Re-throw error to be handled by error middleware
      throw error;
    }
  }

  /**
   * GET /rooms/:roomId - Get room details (with access control)
   */
  async getRoom(req, res) {
    const { roomId } = req.params;
    const userId = req.user.userId;
    const userOrgId = req.user.organizationId || null;

    // SINGLE QUERY: Fetch room AND meeting together using aggregation
    const result = await models.Room.aggregate([
      { $match: { roomId } },
      {
        $lookup: {
          from: 'meetings', // Collection name (Mongoose pluralizes 'Meeting')
          localField: 'roomId',
          foreignField: 'roomId',
          as: 'meeting',
          pipeline: [
            { $limit: 1 }, // Only need first match
            {
              $project: {
                // Only fetch needed fields
                roomId: 1,
                createdBy: 1,
                privacy: 1,
                invites: 1,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          meeting: { $arrayElemAt: ['$meeting', 0] }, // Convert array to object
        },
      },
      { $limit: 1 },
    ]);

    if (!result || result.length === 0) {
      throw AppError.notFound('Room');
    }

    const room = result[0];
    const meeting = room.meeting || null;

    // Access control logic
    const roomOrgId = room.organizationId || null;

    if (userOrgId?.toString() !== roomOrgId?.toString()) {
      throw AppError.forbidden(
        'Access denied. Room belongs to a different workspace.'
      );
    }

    if (room.createdBy === userId) {
      // Remove meeting from response if not needed
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
        (invite) => invite.email === req.user.email
      );
      if (userInvite && userInvite.status !== 'declined') {
        const { meeting: _, ...roomResponse } = room;
        return ResponseHelpers.ok(res, roomResponse);
      }
    } else {
      const { meeting: _, ...roomResponse } = room;
      return ResponseHelpers.ok(res, roomResponse);
    }

    throw AppError.forbidden('Access denied to this room');
  }

  /**
   * POST /rooms/:roomId/join - Join a room
   */
  async joinRoom(req, res) {
    return joinRoom(req, res);
  }

  /**
   * PATCH /rooms/:roomId/collaboration - Update collaboration mode
   */
  async updateCollaborationMode(req, res) {
    return updateCollaborationMode(req, res);
  }

  /**
   * PATCH /rooms/:roomId/participants/:userId/role - Update participant role
   */
  async updateParticipantRole(req, res) {
    return updateParticipantRole(req, res);
  }

  /**
   * PATCH /rooms/:roomId/settings - Update room settings
   */
  async updateRoomSettings(req, res) {
    return updateRoomSettings(req, res);
  }
}

export default RoomController;
