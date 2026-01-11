import { nanoid } from 'nanoid';
import { v4 as uuidv4 } from 'uuid';
import { models } from '../index.js';
import { AppError, ResponseHelpers, EmailQueue } from '@minimeet/shared';
import {
  scheduleMeetingReminders,
  cancelMeetingReminders,
  rescheduleMeetingReminders,
  updateMeetingReminderParticipants,
} from '../services/notification.service.js';

// Utility to queue invite email
async function queueInviteEmail({ to, meeting, inviteToken, hostEmail }) {
  const emailQueue = new EmailQueue();
  const joinUrl = `${process.env.CLIENT_URL}/meeting/${meeting.meetingId}/join?token=${inviteToken}`;

  await emailQueue.addEmailJob(
    'meeting_invite',
    {
      userEmail: to,
      meetingId: meeting.meetingId,
      meetingTitle: meeting.title,
      meetingTime: meeting.scheduledTime,
      meetingDescription: meeting.description,
      duration: meeting.duration,
      joinUrl,
      inviteToken,
      hostEmail,
    },
    {
      priority: 1,
      jobId: `meeting-invite-${meeting.meetingId}-${to}-${Date.now()}`,
    }
  );
}

export class MeetingController {
  /**
   * POST /meetings - Create a new meeting
   */
  async createMeeting(req, res) {
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
      // Validate teamId format
      if (!teamId.match(/^[0-9a-fA-F]{24}$/)) {
        throw AppError.validation('Invalid team ID format');
      }

      const team = await models.Team.findOne({
        _id: teamId,
        organizationId: req.user.organizationId,
        status: { $ne: 'deleted' },
      });

      if (!team) {
        throw AppError.validation(
          'Team not found or does not belong to this organization'
        );
      }

      // Check if user has access to the team (owner/admin/member)
      // Fetch full user document to check teamMemberships
      const userDoc = await models.User.findById(req.user.userId);
      if (!userDoc) {
        throw AppError.notFound('User');
      }

      // Check if user is organization owner or admin
      const orgMembership = userDoc.memberships?.find(
        (m) =>
          m.organizationId.toString() === req.user.organizationId.toString() &&
          m.status === 'active'
      );

      const isOrgOwnerOrAdmin =
        orgMembership &&
        (orgMembership.role === 'owner' || orgMembership.role === 'admin');

      // Check if user is a team member
      const isTeamMember = userDoc.teamMemberships?.some(
        (m) =>
          m.teamId.toString() === teamId.toString() &&
          m.organizationId.toString() === req.user.organizationId.toString() &&
          m.status === 'active'
      );

      if (!isOrgOwnerOrAdmin && !isTeamMember) {
        throw AppError.forbidden(
          'Access denied. You must be a team member or organization owner/admin to create team meetings.'
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
        '../services/calendar-cache.service.js'
      );
      await invalidateCalendarCache(req.user.userId);
    } catch (cacheError) {
      console.warn(
        '[Meetings] Failed to invalidate calendar cache:',
        cacheError
      );
      // Don't fail the request if cache invalidation fails
    }

    // Queue invite emails
    if (invites.length > 0) {
      for (const invite of invites) {
        try {
          await queueInviteEmail({
            to: invite.email,
            meeting,
            inviteToken: invite.inviteToken,
            hostEmail,
          });
        } catch (error) {
          // Continue with other invites even if one fails
          console.error('Failed to queue meeting invite email:', error);
        }
      }
    }

    // Schedule meeting reminders
    try {
      // Get creator's name for reminders
      const creator = await models.User.findById(req.user.userId)
        .select('name')
        .lean();

      await scheduleMeetingReminders({
        meetingId: meeting.meetingId,
        title: meeting.title,
        description: meeting.description,
        scheduledTime: meeting.scheduledTime,
        duration: meeting.duration,
        createdBy: meeting.createdBy,
        createdByName: creator?.name || 'Unknown',
        participants: [...invites.map((i) => i.email), ...(participants || [])],
        timezone: req.body.timezone || 'UTC',
      });
    } catch (reminderError) {
      console.warn('[Meetings] Failed to schedule reminders:', reminderError);
      // Don't fail the request if reminder scheduling fails
    }

    return ResponseHelpers.created(
      res,
      { meetingId },
      'Meeting created successfully'
    );
  }

  /**
   * GET /meetings - List meetings
   * Merges native meetings with Google Calendar events
   */
  async listMeetings(req, res) {
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
        await import('../services/calendar-cache.service.js');

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
  }

