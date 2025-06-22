import express from 'express';
import { nanoid } from 'nanoid';
import Meeting from '../models/Meeting.js';
import Room from '../models/Room.js';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Utility to send invite email
async function sendInviteEmail({ to, meeting, inviteToken, hostEmail }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const joinUrl = `${process.env.CLIENT_URL}/meeting/${meeting.meetingId}/join?token=${inviteToken}`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `Invitation: ${meeting.title}`,
    html: `
      <h2>You are invited to a meeting!</h2>
      <p><strong>Title:</strong> ${meeting.title}</p>
      <p><strong>Description:</strong> ${meeting.description || ''}</p>
      <p><strong>When:</strong> ${new Date(
        meeting.scheduledTime
      ).toLocaleString()}</p>
      <p><strong>Duration:</strong> ${meeting.duration} min</p>
      <p><strong>Host:</strong> ${hostEmail || meeting.createdBy}</p>
      <p><strong>Join Link:</strong> <a href="${joinUrl}">${joinUrl}</a></p>
      <p>This link will be active when the host starts the meeting.</p>
    `,
  });
}

// Create meeting
router.post('/', async (req, res) => {
  try {
    const {
      title,
      description,
      scheduledTime,
      duration,
      participants,
      privacy,
      inviteEmails,
      hostEmail,
    } = req.body;
    const meetingId = nanoid(12);

    // Prepare invites
    let invites = [];
    if (Array.isArray(inviteEmails)) {
      invites = inviteEmails.map((email) => ({
        email,
        status: 'pending',
        inviteToken: uuidv4(),
      }));
    }

    const meeting = new Meeting({
      meetingId,
      title,
      description,
      scheduledTime,
      duration,
      createdBy: req.user.userId,
      participants: participants || [],
      privacy: privacy || 'public',
      invites,
    });

    await meeting.save();

    // Send invites
    for (const invite of invites) {
      await sendInviteEmail({
        to: invite.email,
        meeting,
        inviteToken: invite.inviteToken,
        hostEmail,
      });
    }

    res.status(201).json({ meetingId });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// List meetings (optionally filter by user)
router.get('/', async (req, res) => {
  try {
    const meetings = await Meeting.find({
      $or: [{ createdBy: req.user.userId }, { participants: req.user.userId }],
    }).sort({ scheduledTime: 1 });
    res.json(meetings);
  } catch (error) {
    console.error('List meetings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get meeting details
router.get('/:meetingId', async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    res.json(meeting);
  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update meeting (only creator can update)
router.put('/:meetingId', async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    if (meeting.createdBy !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const updates = req.body;
    Object.assign(meeting, updates);
    await meeting.save();
    res.json(meeting);
  } catch (error) {
    console.error('Update meeting error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete meeting (only creator can delete)
router.delete('/:meetingId', async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    if (meeting.createdBy !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await meeting.deleteOne();
    res.json({ message: 'Meeting deleted' });
  } catch (error) {
    console.error('Delete meeting error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Start meeting (create room and associate with meeting)
router.post('/:meetingId/start', async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    if (meeting.createdBy !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (meeting.roomId) {
      return res
        .status(400)
        .json({ message: 'Meeting already started', roomId: meeting.roomId });
    }
    // Create a new room
    const { nanoid } = await import('nanoid');
    const roomId = nanoid(10);
    const room = new Room({
      roomId,
      createdBy: req.user.userId,
    });
    await room.save();
    meeting.roomId = roomId;
    meeting.status = 'ongoing';
    await meeting.save();
    res.json({ roomId });
  } catch (error) {
    console.error('Start meeting error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
