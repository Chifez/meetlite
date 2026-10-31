import { PrismaClient } from '@prisma/client';
import { EventDispatcher } from './outbox-publisher.js';
import { OutboxEventRecord } from '../repositories/meeting-repository.types.js';
import { MeetingEmailService } from '../../services/meeting-email.service.js';

export class MeetingOutboxDispatcher implements EventDispatcher {
  constructor(private readonly prisma: PrismaClient) {}

  async dispatch(event: OutboxEventRecord): Promise<void> {
    if (event.eventType !== 'meeting.occurrence.created.v1') return;

    const meetingId = String(event.payload.meetingId || event.aggregateId);
    const meeting = await this.prisma.meeting.findUnique({
      where: { meetingId },
      include: { invites: true, creator: { select: { email: true } } },
    });
    if (!meeting) throw Object.assign(new Error('OUTBOX_MEETING_NOT_FOUND'), { code: 'OUTBOX_MEETING_NOT_FOUND' });

    for (const invite of meeting.invites) {
      await MeetingEmailService.queueInvite({
        to: invite.email,
        inviteToken: invite.inviteToken,
        hostEmail: meeting.creator.email,
        meeting: {
          meetingId: meeting.meetingId,
          title: meeting.title,
          description: meeting.description,
          scheduledTime: meeting.scheduledAt ?? meeting.scheduledTime,
          eventTimeZone: meeting.eventTimeZone ?? 'UTC',
          duration: meeting.durationMinutes ?? meeting.duration,
        },
      });
    }
  }
}
