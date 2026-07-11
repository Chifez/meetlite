import { Response } from 'express';
import { nanoid } from 'nanoid';
import { v4 as uuidv4 } from 'uuid';

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
import { prisma } from '@minimeet/shared';
import { WORKSPACE_ROLES } from '@minimeet/shared';


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
    let finalParticipants = [...(participants || [])]; // Array of emails

    if (teamId && req.user.organizationId && autoIncludeTeamMembers !== false) {
      const team = await prisma.team.findFirst({
        where: {
          id: teamId,
          organizationId: req.user.organizationId,
          status: { not: 'deleted' },
        },
        include: { members: { include: { user: { select: { email: true } } } } }
      });

      if (team && team.members) {
        const teamMemberEmails = team.members
          .filter((m: any) => m.status === 'active' && m.user && m.user.email)
          .map((m: any) => m.user.email)
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
      if (!teamId.match(/^[0-9a-fA-F]{24}$|^[0-9a-fA-F-]{36}$/)) {
        throw AppError.validation('Invalid team ID format');
      }

      const team = await prisma.team.findFirst({
        where: {
          id: teamId,
          organizationId: req.user.organizationId,
          status: { not: 'deleted' },
        }
      });

      if (!team) {
        throw AppError.validation(
          'Team not found or does not belong to this organization'
        );
      }

      const userDoc = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: { memberships: true, teamMemberships: true }
      });
      if (!userDoc) {
        throw AppError.notFound('User');
      }

      const orgMembership = userDoc.memberships?.find(
        (m: any) =>
          m.organizationId.toString() === req.user.organizationId!.toString() &&
          m.status === 'active'
      );

      const isOrgOwnerOrAdmin =
        orgMembership &&
        (orgMembership.role === WORKSPACE_ROLES.OWNER || orgMembership.role === WORKSPACE_ROLES.ADMIN);

      const isTeamMember = userDoc.teamMemberships?.some(
        (m: any) =>
          m.teamId.toString() === teamId.toString() &&
          m.organizationId.toString() === req.user.organizationId!.toString() &&
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

    const participantsUsers = await prisma.user.findMany({
      where: { email: { in: finalParticipants } }
    });

    const meeting = await prisma.meeting.create({
      data: {
        meetingId,
        title,
        description,
        scheduledTime: new Date(scheduledTime),
        duration,
        createdBy: req.user.userId,
        organizationId: req.user.organizationId || null,
        teamId: teamId || null,
        privacy: privacy || 'public',
        isRecurring,
        recurrenceEndDate: recurrenceData?.endDate,
        recurrenceRrule: recurrenceData?.rrule,
        invites: {
          create: invites.map((inv: any) => ({
            email: inv.email,
            status: inv.status,
            inviteToken: inv.inviteToken,
          }))
        },
        participants: {
          create: participantsUsers.map(u => ({
            userId: u.id,
          }))
        }
      },
      include: {
        invites: true,
        participants: true
      }
    });

    if (req.user.organizationId) {
      try {
        await (prisma as any).activity.create({
          data: {
            action: 'MEETING_SCHEDULED',
            userId: req.user.userId,
            organizationId: req.user.organizationId,
            metadata: {
              meetingId: meeting.meetingId,
              title: meeting.title,
              scheduledTime: meeting.scheduledTime
            }
          }
        });
      } catch (err) {
        console.error('[Activity] Failed to log MEETING_SCHEDULED', err);
      }
    }

    if (isRecurring && recurrenceData) {
      try {
        const now = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30); // 30 days ahead

        await createRecurrenceInstances(
          meeting,
          prisma,
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
      const creator = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { name: true }
      });

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

    const nativeMeetings = await prisma.meeting.findMany({
      where: {
        ...orgFilter,
        ...teamFilter,
        OR: [
          { createdBy: userId },
          { participants: { some: { userId } } },
          { invites: { some: { email: req.user.email } } },
        ],
      },
      include: {
        invites: true,
        participants: true,
      },
      orderBy: { scheduledTime: 'asc' },
    });

    const instanceRecurrenceIds = new Set<string>();
    nativeMeetings.forEach((meeting: any) => {
      if (meeting.recurrenceId) {
        instanceRecurrenceIds.add(meeting.recurrenceId.toString());
      }
    });

    if (instanceRecurrenceIds.size > 0) {
      const parentMeetings = await prisma.meeting.findMany({
        where: {
          id: { in: Array.from(instanceRecurrenceIds) },
          ...orgFilter,
          ...teamFilter,
        },
        include: {
          invites: true,
          participants: true,
        }
      });

      const existingMeetingIds = new Set(
        nativeMeetings.map((m: any) => m.id.toString())
      );
      parentMeetings.forEach((parent: any) => {
        if (!existingMeetingIds.has(parent.id.toString())) {
          nativeMeetings.push(parent);
        }
      });
    }

    const userDoc = await prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: true }
    });

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
              req.user.organizationId!.toString() && m.status === 'active'
        );
        const isOrgOwnerOrAdmin =
          orgMembership &&
          (orgMembership.role === WORKSPACE_ROLES.OWNER || orgMembership.role === WORKSPACE_ROLES.ADMIN);

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
    const meeting = await prisma.meeting.findUnique({
      where: { meetingId: req.params.meetingId as string },
      include: {
        participants: true,
        invites: true
      }
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
    const meeting = await prisma.meeting.findUnique({
      where: { meetingId: req.params.meetingId as string },
      include: {
        participants: true,
        invites: true
      }
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

      // In Prisma, we will handle deletions and creations separately.
      newInvites = addedEmails
        .filter((e) => typeof e === 'string' && e.trim().length > 3)
        .map((email) => ({
          email,
          status: 'pending',
          inviteToken: uuidv4(),
        }));

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

    const updateData: any = {};
    Object.keys(updates).forEach((key) => {
      if (key !== 'inviteEmails' && key !== 'participants') {
        updateData[key] = updates[key];
      }
    });

    if (updates.scheduledTime) {
      updateData.scheduledTime = new Date(updates.scheduledTime);
    }

    await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        ...updateData,
        invites: {
          deleteMany: removedEmails.length > 0 ? { email: { in: removedEmails } } : undefined,
          create: newInvites.length > 0 ? newInvites : undefined
        }
      }
    });

    if (newInvites.length > 0) {
      try {
        const creator = await prisma.user.findUnique({
          where: { id: meeting.createdBy },
          select: { email: true, name: true }
        });

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
      const creator = await prisma.user.findUnique({
        where: { id: meeting.createdBy },
        select: { name: true }
      });

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
    const meeting = await prisma.meeting.findUnique({
      where: { meetingId: req.params.meetingId as string },
      include: { invites: true }
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
          prisma,
          'Recurring series deleted'
        );

        await cancelMeetingReminders(
          meeting.meetingId,
          'Recurring series deleted',
          req.user.userId
        );

        await prisma.meeting.delete({ where: { id: meeting.id } });
      } catch (recurrenceError) {
        console.error('Failed to cancel recurrence series:', recurrenceError);
        await prisma.meeting.delete({ where: { id: meeting.id } });
      }
    } else if (meeting.parentRecurrenceId) {
      await cancelMeetingReminders(
        meeting.meetingId,
        'Meeting instance deleted',
        req.user.userId
      );
      await prisma.meeting.delete({ where: { id: meeting.id } });
    } else {
      await cancelMeetingReminders(
        meeting.meetingId,
        'Meeting deleted',
        req.user.userId
      );
      await prisma.meeting.delete({ where: { id: meeting.id } });
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
    const meeting = await prisma.meeting.findUnique({
      where: { meetingId: req.params.meetingId as string },
      include: { invites: true }
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
      await prisma.meetingInvite.update({
        where: { id: validInvite.id },
        data: { status: 'accepted' }
      });
    }

    return ResponseHelpers.ok(res, { valid: true, meeting });
  }

  /**
   * POST /meetings/:meetingId/start - Start meeting
   */
  async startMeeting(req: AuthenticatedRequest, res: Response) {
    const meeting = await prisma.meeting.findUnique({
      where: { meetingId: req.params.meetingId as string }
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
    const room = await prisma.room.create({
      data: {
        roomId,
        createdBy: req.user.userId,
        organizationId: meeting.organizationId,
        teamId: meeting.teamId || null,
      }
    });

    await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        roomId,
        status: 'ongoing'
      }
    });

    return ResponseHelpers.ok(res, { roomId }, 'Meeting started successfully');
  }

  /**
   * POST /meetings/:meetingId/complete - Complete meeting
   */
  async completeMeeting(req: AuthenticatedRequest, res: Response) {
    const meeting = await prisma.meeting.findUnique({
      where: { meetingId: req.params.meetingId as string }
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

    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: 'completed' }
    });

    return ResponseHelpers.ok(res, null, 'Meeting completed successfully');
  }
}

export default MeetingController;