  /**
   * GET /meetings/:meetingId - Get meeting details
   */
  async getMeeting(req, res) {
    const meeting = await models.Meeting.findOne({
      meetingId: req.params.meetingId,
    });

    if (!meeting) {
      throw AppError.notFound('Meeting');
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
    throw AppError.forbidden(
      'Access denied. You need an invite to join this private meeting.'
    );
  }

  /**
   * PUT /meetings/:meetingId - Update meeting
   */
  async updateMeeting(req, res) {
    const meeting = await models.Meeting.findOne({
      meetingId: req.params.meetingId,
    });

    if (!meeting) {
      throw AppError.notFound('Meeting');
    }

    if (meeting.createdBy !== req.user.userId) {
      throw AppError.forbidden('Not authorized to update this meeting');
    }

    const updates = req.body;

    // Track if time or participants changed
    const timeChanged =
      updates.scheduledTime &&
      new Date(updates.scheduledTime).getTime() !==
        new Date(meeting.scheduledTime).getTime();

    const participantsChanged =
      updates.participants &&
      JSON.stringify(updates.participants) !==
        JSON.stringify(meeting.participants);

    const oldParticipants = meeting.participants || [];

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

    // Handle reminder updates
    try {
      // Get creator's name for reminders
      const creator = await models.User.findById(meeting.createdBy)
        .select('name')
        .lean();

      if (timeChanged) {
        // Reschedule all reminders if time changed
        await rescheduleMeetingReminders(
          meeting.meetingId,
          {
            meetingId: meeting.meetingId,
            title: meeting.title,
            description: meeting.description,
            scheduledTime: meeting.scheduledTime,
            duration: meeting.duration,
            createdBy: meeting.createdBy,
            createdByName: creator?.name || 'Unknown',
            participants: meeting.participants || [],
            timezone: updates.timezone || 'UTC',
          },
          req.user.userId
        );
      } else if (participantsChanged) {
        // Update only participant reminders if only participants changed
        await updateMeetingReminderParticipants(meeting.meetingId, {
          meetingId: meeting.meetingId,
          title: meeting.title,
          description: meeting.description,
          scheduledTime: meeting.scheduledTime,
          duration: meeting.duration,
          createdBy: meeting.createdBy,
          createdByName: creator?.name || 'Unknown',
          participants: meeting.participants || [],
          timezone: updates.timezone || 'UTC',
        });
      }
    } catch (reminderError) {
      console.warn('[Meetings] Failed to update reminders:', reminderError);
      // Don't fail the request if reminder update fails
    }

    return ResponseHelpers.ok(res, meeting, 'Meeting updated successfully');
  }

  /**
   * DELETE /meetings/:meetingId - Delete meeting
   */
  async deleteMeeting(req, res) {
    const meeting = await models.Meeting.findOne({
      meetingId: req.params.meetingId,
    });

    if (!meeting) {
      throw AppError.notFound('Meeting');
    }

    if (meeting.createdBy !== req.user.userId) {
      throw AppError.forbidden('Not authorized to delete this meeting');
    }

    // Cancel meeting reminders before deleting
    try {
      await cancelMeetingReminders(
        meeting.meetingId,
        'Meeting deleted',
        req.user.userId
      );
    } catch (reminderError) {
      console.warn('[Meetings] Failed to cancel reminders:', reminderError);
      // Don't fail the request if reminder cancellation fails
    }

    await meeting.deleteOne();

    // Invalidate calendar cache for the user
    try {
      const { invalidateCalendarCache } = await import(
        '../services/calendar-cache.service.js'
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
  }

  /**
   * POST /meetings/:meetingId/validate-token - Validate invite token
   */
  async validateToken(req, res) {
    const { token } = req.body;
    const meeting = await models.Meeting.findOne({
      meetingId: req.params.meetingId,
    });

    if (!meeting) {
      throw AppError.notFound('Meeting');
    }

    // If meeting is public, no token needed
    if (meeting.privacy === 'public') {
      return ResponseHelpers.ok(res, { valid: true, meeting });
    }

    // For private meetings, validate token
    if (!token) {
      throw AppError.unauthorized('Invite token required for private meeting');
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
      throw AppError.forbidden('Invalid or expired invite token');
    }

    // Update invite status to accepted if it was pending
    if (validInvite.status === 'pending') {
      validInvite.status = 'accepted';
      await meeting.save();
    }

    return ResponseHelpers.ok(res, { valid: true, meeting });
  }

  /**
   * POST /meetings/:meetingId/start - Start meeting
   */
  async startMeeting(req, res) {
    const meeting = await models.Meeting.findOne({
      meetingId: req.params.meetingId,
    });

    if (!meeting) {
      throw AppError.notFound('Meeting');
    }

    if (meeting.createdBy !== req.user.userId) {
      throw AppError.forbidden('Not authorized to start this meeting');
    }

    if (meeting.roomId) {
      const conflictError = AppError.conflict('Meeting already started');
      conflictError.roomId = meeting.roomId;
      throw conflictError;
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

    return ResponseHelpers.ok(res, { roomId }, 'Meeting started successfully');
  }

  /**
   * POST /meetings/:meetingId/complete - Complete meeting
   */
  async completeMeeting(req, res) {
    const meeting = await models.Meeting.findOne({
      meetingId: req.params.meetingId,
    });

    if (!meeting) {
      throw AppError.notFound('Meeting');
    }

    if (meeting.createdBy !== req.user.userId) {
      throw AppError.forbidden('Not authorized to complete this meeting');
    }

    if (meeting.status === 'completed') {
      throw AppError.validation('Meeting already completed');
    }

    if (meeting.status === 'cancelled') {
      throw AppError.validation('Cannot complete a cancelled meeting');
    }

    meeting.status = 'completed';
    await meeting.save();

    return ResponseHelpers.ok(res, null, 'Meeting completed successfully');
  }
}

export default MeetingController;
