import Room from '../models/Room.js';

export const updateCollaborationMode = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { mode } = req.body;

    const room = await Room.findOne({ roomId });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const participant = room.participants.find(
      (p) => p.userId === req.user.userId
    );
    if (!participant) {
      return res
        .status(403)
        .json({ message: 'User is not a participant in this room' });
    }

    if (participant.role === 'viewer') {
      return res
        .status(403)
        .json({ message: 'Viewers cannot change collaboration mode' });
    }

    room.collaborationMode = mode;
    room.activeTool = mode;
    await room.save();

    res.json({
      collaborationMode: room.collaborationMode,
      activeTool: room.activeTool,
    });
  } catch (error) {
    console.error('Update collaboration mode error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateParticipantRole = async (req, res) => {
  try {
    const { roomId, userId } = req.params;
    const { role } = req.body;

    const room = await Room.findOne({ roomId });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const requester = room.participants.find(
      (p) => p.userId === req.user.userId
    );
    if (!requester || requester.role !== 'host') {
      return res
        .status(403)
        .json({ message: 'Only host can update participant roles' });
    }

    const participant = room.participants.find((p) => p.userId === userId);
    if (!participant) {
      return res.status(404).json({ message: 'Participant not found' });
    }

    participant.role = role;
    await room.save();

    res.json({ userId, role });
  } catch (error) {
    console.error('Update participant role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateRoomSettings = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { settings } = req.body;

    const room = await Room.findOne({ roomId });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const requester = room.participants.find(
      (p) => p.userId === req.user.userId
    );
    if (!requester || requester.role !== 'host') {
      return res
        .status(403)
        .json({ message: 'Only host can update room settings' });
    }

    room.settings = { ...room.settings, ...settings };
    await room.save();

    res.json({ settings: room.settings });
  } catch (error) {
    console.error('Update room settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const joinRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findOne({ roomId });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const existingParticipant = room.participants.find(
      (p) => p.userId === req.user.userId
    );
    if (existingParticipant) {
      existingParticipant.lastActive = new Date();
      await room.save();
      return res.json({
        participant: existingParticipant,
        collaborationMode: room.collaborationMode,
        activeTool: room.activeTool,
        settings: room.settings,
      });
    }

    if (room.participants.length >= room.settings.maxParticipants) {
      return res.status(403).json({ message: 'Room is at maximum capacity' });
    }

    const newParticipant = {
      userId: req.user.userId,
      role: req.user.userId === room.createdBy ? 'host' : 'viewer',
      joinedAt: new Date(),
      lastActive: new Date(),
    };

    room.participants.push(newParticipant);
    await room.save();

    res.json({
      participant: newParticipant,
      collaborationMode: room.collaborationMode,
      activeTool: room.activeTool,
      settings: room.settings,
    });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
