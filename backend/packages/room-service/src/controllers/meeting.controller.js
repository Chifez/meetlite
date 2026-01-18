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
import {
  generateRRULE,
  validateRecurrence,
  getNextOccurrences,
  createRecurrenceInstances,
  cancelRecurrenceSeries,
} from '../services/recurrence.service.js';
import {
  invalidateCalendarCache,
  getCachedCalendarEvents,
  convertCalendarEventToMeeting,
} from '../services/calendar-cache.service.js';

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

/**
 * Check if user can modify (update/delete) a meeting
 * Allowed: Creator, Org owner/admin, Team owner/admin
 * Not allowed: Regular team members
 */
async function canModifyMeeting(meeting, userId, organizationId) {
  // Creator can always modify their own meetings
  if (meeting.createdBy === userId) {
    return true;
  }

  // Fetch user document to check roles
  const userDoc = await models.User.findById(userId);
  if (!userDoc) {
    return false;
  }

  // Check if user is organization owner or admin
  const orgMembership = userDoc.memberships?.find(
    (m) =>
      m.organizationId.toString() === organizationId.toString() &&
      m.status === 'active'
  );

  const isOrgOwnerOrAdmin =
    orgMembership &&
    (orgMembership.role === 'owner' || orgMembership.role === 'admin');

  if (isOrgOwnerOrAdmin) {
    return true;
  }

  // For team meetings, check if user is team owner/admin
  if (meeting.teamId && organizationId) {
    const team = await models.Team.findOne({
      _id: meeting.teamId,
      organizationId: organizationId,
      status: { $ne: 'deleted' },
    });

    if (team) {
      // Check if user is team owner
      if (team.ownerId.toString() === userId.toString()) {
        return true;
      }

      // Check if user is team admin
      const isTeamAdmin = userDoc.teamMemberships?.some(
        (m) =>
          m.teamId.toString() === meeting.teamId.toString() &&
          m.organizationId.toString() === organizationId.toString() &&
          m.role === 'admin' &&
          m.status === 'active'
      );

      if (isTeamAdmin) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if user can access (view/get) a meeting
 * Allowed: Creator, Participants (invited), Org owner/admin, Team members (for team meetings)
 */
async function canAccessMeeting(meeting, userId, userEmail, organizationId) {
  // Creator can always access
  if (meeting.createdBy === userId) {
    return true;
  }

  // Fetch user document to check roles
  const userDoc = await models.User.findById(userId);
  if (!userDoc) {
    return false;
  }

  // Check if user is a participant (invited)
  const userInvite = meeting.invites.find(
    (invite) => invite.email === userEmail && invite.status !== 'declined'
  );
  if (userInvite) {
    return true;
  }

  // Check if user is organization owner or admin
  const orgMembership = userDoc.memberships?.find(
    (m) =>
      m.organizationId.toString() === organizationId.toString() &&
      m.status === 'active'
  );

  const isOrgOwnerOrAdmin =
    orgMembership &&
    (orgMembership.role === 'owner' || orgMembership.role === 'admin');

  if (isOrgOwnerOrAdmin) {
    return true;
  }

  // For team meetings, check if user is a team member (but only if they're a participant)
  // Team members not in participants list cannot access
  if (meeting.teamId && organizationId) {
    const isTeamMember = userDoc.teamMemberships?.some(
      (m) =>
        m.teamId.toString() === meeting.teamId.toString() &&
        m.organizationId.toString() === organizationId.toString() &&
        m.status === 'active'
    );

    // For team meetings, user must be both a team member AND a participant
    if (isTeamMember) {
      // Check if user email is in participants/invites
      const isParticipant =
        meeting.invites.some(
          (invite) => invite.email === userEmail && invite.status !== 'declined'
        ) || meeting.participants.includes(userId);

      return isParticipant;
    }
  }

  // For public meetings, allow access
  if (meeting.privacy === 'public') {
    return true;
  }

  return false;
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
      recurrence,
      autoIncludeTeamMembers,
    } = req.body;

    const meetingId = nanoid(12);

    // Prepare invites and participants
    let finalInviteEmails = [...(inviteEmails || [])];
    let finalParticipants = [...(participants || [])];

    // Auto-include team members if teamId is provided and flag is set
    if (teamId && req.user.organizationId && autoIncludeTeamMembers !== false) {
      const team = await models.Team.findOne({
        _id: teamId,
        organizationId: req.user.organizationId,
        status: { $ne: 'deleted' },
      }).populate('members.userId', 'email');

      if (team && team.members) {
        // Get all active team member emails
        const teamMemberEmails = team.members
          .filter((m) => m.status === 'active' && m.userId && m.userId.email)
          .map((m) => m.userId.email)
          .filter((email) => email && !finalInviteEmails.includes(email));

        // Add team members to invites and participants
        finalInviteEmails.push(...teamMemberEmails);
        finalParticipants.push(...teamMemberEmails);
      }
    }

    // Create invites from final invite emails
    let invites = [];
    if (Array.isArray(finalInviteEmails)) {
      invites = finalInviteEmails
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

    // Handle recurrence
    let recurrenceData = null;
    let isRecurring = false;

    if (recurrence && recurrence.pattern) {
      // Validate recurrence configuration
      const validation = validateRecurrence(recurrence);
      if (!validation.valid) {
        throw AppError.validation(validation.error);
      }

      isRecurring = true;
      const startDate = new Date(scheduledTime);

      // Generate RRULE string
      const rruleString = generateRRULE(recurrence, startDate);

      recurrenceData = {
        pattern: recurrence.pattern,
        interval: recurrence.interval || 1,
        daysOfWeek: recurrence.daysOfWeek || [],
        dayOfMonth: recurrence.dayOfMonth,
        endDate: recurrence.endDate ? new Date(recurrence.endDate) : null,
        occurrences: recurrence.occurrences,
        endType: recurrence.endType || 'never',
        rrule: rruleString,
      };
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
      participants: finalParticipants,
      privacy: privacy || 'public',
      invites,
      isRecurring,
      recurrence: recurrenceData,
    });

    await meeting.save();

    // Create initial recurrence instances if this is a recurring meeting
    if (isRecurring && recurrenceData) {
      try {
        const now = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30); // 30 days ahead

        const instances = await createRecurrenceInstances(
          meeting,
          models,
          now,
          endDate
        );
      } catch (recurrenceError) {
        console.error(
          'Failed to create initial recurrence instances:',
          recurrenceError
        );
        // Don't fail the request if instance creation fails
      }
    }

    // Invalidate calendar cache for the user (meeting created, calendar should refresh)
    try {
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
        participants: finalInviteEmails || [...invites.map((i) => i.email)],
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

    // Also fetch parent recurring meetings for any instances found
    // Collect unique recurrenceIds from instances
    const instanceRecurrenceIds = new Set();
    nativeMeetings.forEach((meeting) => {
      if (meeting.recurrenceId) {
        instanceRecurrenceIds.add(meeting.recurrenceId.toString());
      }
    });

    if (instanceRecurrenceIds.size > 0) {
      // Mongoose auto-converts string IDs to ObjectIds in queries
      const parentMeetings = await models.Meeting.find({
        _id: { $in: Array.from(instanceRecurrenceIds) },
        ...orgFilter,
        ...teamFilter,
      });

      // Add parent meetings to the list (avoid duplicates)
      const existingMeetingIds = new Set(
        nativeMeetings.map((m) => m._id.toString())
      );
      parentMeetings.forEach((parent) => {
        if (!existingMeetingIds.has(parent._id.toString())) {
          nativeMeetings.push(parent);
        }
      });
    }

    // Post-filter: For team meetings, only include if user is a participant
    const userDoc = await models.User.findById(userId).lean();

    const filteredMeetings = nativeMeetings.filter((meeting) => {
      // Non-team meetings: use existing access logic
      if (!meeting.teamId) {
        return true;
      }

      // Team meetings: user must be a participant (via invites)
      const isInvited = meeting.invites.some(
        (invite) =>
          invite.email === req.user.email && invite.status !== 'declined'
      );

      if (isInvited || meeting.createdBy === userId) {
        return true;
      }

      // Org owners/admins can see all team meetings
      if (userDoc && req.user.organizationId) {
        const orgMembership = userDoc.memberships?.find(
          (m) =>
            m.organizationId.toString() ===
              req.user.organizationId.toString() && m.status === 'active'
        );
        const isOrgOwnerOrAdmin =
          orgMembership &&
          (orgMembership.role === 'owner' || orgMembership.role === 'admin');

        if (isOrgOwnerOrAdmin) {
          return true;
        }
      }

      return false;
    });

    // Fetch Google Calendar events (cached) and merge
    let allMeetings = [...filteredMeetings];

    try {
      // Calculate date range: from 30 days ago to 90 days ahead
      const now = new Date();
      const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

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
      // Use meetingId as key to avoid parent meetings being overwritten by instances with same title/time
      const meetingMap = new Map();

      // Add native meetings first (use meetingId as key to preserve all meetings including parents)
      filteredMeetings.forEach((meeting) => {
        meetingMap.set(meeting.meetingId, meeting);
      });

      // Add calendar events, avoiding duplicates
      calendarMeetings.forEach((calendarMeeting) => {
        // Use scheduledTime-title for calendar events (they don't have meetingId)
        const key = `${calendarMeeting.scheduledTime}-${calendarMeeting.title}`;
        // Check if we already have a native meeting with same time/title
        const existingNativeMeeting = Array.from(meetingMap.values()).find(
          (m) =>
            m.scheduledTime?.toString() ===
              calendarMeeting.scheduledTime?.toString() &&
            m.title === calendarMeeting.title
        );
        // Only add calendar event if no native meeting matches (native meetings take precedence)
        if (!existingNativeMeeting) {
          // Use a unique key for calendar events
          meetingMap.set(`calendar-${key}`, calendarMeeting);
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

    // Check if user can access this meeting
    const hasAccess = await canAccessMeeting(
      meeting,
      req.user.userId,
      req.user.email,
      req.user.organizationId
    );

    if (!hasAccess) {
    throw AppError.forbidden(
        'Access denied. You need to be invited or be a team member to access this meeting.'
    );
    }

    return ResponseHelpers.ok(res, meeting);
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

    // Check if user can modify this meeting (creator, org admin/owner, team admin/owner)
    const canModify = await canModifyMeeting(
      meeting,
      req.user.userId,
      req.user.organizationId
    );

    if (!canModify) {
      throw AppError.forbidden(
        'Not authorized to update this meeting. Only meeting creator, organization admins/owners, or team admins/owners can update meetings.'
      );
    }

    const updates = req.body;

    // Check meeting status - prevent changes to completed/cancelled meetings
    if (meeting.status === 'completed' || meeting.status === 'cancelled') {
      throw AppError.validation(
        'Cannot modify completed or cancelled meetings'
      );
    }

    // Handle inviteEmails/participants separately
    let newInvites = [];
    let removedEmails = [];
    let participantsChanged = false;

    if (updates.inviteEmails !== undefined) {
      // Calculate additions and removals
      const existingEmails = new Set(meeting.invites.map((inv) => inv.email));
      const newEmails = new Set(updates.inviteEmails || []);

      removedEmails = Array.from(existingEmails).filter(
        (e) => !newEmails.has(e)
      );
      const addedEmails = Array.from(newEmails).filter(
        (e) => !existingEmails.has(e)
      );

      // Remove invites for removed participants
      meeting.invites = meeting.invites.filter(
        (inv) => !removedEmails.includes(inv.email)
      );

      // Add new invites for added participants
      newInvites = addedEmails
        .filter((e) => typeof e === 'string' && e.trim().length > 3)
        .map((email) => ({
          email,
          status: 'pending',
          inviteToken: uuidv4(),
        }));

      meeting.invites.push(...newInvites);

      // Sync participants array with invites
      updates.participants = updates.inviteEmails;
      participantsChanged = true;
    }

    // Track if time or participants changed
    const timeChanged =
      updates.scheduledTime &&
      new Date(updates.scheduledTime).getTime() !==
        new Date(meeting.scheduledTime).getTime();

    if (!participantsChanged) {
      participantsChanged =
      updates.participants &&
      JSON.stringify(updates.participants) !==
        JSON.stringify(meeting.participants);
    }

    // Prevent participant changes for ongoing meetings
    if (meeting.status === 'ongoing' && participantsChanged) {
      throw AppError.validation(
        'Cannot modify participants for ongoing meetings'
      );
    }

    // Apply other updates (excluding inviteEmails which we handled separately)
    Object.keys(updates).forEach((key) => {
      if (key !== 'inviteEmails' && key !== 'participants') {
        meeting[key] = updates[key];
      } else if (key === 'participants') {
        meeting[key] = updates[key];
      }
    });

    await meeting.save();

    // Send invite emails to newly added participants
    if (newInvites.length > 0) {
      try {
        const creator = await models.User.findById(meeting.createdBy)
          .select('email name')
          .lean();

        for (const invite of newInvites) {
          try {
            await queueInviteEmail({
              to: invite.email,
              meeting,
              inviteToken: invite.inviteToken,
              hostEmail: creator?.email || req.user.email,
            });
          } catch (error) {
            console.error('Failed to queue invite email:', error);
            // Continue with other invites even if one fails
          }
        }
      } catch (emailError) {
        console.warn('[Meetings] Failed to send invite emails:', emailError);
        // Don't fail the request if email sending fails
      }
    }

    // Invalidate calendar cache for the user
    try {
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

      // Get participant emails from invites
      const participantEmails = meeting.invites.map((inv) => inv.email);

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
            participants: participantEmails,
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
          participants: participantEmails,
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

    // Check if user can modify this meeting (creator, org admin/owner, team admin/owner)
    const canModify = await canModifyMeeting(
      meeting,
      req.user.userId,
      req.user.organizationId
    );

    if (!canModify) {
      throw AppError.forbidden(
        'Not authorized to delete this meeting. Only meeting creator, organization admins/owners, or team admins/owners can delete meetings.'
      );
    }

    // Handle recurring meeting series deletion
    if (meeting.isRecurring) {
      // Delete parent meeting and cancel all future instances
      try {
        await cancelRecurrenceSeries(
          meeting,
          models,
          'Recurring series deleted'
        );

        // Cancel reminders for parent
        await cancelMeetingReminders(
          meeting.meetingId,
          'Recurring series deleted',
          req.user.userId
        );

        // Delete the parent meeting after canceling series
        await meeting.deleteOne();
      } catch (recurrenceError) {
        console.error('Failed to cancel recurrence series:', recurrenceError);
        // Still try to delete the meeting even if cancellation fails
        await meeting.deleteOne();
      }
    } else if (meeting.recurrenceId) {
      // This is an instance - just delete the instance
      await cancelMeetingReminders(
        meeting.meetingId,
        'Meeting instance deleted',
        req.user.userId
      );
      await meeting.deleteOne();
    } else {
      // Regular meeting - delete normally
      await cancelMeetingReminders(
        meeting.meetingId,
        'Meeting deleted',
        req.user.userId
      );
      await meeting.deleteOne();
    }

    // Invalidate calendar cache for the user
    try {
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
