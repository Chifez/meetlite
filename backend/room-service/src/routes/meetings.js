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
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Meeting Invitation</title>
        <style>
          @media only screen and (max-width: 480px) {
            .email-container {
              margin: 8px !important;
              max-width: calc(100% - 16px) !important;
            }
            .header-padding {
              padding: 16px 12px 8px 12px !important;
            }
            .content-padding {
              padding: 16px 12px 12px 12px !important;
            }
            .title-size {
              font-size: 1.2rem !important;
            }
            .subtitle-size {
              font-size: 0.85rem !important;
            }
            .details-padding {
              padding: 10px !important;
              margin-bottom: 12px !important;
            }
            .button-padding {
              padding: 8px 16px !important;
              font-size: 0.85rem !important;
            }
            .footer-note {
              margin-top: 12px !important;
              font-size: 0.8rem !important;
            }
            .bottom-footer {
              padding: 8px 0 !important;
              font-size: 0.8rem !important;
            }
            .detail-item {
              margin-bottom: 6px !important;
            }
            .detail-label {
              font-size: 0.85rem !important;
            }
            .detail-value {
              font-size: 0.85rem !important;
              margin-left: 16px !important;
            }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%); height:max-content;">
        <div class="email-container" style="max-width: 480px; margin: 12px auto; background: #fff; border-radius: 10px; box-shadow: 0 4px 24px rgba(160, 120, 255, 0.15); overflow: hidden;">
          <!-- Header -->
          <div class="header-padding" style="background: linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%); padding: 16px 12px 8px 12px; text-align: center;">
            <img src='${
              process.env.CLIENT_URL
            }/brand.png' alt='Brand Logo' style='height: 28px; margin-bottom: 4px; max-width: 100%;' />
            <h2 class="title-size" style="color: #fff; font-size: 1.3rem; margin: 0; font-weight: 700; letter-spacing: -0.5px;">You're Invited!</h2>
            <p class="subtitle-size" style="color: #ede9fe; font-size: 0.85rem; margin: 2px 0 0 0;">Join a meeting on MeetLite</p>
          </div>
          
          <!-- Content -->
          <div class="content-padding" style="padding: 16px 12px 12px 12px;">
            <h3 style="color: #7c3aed; margin: 0 0 4px 0; font-size: 1rem; font-weight: 600; word-wrap: break-word;">${
              meeting.title
            }</h3>
            <p style="color: #555; margin: 0 0 10px 0; font-size: 0.85rem; line-height: 1.2; word-wrap: break-word;">${
              meeting.description || 'No description provided.'
            }</p>
            
            <!-- Meeting Details -->
            <div class="details-padding" style="background: #f8f7ff; border-radius: 6px; padding: 10px; margin-bottom: 12px;">
              <ul style="list-style: none; padding: 0; margin: 0 0 18px 0;">
                <li><strong>Date:</strong> <span style="color: #7c3aed;">${new Date(
                  meeting.scheduledTime
                )
                  .toLocaleDateString('en-US', {
                    month: 'short',
                    day: '2-digit',
                    year: 'numeric',
                  })
                  .replace(',', ',')}</span></li>
                <li><strong>⏰ Duration:</strong> ${meeting.duration} min</li>
                <li><strong>👤 Host:</strong> ${
                  hostEmail || meeting.createdBy
                }</li>
              </ul>
            </div>
            
            <!-- Join Button -->
            <div style="text-align: center;">
              <a href="${joinUrl}" class="button-padding" style="display: inline-block; background: linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%); color: #fff; font-weight: 600; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 0.85rem; box-shadow: 0 2px 8px rgba(124,58,237,0.2); transition: all 0.2s; min-width: 90px; max-width: 100%;">Join Meeting</a>
            </div>
            
            <!-- Footer Note -->
            <p class="footer-note" style="color: #888; font-size: 0.75rem; margin-top: 12px; line-height: 1.2; text-align: center; word-wrap: break-word;">This link will be active when the host starts the meeting.<br>If you have questions, reply to this email.</p>
          </div>
          
          <!-- Bottom Footer -->
          <div class="bottom-footer" style="background: #ede9fe; color: #7c3aed; text-align: center; padding: 8px 0; font-size: 0.75rem; border-top: 1px solid #e0e7ff;">
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
