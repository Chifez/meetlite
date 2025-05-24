import express from 'express';
import { nanoid } from 'nanoid';
import Room from '../models/Room.js';

const router = express.Router();

// Create room
router.post('/', async (req, res) => {
  try {
    const roomId = nanoid(10);
    
    const room = new Room({
      roomId,
      createdBy: req.user.userId
    });

    await room.save();
    res.status(201).json({ roomId });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get room
router.get('/:roomId', async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.json(room);
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;