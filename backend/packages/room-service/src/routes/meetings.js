import express from 'express';
import { nanoid } from 'nanoid';
import { models } from '../index.js';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { getMeetingInviteEmailTemplate } from '../templates/meetingInviteEmail.js';

const router = express.Router();

// Utility to send invite email
async function sendInviteEmail({ to, meeting, inviteToken, hostEmail }) {
  // Check if SMTP is properly configured
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS ||
    !process.env.SMTP_FROM
  ) {
    throw new Error('SMTP configuration incomplete');
  }

  const fromEmail = process.env.SMTP_FROM;
  if (!fromEmail) {
    throw new Error('Host email configuration missing');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // (debug verify removed)

  const joinUrl = `${process.env.CLIENT_URL}/meeting/${meeting.meetingId}/join?token=${inviteToken}`;
  const template = getMeetingInviteEmailTemplate({
    meeting,
    joinUrl,
    hostEmail,
  });
  const fromName = process.env.SMTP_FROM_NAME || 'MeetLite';
  const emailContent = {
    from: `${fromName} <${fromEmail}>`,
    to,
    subject: template.subject,
    html: template.html,
  };

  try {
    await transporter.sendMail(emailContent);
  } catch (error) {
    throw error;
  }
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
      invites = inviteEmails
        .filter((e) => typeof e === 'string' && e.trim().length > 3)
        .map((email) => ({
          email,
          status: 'pending',
          inviteToken: uuidv4(),
        }));
    }

    // test fallback removed

    const meeting = new models.Meeting({
      meetingId,
      title,
      description,
      scheduledTime,
      duration,
      createdBy: req.user.userId,
      organizationId: req.user.organizationId || null, // Use user's active org or personal
      participants: participants || [],
      privacy: privacy || 'public',
      invites,
    });

    await meeting.save();

    // Send invites
    if (invites.length > 0) {
      for (const invite of invites) {
        try {
          await sendInviteEmail({
            to: invite.email,
            meeting,
            inviteToken: invite.inviteToken,
            hostEmail,
          });
        } catch (error) {
          // Continue with other invites even if one fails
        }
      }
    }

    res.status(201).json({ meetingId });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// List meetings (filtered by user and organization)
router.get('/', async (req, res) => {
  try {
    // Build query based on user's active organization
    const orgFilter = req.user.organizationId
      ? { organizationId: req.user.organizationId }
      : { organizationId: null }; // Personal workspace

    const meetings = await models.Meeting.find({
      ...orgFilter, // Filter by organization first
      $or: [
        { createdBy: req.user.userId },
        { participants: req.user.userId },
        { 'invites.email': req.user.email },
      ],
    }).sort({ scheduledTime: 1 });
    res.json(meetings);
  } catch (error) {
    console.error('List meetings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Validate invite token for private meeting access
router.post('/:meetingId/validate-token', async (req, res) => {
  try {
    const { token } = req.body;
    const meeting = await models.Meeting.findOne({
      meetingId: req.params.meetingId,
    });

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // If meeting is public, no token needed
    if (meeting.privacy === 'public') {
      return res.json({ valid: true, meeting });
    }

    // For private meetings, validate token
    if (!token) {
      return res
        .status(401)
        .json({ message: 'Invite token required for private meeting' });
    }

    // Check if user is the creator
    if (meeting.createdBy === req.user.userId) {
      return res.json({ valid: true, meeting });
    }

    // Check if token matches any invite
    const validInvite = meeting.invites.find(
      (invite) => invite.inviteToken === token
    );
    if (!validInvite) {
      return res
        .status(403)
        .json({ message: 'Invalid or expired invite token' });
    }

    // Update invite status to accepted if it was pending
    if (validInvite.status === 'pending') {
      validInvite.status = 'accepted';
      await meeting.save();
    }

    res.json({ valid: true, meeting });
  } catch (error) {
    console.error('Validate token error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get meeting details (updated to check access)
router.get('/:meetingId', async (req, res) => {
  try {
    const meeting = await models.Meeting.findOne({
      meetingId: req.params.meetingId,
    });
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // If meeting is public, allow access
    if (meeting.privacy === 'public') {
      return res.json(meeting);
    }

    // For private meetings, check if user is creator or has valid invite
    if (meeting.createdBy === req.user.userId) {
      return res.json(meeting);
    }

    // Check if user has a valid invite
    const userInvite = meeting.invites.find(
      (invite) => invite.email === req.user.email
    );
    if (userInvite && userInvite.status !== 'declined') {
      return res.json(meeting);
    }

    // User doesn't have access
    return res.status(403).json({
      message:
        'Access denied. You need an invite to join this private meeting.',
    });
  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update meeting (only creator can update)
router.put('/:meetingId', async (req, res) => {
  try {
    const meeting = await models.Meeting.findOne({
      meetingId: req.params.meetingId,
    });
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
    const meeting = await models.Meeting.findOne({
      meetingId: req.params.meetingId,
    });
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
    const meeting = await models.Meeting.findOne({
      meetingId: req.params.meetingId,
    });
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
    const room = new models.Room({
      roomId,
      createdBy: req.user.userId,
      organizationId: meeting.organizationId, // Inherit from meeting
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

// Complete meeting (only creator can complete)
router.post('/:meetingId/complete', async (req, res) => {
  try {
    const meeting = await models.Meeting.findOne({
      meetingId: req.params.meetingId,
    });
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    if (meeting.createdBy !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (meeting.status === 'completed') {
      return res.status(400).json({ message: 'Meeting already completed' });
    }
    if (meeting.status === 'cancelled') {
      return res
        .status(400)
        .json({ message: 'Cannot complete a cancelled meeting' });
    }

    meeting.status = 'completed';
    await meeting.save();
    res.json({ message: 'Meeting completed successfully' });
  } catch (error) {
    console.error('Complete meeting error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
