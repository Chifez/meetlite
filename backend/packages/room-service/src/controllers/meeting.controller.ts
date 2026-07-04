import { Response } from 'express';
import { nanoid } from 'nanoid';
import { v4 as uuidv4 } from 'uuid';
import { models } from '../index.js';
import { AppError, ResponseHelpers } from '@minimeet/shared';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { MeetingAuthorizationService } from '../services/meeting-authorization.service.js';
import { MeetingEmailService } from '../services/meeting-email.service.js';
import {
  scheduleMeetingReminders,
  cancelMeetingReminders,
  rescheduleMeetingReminders,
  updateMeetingReminderParticipants,
} from '../services/notification.service.js';
import {
  generateRRULE,
  validateRecurrence,
  createRecurrenceInstances,
  cancelRecurrenceSeries,
} from '../services/recurrence.service.js';
import {
  invalidateCalendarCache,
  getCachedCalendarEvents,
  convertCalendarEventToMeeting,
} from '../services/calendar-cache.service.js';

export class MeetingController {
  /**
   * POST /meetings - Create a new meeting
   */
  async createMeeting(req: AuthenticatedRequest, res: Response) {
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

    let finalInviteEmails = [...(inviteEmails || [])];
    let finalParticipants = [...(participants || [])];

    if (teamId && req.user.organizationId && autoIncludeTeamMembers !== false) {
      const team = await (models.Team as any).findOne({
        _id: teamId,
        organizationId: req.user.organizationId,
        status: { $ne: 'deleted' },
      }).populate('members.userId', 'email');

      if (team && team.members) {
        const teamMemberEmails = team.members
          .filter((m: any) => m.status === 'active' && m.userId && m.userId.email)
          .map((m: any) => m.userId.email)
          .filter((email: string) => email && !finalInviteEmails.includes(email));

        finalInviteEmails.push(...teamMemberEmails);
        finalParticipants.push(...teamMemberEmails);
      }
    }

    let invites: any[] = [];
    if (Array.isArray(finalInviteEmails)) {
      invites = finalInviteEmails
        .filter((e) => typeof e === 'string' && e.trim().length > 3)
        .map((email) => ({
          email,
          status: 'pending',
          inviteToken: uuidv4(),
        }));
    }

    if (teamId && req.user.organizationId) {
      if (!teamId.match(/^[0-9a-fA-F]{24}$/)) {
        throw AppError.validation('Invalid team ID format');
      }

      const team = await (models.Team as any).findOne({
        _id: teamId,
        organizationId: req.user.organizationId,
        status: { $ne: 'deleted' },
      });

      if (!team) {
        throw AppError.validation(
          'Team not found or does not belong to this organization'
        );
      }

      const userDoc = await (models.User as any).findById(req.user.userId);
      if (!userDoc) {
        throw AppError.notFound('User');
      }

      const orgMembership = userDoc.memberships?.find(
        (m: any) =>
          m.organizationId.toString() === req.user.organizationId.toString() &&
          m.status === 'active'
      );

      const isOrgOwnerOrAdmin =
        orgMembership &&
        (orgMembership.role === 'owner' || orgMembership.role === 'admin');

      const isTeamMember = userDoc.teamMemberships?.some(
        (m: any) =>
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

    let recurrenceData = null;
    let isRecurring = false;

    if (recurrence && recurrence.pattern) {
      const validation: any = validateRecurrence(recurrence);
      if (!validation.valid) {
        throw AppError.validation(validation.error);
      }

      isRecurring = true;
      const startDate = new Date(scheduledTime);
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

    if (isRecurring && recurrenceData) {
      try {
        const now = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30); // 30 days ahead

        await createRecurrenceInstances(
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
      }
    }

    try {
      await invalidateCalendarCache(req.user.userId);
    } catch (cacheError) {
      console.warn(
        '[Meetings] Failed to invalidate calendar cache:',
        cacheError
      );
    }

    if (invites.length > 0) {
      for (const invite of invites) {
        try {
          await MeetingEmailService.queueInvite({
            to: invite.email,
            meeting,
            inviteToken: invite.inviteToken,
            hostEmail,
          });
        } catch (error) {
          console.error('Failed to queue meeting invite email:', error);
        }
      }
    }

    try {
      const creator = await (models.User as any).findById(req.user.userId)
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
      } as any);
    } catch (reminderError) {
      console.warn('[Meetings] Failed to schedule reminders:', reminderError);
    }

    return ResponseHelpers.created(
      res,
      { meetingId },
      'Meeting created successfully'
    );
  }

  /**
   * GET /meetings - List meetings
   */
  async listMeetings(req: AuthenticatedRequest, res: Response) {
    const { teamId } = req.query as any;
    const userId = req.user.userId;

    const orgFilter = req.user.organizationId
      ? { organizationId: req.user.organizationId }
      : { organizationId: null };

    const teamFilter = teamId ? { teamId } : {};

    const nativeMeetings = await (models.Meeting as any).find({
      ...orgFilter,
      ...teamFilter,
      $or: [
        { createdBy: userId },
        { participants: userId },
        { 'invites.email': req.user.email },
      ],
    }).sort({ scheduledTime: 1 });

    const instanceRecurrenceIds = new Set<string>();
    nativeMeetings.forEach((meeting: any) => {
      if (meeting.recurrenceId) {
        instanceRecurrenceIds.add(meeting.recurrenceId.toString());
      }
    });

    if (instanceRecurrenceIds.size > 0) {
      const parentMeetings = await (models.Meeting as any).find({
        _id: { $in: Array.from(instanceRecurrenceIds) },
        ...orgFilter,
        ...teamFilter,
      });

      const existingMeetingIds = new Set(
        nativeMeetings.map((m: any) => m._id.toString())
      );
      parentMeetings.forEach((parent: any) => {
        if (!existingMeetingIds.has(parent._id.toString())) {
          nativeMeetings.push(parent);
        }
      });
    }

    const userDoc = await (models.User as any).findById(userId).lean();

    const filteredMeetings = nativeMeetings.filter((meeting: any) => {
      if (!meeting.teamId) {
        return true;
      }

      const isInvited = meeting.invites.some(
        (invite: any) =>
          invite.email === req.user.email && invite.status !== 'declined'
      );

      if (isInvited || meeting.createdBy === userId) {
        return true;
      }

      if (userDoc && req.user.organizationId) {
        const orgMembership = userDoc.memberships?.find(
          (m: any) =>
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

    let allMeetings = [...filteredMeetings];

    try {
      const now = new Date();
      const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      const calendarEvents = await getCachedCalendarEvents(
        userId,
        startDate,
        endDate
      );

      const calendarMeetings = calendarEvents.map((event: any) =>
        convertCalendarEventToMeeting(event, userId)
      );

      const meetingMap = new Map();

      filteredMeetings.forEach((meeting: any) => {
        meetingMap.set(meeting.meetingId, meeting);
      });

      calendarMeetings.forEach((calendarMeeting: any) => {
        const key = `${calendarMeeting.scheduledTime}-${calendarMeeting.title}`;
        const existingNativeMeeting = Array.from(meetingMap.values()).find(
          (m: any) =>
            m.scheduledTime?.toString() ===
              calendarMeeting.scheduledTime?.toString() &&
            m.title === calendarMeeting.title
        );
        if (!existingNativeMeeting) {
          meetingMap.set(`calendar-${key}`, calendarMeeting);
        }
      });

      allMeetings = Array.from(meetingMap.values()).sort(
        (a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
      );
    } catch (calendarError) {
      console.error(
        '[Meetings] Error fetching calendar events:',
        calendarError
      );
    }

    return ResponseHelpers.ok(res, allMeetings);
  }

  /**
   * GET /meetings/:meetingId - Get meeting details
   */
  async getMeeting(req: AuthenticatedRequest, res: Response) {
    const meeting = await models.Meeting.findOne({
      meetingId: req.params.meetingId,
    });

    if (!meeting) {
      throw AppError.notFound('Meeting');
    }

    const hasAccess = await MeetingAuthorizationService.canAccess(
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
  async updateMeeting(req: AuthenticatedRequest, res: Response) {
    const meeting = await models.Meeting.findOne({
      meetingId: req.params.meetingId,
    });

    if (!meeting) {
      throw AppError.notFound('Meeting');
    }

    const canModify = await MeetingAuthorizationService.canModify(
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

    if (meeting.status === 'completed' || meeting.status === 'cancelled') {
      throw AppError.validation(
        'Cannot modify completed or cancelled meetings'
      );
    }

    let newInvites: any[] = [];
    let removedEmails: string[] = [];
    let participantsChanged = false;

    if (updates.inviteEmails !== undefined) {
      const existingEmails = new Set(meeting.invites.map((inv: any) => inv.email));
      const newEmails = new Set(updates.inviteEmails || []);

      removedEmails = Array.from(existingEmails).filter(
        (e: any) => !newEmails.has(e)
      ) as string[];
      const addedEmails = Array.from(newEmails).filter(
        (e: any) => !existingEmails.has(e)
      );

      meeting.invites = meeting.invites.filter(
        (inv: any) => !removedEmails.includes(inv.email)
      );

      newInvites = addedEmails
        .filter((e) => typeof e === 'string' && e.trim().length > 3)
        .map((email) => ({
          email,
          status: 'pending',
          inviteToken: uuidv4(),
        }));

      meeting.invites.push(...newInvites);

      updates.participants = updates.inviteEmails;
      participantsChanged = true;
    }

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

    if (meeting.status === 'ongoing' && participantsChanged) {
      throw AppError.validation(
        'Cannot modify participants for ongoing meetings'
      );
    }

    Object.keys(updates).forEach((key) => {
      if (key !== 'inviteEmails' && key !== 'participants') {
        (meeting as any)[key] = updates[key];
      } else if (key === 'participants') {
        (meeting as any)[key] = updates[key];
      }
    });

    await meeting.save();

    if (newInvites.length > 0) {
      try {
        const creator = await (models.User as any).findById(meeting.createdBy)
          .select('email name')
          .lean();

        for (const invite of newInvites) {
          try {
            await MeetingEmailService.queueInvite({
              to: invite.email,
              meeting,
              inviteToken: invite.inviteToken,
              hostEmail: creator?.email || req.user.email,
            });
          } catch (error) {
            console.error('Failed to queue invite email:', error);
          }
        }
      } catch (emailError) {
        console.warn('[Meetings] Failed to send invite emails:', emailError);
      }
    }

    try {
      await invalidateCalendarCache(req.user.userId);
    } catch (cacheError) {
      console.warn(
        '[Meetings] Failed to invalidate calendar cache:',
        cacheError
      );
    }

    try {
      const creator = await (models.User as any).findById(meeting.createdBy)
        .select('name')
        .lean();

      const participantEmails = meeting.invites.map((inv: any) => inv.email);

      if (timeChanged) {
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
    }

    return ResponseHelpers.ok(res, meeting, 'Meeting updated successfully');
  }

  /**
   * DELETE /meetings/:meetingId - Delete meeting
   */
  async deleteMeeting(req: AuthenticatedRequest, res: Response) {
    const meeting = await models.Meeting.findOne({
      meetingId: req.params.meetingId,
    });

    if (!meeting) {
      throw AppError.notFound('Meeting');
    }

    const canModify = await MeetingAuthorizationService.canModify(
      meeting,
      req.user.userId,
      req.user.organizationId
    );

    if (!canModify) {
      throw AppError.forbidden(
        'Not authorized to delete this meeting. Only meeting creator, organization admins/owners, or team admins/owners can delete meetings.'
      );
    }

    if (meeting.isRecurring) {
      try {
        await cancelRecurrenceSeries(
          meeting,
          models,
          'Recurring series deleted'
        );

        await cancelMeetingReminders(
          meeting.meetingId,
          'Recurring series deleted',
          req.user.userId
        );

        await meeting.deleteOne();
      } catch (recurrenceError) {
        console.error('Failed to cancel recurrence series:', recurrenceError);
        await meeting.deleteOne();
      }
    } else if (meeting.recurrenceId) {
      await cancelMeetingReminders(
        meeting.meetingId,
        'Meeting instance deleted',
        req.user.userId
      );
      await meeting.deleteOne();
    } else {
      await cancelMeetingReminders(
        meeting.meetingId,
        'Meeting deleted',
        req.user.userId
      );
      await meeting.deleteOne();
    }

    try {
      await invalidateCalendarCache(req.user.userId);
    } catch (cacheError) {
      console.warn(
        '[Meetings] Failed to invalidate calendar cache:',
        cacheError
      );
    }

    return ResponseHelpers.ok(res, null, 'Meeting deleted successfully');
  }

  /**
   * POST /meetings/:meetingId/validate-token - Validate invite token
   */
  async validateToken(req: AuthenticatedRequest, res: Response) {
    const { token } = req.body;
    const meeting = await models.Meeting.findOne({
      meetingId: req.params.meetingId,
    });

    if (!meeting) {
      throw AppError.notFound('Meeting');
    }

    if (meeting.privacy === 'public') {
      return ResponseHelpers.ok(res, { valid: true, meeting });
    }

    if (!token) {
      throw AppError.unauthorized('Invite token required for private meeting');
    }

    if (meeting.createdBy === req.user.userId) {
      return ResponseHelpers.ok(res, { valid: true, meeting });
    }

    const validInvite = meeting.invites.find(
      (invite: any) => invite.inviteToken === token
    );
    if (!validInvite) {
      throw AppError.forbidden('Invalid or expired invite token');
    }

    if (validInvite.status === 'pending') {
      validInvite.status = 'accepted';
      await meeting.save();
    }

    return ResponseHelpers.ok(res, { valid: true, meeting });
  }

  /**
   * POST /meetings/:meetingId/start - Start meeting
   */
  async startMeeting(req: AuthenticatedRequest, res: Response) {
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
      const conflictError: any = AppError.conflict('Meeting already started');
      conflictError.roomId = meeting.roomId;
      throw conflictError;
    }

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
  async completeMeeting(req: AuthenticatedRequest, res: Response) {
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
