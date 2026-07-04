import { EmailQueue } from '@minimeet/shared';

export interface InviteParams {
  to: string;
  meeting: any;
  inviteToken: string;
  hostEmail: string;
}

export class MeetingEmailService {
  /**
   * Queue invite email
   */
  static async queueInvite(params: InviteParams): Promise<void> {
    const emailQueue = new EmailQueue();
    const joinUrl = `${process.env.CLIENT_URL}/meeting/${params.meeting.meetingId}/join?token=${params.inviteToken}`;

    await emailQueue.addEmailJob(
      'meeting_invite',
      {
        userEmail: params.to,
        meetingId: params.meeting.meetingId,
        meetingTitle: params.meeting.title,
        meetingTime: params.meeting.scheduledTime,
        meetingDescription: params.meeting.description,
        duration: params.meeting.duration,
        joinUrl,
        inviteToken: params.inviteToken,
        hostEmail: params.hostEmail,
      },
      {
        priority: 1,
        jobId: `meeting-invite-${params.meeting.meetingId}-${params.to}-${Date.now()}`,
      }
    );
  }
}
export default MeetingEmailService;
