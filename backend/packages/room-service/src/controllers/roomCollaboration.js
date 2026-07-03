import { models } from '../index.js';

export const updateCollaborationMode = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { mode } = req.body;

    const room = await models.Room.findOne({ roomId });

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

    const room = await models.Room.findOne({ roomId });

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

    const room = await models.Room.findOne({ roomId });

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
    const userId = req.user.userId;
    const now = new Date();

    // ✅ SINGLE ATOMIC OPERATION: Find room AND add/update participant in one query
    const room = await models.Room.findOneAndUpdate(
      {
        roomId,
        // Only match rooms where user is NOT already a participant
        'participants.userId': { $ne: userId },
        // Ensure room is not at capacity
        $expr: {
          $lt: [{ $size: '$participants' }, '$settings.maxParticipants'],
        },
      },
      {
        $push: {
          participants: {
            userId,
            role: 'viewer', // Default, will update if creator below
            joinedAt: now,
            lastActive: now,
          },
        },
      },
      { new: true, lean: true } // ✅ lean() = faster (plain JS object)
    );

    // Case 1: User successfully added as new participant
    if (room) {
      // Update role if user is creator (atomic operation)
      if (userId === room.createdBy) {
        await models.Room.updateOne(
          { roomId, 'participants.userId': userId },
          { $set: { 'participants.$.role': 'host' } }
        );
        // Get updated participant for response
        const updatedRoom = await models.Room.findOne(
          { roomId },
          {
            participants: { $elemMatch: { userId } },
            collaborationMode: 1,
            activeTool: 1,
            settings: 1,
          }
        ).lean();
        const participant = updatedRoom?.participants[0];

        return res.json({
          participant,
          collaborationMode: updatedRoom.collaborationMode,
          activeTool: updatedRoom.activeTool,
          settings: updatedRoom.settings,
        });
      }

      const participant = room.participants.find((p) => p.userId === userId);
      return res.json({
        participant,
        collaborationMode: room.collaborationMode,
        activeTool: room.activeTool,
        settings: room.settings,
      });
    }

    // Case 2: User is already a participant - just update lastActive (atomic)
    const existingRoom = await models.Room.findOneAndUpdate(
      {
        roomId,
        'participants.userId': userId,
      },
      {
        $set: { 'participants.$.lastActive': now },
      },
      {
        new: true,
        projection: {
          participants: { $elemMatch: { userId } },
          collaborationMode: 1,
          activeTool: 1,
          settings: 1,
        },
        lean: true, // ✅ lean() = faster
      }
    );

    if (!existingRoom) {
      // Room not found OR at capacity
      const capacityCheck = await models.Room.findOne(
        { roomId },
        { 'settings.maxParticipants': 1, participants: 1 }
      ).lean();

      if (!capacityCheck) {
        return res.status(404).json({ message: 'Room not found' });
      }

      if (
        capacityCheck.participants.length >=
        capacityCheck.settings.maxParticipants
      ) {
        return res.status(403).json({ message: 'Room is at maximum capacity' });
      }

      return res.status(404).json({ message: 'Room not found' });
    }

    const participant = existingRoom.participants[0];
    res.json({
      participant,
      collaborationMode: existingRoom.collaborationMode,
      activeTool: existingRoom.activeTool,
      settings: existingRoom.settings,
    });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
