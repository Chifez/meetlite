import express from 'express';
import { nanoid } from 'nanoid';
import Room from '../models/Room.js';
import Meeting from '../models/Meeting.js';
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

    const room = new Room({
      roomId,
      createdBy: req.user.userId,
      settings: {
        allowCollaboration: settings.allowCollaboration ?? true,
        maxParticipants: settings.maxParticipants ?? 50,
      },
      participants: [
        {
          userId: req.user.userId,
          role: 'host',
          joinedAt: new Date(),
          lastActive: new Date(),
        },
      ],
    });

    await room.save();
    res.status(201).json({ roomId });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get room (with access control)
router.get('/:roomId', async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // If the user is the room creator, allow access
    if (room.createdBy === req.user.userId) {
      return res.json(room);
    }

    // If the room is not associated with a Meeting, allow any authenticated user to join (instant meeting)
    const meeting = await Meeting.findOne({ roomId: req.params.roomId });
    if (!meeting) {
      return res.json(room);
    }

    // Check if user has access through a meeting
    if (meeting) {
      // If meeting is public, allow access
      if (meeting.privacy === 'public') {
        return res.json(room);
      }

      // If user is meeting creator, allow access
      if (meeting.createdBy === req.user.userId) {
        return res.json(room);
      }

      // Check if user has a valid invite
      const userInvite = meeting.invites.find(
        (invite) => invite.email === req.user.email
      );
      if (userInvite && userInvite.status !== 'declined') {
        return res.json(room);
      }
    }

    // User doesn't have access
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
