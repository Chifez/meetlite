import { nanoid } from 'nanoid';
import { v4 as uuidv4 } from 'uuid';
import { models } from '../index.js';
import { ResponseHelpers } from '@minimeet/shared-models';
import nodemailer from 'nodemailer';
import { getMeetingInviteEmailTemplate } from '../templates/meetingInviteEmail.js';

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

export class MeetingController {
  /**
   * POST /meetings - Create a new meeting
   */
  async createMeeting(req, res) {
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
        teamId,
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

      // Validate teamId if provided
      if (teamId && req.user.organizationId) {
        const team = await models.Team.findOne({
          _id: teamId,
          organizationId: req.user.organizationId,
          status: { $ne: 'deleted' },
        });

        if (!team) {
          return ResponseHelpers.badRequest(
            res,
            'Team not found or does not belong to this organization'
          );
        }
      }

      const meeting = new models.Meeting({
        meetingId,
        title,
        description,
        scheduledTime,
        duration,
        createdBy: req.user.userId,
        organizationId: req.user.organizationId || null,
        teamId: teamId || null,
        participants: participants || [],
        privacy: privacy || 'public',
        invites,
      });

      await meeting.save();

      // Invalidate calendar cache for the user (meeting created, calendar should refresh)
      try {
        const { invalidateCalendarCache } = await import(
          '../services/calendarCacheService.js'
        );
        await invalidateCalendarCache(req.user.userId);
      } catch (cacheError) {
        console.warn(
          '[Meetings] Failed to invalidate calendar cache:',
          cacheError
        );
        // Don't fail the request if cache invalidation fails
      }

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

      return ResponseHelpers.created(
        res,
        { meetingId },
        'Meeting created successfully'
      );
    } catch (error) {
      console.error('Create meeting error:', error);
      return ResponseHelpers.serverError(
        res,
        'Failed to create meeting',
        error
      );
    }
  }

  /**
   * GET /meetings - List meetings
   * Merges native meetings with Google Calendar events
   */
  async listMeetings(req, res) {
    try {
      const { teamId } = req.query;
      const userId = req.user.userId;

      // Build query based on user's active organization
      const orgFilter = req.user.organizationId
        ? { organizationId: req.user.organizationId }
        : { organizationId: null }; // Personal workspace

      // Add teamId filter if provided
      const teamFilter = teamId ? { teamId } : {};

      // Fetch native meetings from database
      const nativeMeetings = await models.Meeting.find({
        ...orgFilter,
        ...teamFilter,
        $or: [
          { createdBy: userId },
          { participants: userId },
          { 'invites.email': req.user.email },
        ],
      }).sort({ scheduledTime: 1 });

      // Fetch Google Calendar events (cached) and merge
      let allMeetings = [...nativeMeetings];

      try {
        // Calculate date range: from 30 days ago to 90 days ahead
        const now = new Date();
        const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

        const { getCachedCalendarEvents, convertCalendarEventToMeeting } =
          await import('../services/calendarCacheService.js');

        const calendarEvents = await getCachedCalendarEvents(
          userId,
          startDate,
          endDate
        );

        // Convert calendar events to meeting format
        const calendarMeetings = calendarEvents.map((event) =>
          convertCalendarEventToMeeting(event, userId)
        );

        // Merge and deduplicate (in case a meeting was created in-app that also exists in calendar)
        const meetingMap = new Map();

        // Add native meetings first
        nativeMeetings.forEach((meeting) => {
          const key = `${meeting.scheduledTime}-${meeting.title}`;
          meetingMap.set(key, meeting);
        });

        // Add calendar events, avoiding duplicates
        calendarMeetings.forEach((calendarMeeting) => {
          const key = `${calendarMeeting.scheduledTime}-${calendarMeeting.title}`;
          // Only add if not already present (native meetings take precedence)
          if (!meetingMap.has(key)) {
            meetingMap.set(key, calendarMeeting);
          }
        });

        allMeetings = Array.from(meetingMap.values()).sort(
          (a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime)
        );
      } catch (calendarError) {
        console.error(
          '[Meetings] Error fetching calendar events:',
          calendarError
        );
        // Continue with native meetings only if calendar fetch fails
      }

      return ResponseHelpers.ok(res, allMeetings);
    } catch (error) {
      console.error('List meetings error:', error);
      return ResponseHelpers.serverError(res, 'Failed to list meetings', error);
    }
  }

  /**
   * GET /meetings/:meetingId - Get meeting details
   */
  async getMeeting(req, res) {
    try {
      const meeting = await models.Meeting.findOne({
        meetingId: req.params.meetingId,
      });

      if (!meeting) {
        return ResponseHelpers.notFound(res, 'Meeting not found');
      }

      // If meeting is public, allow access
      if (meeting.privacy === 'public') {
        return ResponseHelpers.ok(res, meeting);
      }

      // For private meetings, check if user is creator or has valid invite
      if (meeting.createdBy === req.user.userId) {
        return ResponseHelpers.ok(res, meeting);
      }

      // Check if user has a valid invite
      const userInvite = meeting.invites.find(
        (invite) => invite.email === req.user.email
      );
      if (userInvite && userInvite.status !== 'declined') {
        return ResponseHelpers.ok(res, meeting);
      }

      // User doesn't have access
      return ResponseHelpers.forbidden(
        res,
        'Access denied. You need an invite to join this private meeting.'
      );
    } catch (error) {
      console.error('Get meeting error:', error);
      return ResponseHelpers.serverError(res, 'Failed to get meeting', error);
    }
  }

  /**
   * PUT /meetings/:meetingId - Update meeting
   */
  async updateMeeting(req, res) {
    try {
      const meeting = await models.Meeting.findOne({
        meetingId: req.params.meetingId,
      });

      if (!meeting) {
        return ResponseHelpers.notFound(res, 'Meeting not found');
      }

      if (meeting.createdBy !== req.user.userId) {
        return ResponseHelpers.forbidden(
          res,
          'Not authorized to update this meeting'
        );
      }

      const updates = req.body;
      Object.assign(meeting, updates);
      await meeting.save();

      // Invalidate calendar cache for the user
      try {
        const { invalidateCalendarCache } = await import(
          '../services/calendarCacheService.js'
        );
        await invalidateCalendarCache(req.user.userId);
      } catch (cacheError) {
        console.warn(
          '[Meetings] Failed to invalidate calendar cache:',
          cacheError
        );
        // Don't fail the request if cache invalidation fails
      }

      return ResponseHelpers.ok(res, meeting, 'Meeting updated successfully');
    } catch (error) {
      console.error('Update meeting error:', error);
      return ResponseHelpers.serverError(
        res,
        'Failed to update meeting',
        error
      );
    }
  }

  /**
   * DELETE /meetings/:meetingId - Delete meeting
   */
  async deleteMeeting(req, res) {
    try {
      const meeting = await models.Meeting.findOne({
        meetingId: req.params.meetingId,
      });

      if (!meeting) {
        return ResponseHelpers.notFound(res, 'Meeting not found');
      }

      if (meeting.createdBy !== req.user.userId) {
        return ResponseHelpers.forbidden(
          res,
          'Not authorized to delete this meeting'
        );
      }

      await meeting.deleteOne();

      // Invalidate calendar cache for the user
      try {
        const { invalidateCalendarCache } = await import(
          '../services/calendarCacheService.js'
        );
        await invalidateCalendarCache(req.user.userId);
      } catch (cacheError) {
        console.warn(
          '[Meetings] Failed to invalidate calendar cache:',
          cacheError
        );
        // Don't fail the request if cache invalidation fails
      }

      return ResponseHelpers.ok(res, null, 'Meeting deleted successfully');
    } catch (error) {
      console.error('Delete meeting error:', error);
      return ResponseHelpers.serverError(
        res,
        'Failed to delete meeting',
        error
      );
    }
  }

  /**
   * POST /meetings/:meetingId/validate-token - Validate invite token
   */
  async validateToken(req, res) {
    try {
      const { token } = req.body;
      const meeting = await models.Meeting.findOne({
        meetingId: req.params.meetingId,
      });

      if (!meeting) {
        return ResponseHelpers.notFound(res, 'Meeting not found');
      }

      // If meeting is public, no token needed
      if (meeting.privacy === 'public') {
        return ResponseHelpers.ok(res, { valid: true, meeting });
      }

      // For private meetings, validate token
      if (!token) {
        return ResponseHelpers.unauthorized(
          res,
          'Invite token required for private meeting'
        );
      }

      // Check if user is the creator
      if (meeting.createdBy === req.user.userId) {
        return ResponseHelpers.ok(res, { valid: true, meeting });
      }

      // Check if token matches any invite
      const validInvite = meeting.invites.find(
        (invite) => invite.inviteToken === token
      );
      if (!validInvite) {
        return ResponseHelpers.forbidden(
          res,
          'Invalid or expired invite token'
        );
      }

      // Update invite status to accepted if it was pending
      if (validInvite.status === 'pending') {
        validInvite.status = 'accepted';
        await meeting.save();
      }

      return ResponseHelpers.ok(res, { valid: true, meeting });
    } catch (error) {
      console.error('Validate token error:', error);
      return ResponseHelpers.serverError(
        res,
        'Failed to validate token',
        error
      );
    }
  }

  /**
   * POST /meetings/:meetingId/start - Start meeting
   */
  async startMeeting(req, res) {
    try {
      const meeting = await models.Meeting.findOne({
        meetingId: req.params.meetingId,
      });

      if (!meeting) {
        return ResponseHelpers.notFound(res, 'Meeting not found');
      }

      if (meeting.createdBy !== req.user.userId) {
        return ResponseHelpers.forbidden(
          res,
          'Not authorized to start this meeting'
        );
      }

      if (meeting.roomId) {
        return ResponseHelpers.conflict(res, 'Meeting already started', null, {
          roomId: meeting.roomId,
        });
      }

      // Create a new room
      const roomId = nanoid(10);
      const room = new models.Room({
        roomId,
        createdBy: req.user.userId,
        organizationId: meeting.organizationId,
        teamId: meeting.teamId || null,
      });
      await room.save();

      meeting.roomId = roomId;
      meeting.status = 'ongoing';
      await meeting.save();

      return ResponseHelpers.ok(
        res,
        { roomId },
        'Meeting started successfully'
      );
    } catch (error) {
      console.error('Start meeting error:', error);
      return ResponseHelpers.serverError(res, 'Failed to start meeting', error);
    }
  }

  /**
   * POST /meetings/:meetingId/complete - Complete meeting
   */
  async completeMeeting(req, res) {
    try {
      const meeting = await models.Meeting.findOne({
        meetingId: req.params.meetingId,
      });

      if (!meeting) {
        return ResponseHelpers.notFound(res, 'Meeting not found');
      }

      if (meeting.createdBy !== req.user.userId) {
        return ResponseHelpers.forbidden(
          res,
          'Not authorized to complete this meeting'
        );
      }

      if (meeting.status === 'completed') {
        return ResponseHelpers.badRequest(res, 'Meeting already completed');
      }

      if (meeting.status === 'cancelled') {
        return ResponseHelpers.badRequest(
          res,
          'Cannot complete a cancelled meeting'
        );
      }

      meeting.status = 'completed';
      await meeting.save();

      return ResponseHelpers.ok(res, null, 'Meeting completed successfully');
    } catch (error) {
      console.error('Complete meeting error:', error);
      return ResponseHelpers.serverError(
        res,
        'Failed to complete meeting',
        error
      );
    }
  }
}

export default MeetingController;
