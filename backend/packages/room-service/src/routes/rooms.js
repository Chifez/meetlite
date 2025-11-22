import express from 'express';
import { nanoid } from 'nanoid';
import { models } from '../index.js';
import {
  updateCollaborationMode,
  updateParticipantRole,
  updateRoomSettings,
  joinRoom,
} from '../controllers/roomCollaboration.js';

const router = express.Router();

// Create room
router.post('/', async (req, res) => {
  try {
    const roomId = nanoid(10);
    const { settings = {} } = req.body;
    const userId = req.user.userId;
    const orgId = req.user.organizationId || null;
    const now = new Date();

    // ✅ Direct insert with lean document (bypasses Mongoose validation overhead)
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

    // ✅ Use create() instead of new + save() (single operation, optimized)
    await models.Room.create(roomData);

    // ✅ Return immediately without fetching (we already have roomId)
    res.status(201).json({ roomId });
  } catch (error) {
    // Handle duplicate roomId (nanoid collision - extremely rare but possible)
    if (error.code === 11000 && error.keyPattern?.roomId) {
      // Retry once with new ID
      try {
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
        return res.status(201).json({ roomId });
      } catch (retryError) {
        console.error('Create room retry error:', retryError);
        return res.status(500).json({ message: 'Server error' });
      }
    }

    console.error('Create room error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get room (with access control) - OPTIMIZED with aggregation
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;
    const userOrgId = req.user.organizationId || null;

    // ✅ SINGLE QUERY: Fetch room AND meeting together using aggregation
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
                // ✅ Only fetch needed fields
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
      return res.status(404).json({ message: 'Room not found' });
    }

    const room = result[0];
    const meeting = room.meeting || null;

    // Access control logic (same as before, but now meeting is already loaded)
    const roomOrgId = room.organizationId || null;

    if (userOrgId?.toString() !== roomOrgId?.toString()) {
      return res.status(403).json({
        message: 'Access denied. Room belongs to a different workspace.',
      });
    }

    if (room.createdBy === userId) {
      // ✅ Remove meeting from response if not needed
      const { meeting: _, ...roomResponse } = room;
      return res.json(roomResponse);
    }

    if (meeting) {
      if (meeting.privacy === 'public') {
        const { meeting: _, ...roomResponse } = room;
        return res.json(roomResponse);
      }
      if (meeting.createdBy === userId) {
        const { meeting: _, ...roomResponse } = room;
        return res.json(roomResponse);
      }
      const userInvite = meeting.invites?.find(
        (invite) => invite.email === req.user.email
      );
      if (userInvite && userInvite.status !== 'declined') {
        const { meeting: _, ...roomResponse } = room;
        return res.json(roomResponse);
      }
    } else {
      const { meeting: _, ...roomResponse } = room;
      return res.json(roomResponse);
    }

    return res.status(403).json({ message: 'Access denied to this room' });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Collaboration routes
router.post('/:roomId/join', joinRoom);
router.patch('/:roomId/collaboration', updateCollaborationMode);
router.patch('/:roomId/participants/:userId/role', updateParticipantRole);
router.patch('/:roomId/settings', updateRoomSettings);

export default router;
