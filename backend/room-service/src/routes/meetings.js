import express from 'express';
import { nanoid } from 'nanoid';
import Meeting from '../models/Meeting.js';
import Room from '../models/Room.js';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Utility to send invite email
async function sendInviteEmail({ to, meeting, inviteToken, hostEmail }) {
  // Check if SMTP is properly configured
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    throw new Error('SMTP configuration incomplete');
  }

  // Use hostEmail from request body as the from address
  const fromEmail = hostEmail || process.env.SMTP_USER;
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

  const joinUrl = `${process.env.CLIENT_URL}/meeting/${meeting.meetingId}/join?token=${inviteToken}`;

  const emailContent = {
    from: fromEmail,
    to,
    subject: `You're Invited: ${meeting.title}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%); padding: 0; min-height: 100vh;">
        <div style="max-width: 480px; margin: 40px auto; background: #fff; border-radius: 18px; box-shadow: 0 4px 24px rgba(160, 120, 255, 0.10); overflow: hidden;">
          <div style="background: linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%); padding: 32px 0 16px 0; text-align: center;">
            <img src='${
              process.env.CLIENT_URL
            }/brand.png' alt='Brand Logo' style='height: 48px; margin-bottom: 12px;' />
            <h2 style="color: #fff; font-size: 2rem; margin: 0; font-weight: 800; letter-spacing: -1px;">You're Invited!</h2>
            <p style="color: #ede9fe; font-size: 1.1rem; margin: 8px 0 0 0;">Join a meeting on MeetLite</p>
          </div>
          <div style="padding: 32px 28px 24px 28px;">
            <h3 style="color: #7c3aed; margin-bottom: 8px; font-size: 1.3rem;">${
              meeting.title
            }</h3>
            <p style="color: #444; margin: 0 0 12px 0; font-size: 1.05rem;">${
              meeting.description || 'No description provided.'
            }</p>
            <ul style="list-style: none; padding: 0; margin: 0 0 18px 0;">
              <li><strong>🗓️ When:</strong> <span style="color: #7c3aed;">${new Date(
                meeting.scheduledTime
              ).toLocaleString()}</span></li>
              <li><strong>⏰ Duration:</strong> ${meeting.duration} min</li>
              <li><strong>👤 Host:</strong> ${
                hostEmail || meeting.createdBy
              }</li>
            </ul>
            <a href="${joinUrl}" style="display: inline-block; background: linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%); color: #fff; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 1.1rem; margin: 18px 0 0 0; box-shadow: 0 2px 8px rgba(124,58,237,0.10); transition: background 0.2s;">Join Meeting</a>
            <p style="color: #888; font-size: 0.98rem; margin-top: 24px;">This link will be active when the host starts the meeting.<br>If you have questions, reply to this email.</p>
          </div>
          <div style="background: #ede9fe; color: #7c3aed; text-align: center; padding: 14px 0; font-size: 0.98rem; border-top: 1px solid #e0e7ff;">
            <span>Made with <span style="color: #a78bfa;">♥</span> by MeetLite</span>
          </div>
        </div>
      </div>
    `,
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
