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

  // Format the meeting time with timezone
  const meetingDate = new Date(meeting.scheduledTime);
  const timeString = meetingDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const dateString = meetingDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const emailContent = {
    from: fromEmail,
    to,
    subject: `You're Invited: ${meeting.title}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Meeting Invitation</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .email-container {
            max-width: 480px;
            width: 100%;
            margin: 20px;
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(160, 120, 255, 0.2);
            overflow: hidden;
          }
          .header-padding {
            background: linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%);
            padding: 24px 20px 16px 20px;
            text-align: center;
          }
          .content-padding {
            padding: 24px 20px 20px 20px;
          }
          .title-size {
            color: #fff;
            font-size: 1.4rem;
            margin: 0;
            font-weight: 700;
            letter-spacing: -0.5px;
          }
          .subtitle-size {
            color: #ede9fe;
            font-size: 0.9rem;
            margin: 4px 0 0 0;
          }
          .meeting-title {
            color: #7c3aed;
            margin: 0 0 8px 0;
            font-size: 1.1rem;
            font-weight: 600;
            word-wrap: break-word;
          }
          .meeting-description {
            color: #555;
            margin: 0 0 16px 0;
            font-size: 0.9rem;
            line-height: 1.4;
            word-wrap: break-word;
          }
          .details-padding {
            background: #f8f7ff;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 20px;
            border-left: 4px solid #7c3aed;
          }
          .detail-item {
            margin-bottom: 8px;
            display: flex;
            align-items: center;
          }
          .detail-label {
            font-weight: 600;
            color: #374151;
            min-width: 80px;
            font-size: 0.9rem;
          }
          .detail-value {
            color: #7c3aed;
            margin-left: 12px;
            font-size: 0.9rem;
            flex: 1;
          }
          .join-button {
            display: inline-block;
            background: linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%);
            color: #fff;
            font-weight: 600;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-size: 0.95rem;
            box-shadow: 0 4px 12px rgba(124,58,237,0.3);
            transition: all 0.2s;
            min-width: 120px;
            text-align: center;
          }
          .join-button:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(124,58,237,0.4);
          }
          .footer-note {
            color: #888;
            font-size: 0.8rem;
            margin-top: 16px;
            line-height: 1.4;
            text-align: center;
            word-wrap: break-word;
          }
          .bottom-footer {
            background: #ede9fe;
            color: #7c3aed;
            text-align: center;
            padding: 12px 0;
            font-size: 0.8rem;
            border-top: 1px solid #e0e7ff;
          }
          @media only screen and (max-width: 480px) {
            .email-container {
              margin: 12px;
              max-width: calc(100% - 24px);
            }
            .header-padding {
              padding: 20px 16px 12px 16px;
            }
            .content-padding {
              padding: 20px 16px 16px 16px;
            }
            .title-size {
              font-size: 1.2rem;
            }
            .subtitle-size {
              font-size: 0.85rem;
            }
            .details-padding {
              padding: 12px;
              margin-bottom: 16px;
            }
            .join-button {
              padding: 10px 20px;
              font-size: 0.9rem;
            }
            .detail-item {
              margin-bottom: 6px;
            }
            .detail-label {
              font-size: 0.85rem;
            }
            .detail-value {
              font-size: 0.85rem;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <!-- Header -->
          <div class="header-padding">
            <img src='${
              process.env.CLIENT_URL
            }/brand.png' alt='Brand Logo' style='height: 32px; margin-bottom: 8px; max-width: 100%;' />
            <h2 class="title-size">You're Invited!</h2>
            <p class="subtitle-size">Join a meeting on MeetLite</p>
          </div>
          
          <!-- Content -->
          <div class="content-padding">
            <h3 class="meeting-title">${meeting.title}</h3>
            <p class="meeting-description">${
              meeting.description || 'No description provided.'
            }</p>
            
            <!-- Meeting Details -->
            <div class="details-padding">
              <div class="detail-item">
                <span class="detail-label">📅 Date:</span>
                <span class="detail-value">${dateString}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">⏰ Time:</span>
                <span class="detail-value">${timeString} (UTC)</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">⏱️ Duration:</span>
                <span class="detail-value">${meeting.duration} minutes</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">👤 Host:</span>
                <span class="detail-value">${
                  hostEmail || meeting.createdBy
                }</span>
              </div>
            </div>
            
            <!-- Join Button -->
            <div style="text-align: center;">
              <a href="${joinUrl}" class="join-button">Join Meeting</a>
            </div>
            
            <!-- Footer Note -->
            <p class="footer-note">
              This link will be active when the host starts the meeting.<br>
              If you have questions, reply to this email.
            </p>
          </div>
          
          <!-- Bottom Footer -->
          <div class="bottom-footer">
            <span>Made with <span style="color: #a78bfa;">♥</span> by MeetLite</span>
          </div>
        </div>
      </body>
      </html>
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
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });

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
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
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

// Complete meeting (only creator can complete)
router.post('/:meetingId/complete', async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
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
