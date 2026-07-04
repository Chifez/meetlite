/**
 * Template Adapters
 *
 * Helper functions to adapt existing template functions to work with EmailWorker
 * Existing templates return {subject, html}, EmailWorker expects {subject, html, text}
 */

export interface AdaptedEmailResult {
  subject: string;
  html: string;
  text: string;
}

/**
 * Adapt a template function to work with EmailWorker
 * Adds text field if missing
 *
 * @param templateFn - Original template function
 * @returns Adapted template function
 */
export function adaptTemplate(templateFn: (...args: any[]) => { subject: string; html: string; text?: string }) {
  return (...args: any[]): AdaptedEmailResult => {
    const result = templateFn(...args);

    if (result && result.text) {
      return result as AdaptedEmailResult;
    }

    return {
      ...result,
      text: result.html ? result.html.replace(/<[^>]*>/g, '') : '',
    };
  };
}

/**
 * Create template adapter for welcome email
 */
export function adaptWelcomeTemplate(originalTemplate: any) {
  return (data: any): AdaptedEmailResult => {
    const userName = data.user?.name || data.userName || '';
    return adaptTemplate(originalTemplate)(userName);
  };
}

/**
 * Create template adapter for password reset email
 */
export function adaptPasswordResetTemplate(originalTemplate: any) {
  return (data: any): AdaptedEmailResult => {
    const userEmail = data.userEmail || data.user?.email;
    const resetToken = data.resetToken || data.token;
    const userName = data.user?.name || data.userName || '';
    return adaptTemplate(originalTemplate)(userEmail, resetToken, userName);
  };
}

/**
 * Create template adapter for organization invite email
 */
export function adaptOrganizationInviteTemplate(originalTemplate: any) {
  return (data: any): AdaptedEmailResult => {
    return adaptTemplate(originalTemplate)({
      email: data.userEmail || data.user?.email,
      organizationName: data.organizationName,
      inviterName: data.inviterName,
      inviterEmail: data.inviterEmail,
      inviteToken: data.inviteToken || data.token,
      message: data.message || '',
      role: data.role || 'member',
    });
  };
}

/**
 * Create template adapter for team invite email
 */
export function adaptTeamInviteTemplate(originalTemplate: any) {
  return (data: any): AdaptedEmailResult => {
    const inviteUrl =
      data.inviteUrl ||
      `${process.env.CLIENT_URL}/invite/${data.inviteToken || data.token}`;
    return adaptTemplate(originalTemplate)({
      email: data.userEmail || data.user?.email,
      teamName: data.teamName,
      organizationName: data.organizationName,
      inviterName: data.inviterName,
      inviterEmail: data.inviterEmail,
      inviteUrl,
      message: data.message || '',
      role: data.role || 'member',
    });
  };
}

/**
 * Create template adapter for meeting invite email
 */
export function adaptMeetingInviteTemplate(originalTemplate: any) {
  return (data: any): AdaptedEmailResult => {
    const joinUrl =
      data.joinUrl ||
      `${process.env.CLIENT_URL}/meeting/${data.meetingId}/join?token=${
        data.inviteToken || data.token
      }`;
    return adaptTemplate(originalTemplate)({
      meeting: data.meeting || {
        meetingId: data.meetingId,
        title: data.meetingTitle,
        scheduledTime: data.meetingTime,
        duration: data.duration,
        description: data.meetingDescription,
      },
      joinUrl,
      hostEmail: data.hostEmail,
    });
  };
}

/**
 * Create template adapter for meeting reminder email
 */
export function adaptMeetingReminderTemplate(htmlTemplate: any, textTemplate: any) {
  return (data: any): AdaptedEmailResult => {
    const htmlContent = htmlTemplate({
      recipientName: data.userName || data.user?.name || '',
      meetingTitle: data.meetingTitle,
      meetingDescription: data.meetingDescription,
      meetingDate: data.meetingTime,
      meetingTime: new Date(data.meetingTime).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      duration: data.duration,
      timezone: data.timezone || 'UTC',
      joinUrl: data.joinUrl,
      organizerName: data.organizerName || '',
      logoUrl: process.env.LOGO_URL,
    });

    const textContent = textTemplate({
      recipientName: data.userName || data.user?.name || '',
      meetingTitle: data.meetingTitle,
      meetingDescription: data.meetingDescription,
      meetingDate: data.meetingTime,
      meetingTime: new Date(data.meetingTime).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      duration: data.duration,
      timezone: data.timezone || 'UTC',
      joinUrl: data.joinUrl,
      organizerName: data.organizerName || '',
    });

    return {
      subject: `Meeting Reminder: ${data.meetingTitle}`,
      html: htmlContent,
      text: textContent,
    };
  };
}

/**
 * Create template adapter for plan upgrade/cancellation emails
 */
export function adaptPlanEmailTemplate(originalTemplate: any) {
  return (data: any): AdaptedEmailResult => {
    const userEmail = data.userEmail || data.user?.email;
    const userName = data.user?.name || data.userName || '';
    const planType = data.planType;
    const endDate = data.endDate;
    return adaptTemplate(originalTemplate)(
      userEmail,
      userName,
      planType,
      endDate
    );
  };
}

/**
 * Create template adapter for plan expiration warning email
 */
export function adaptPlanExpirationWarningTemplate(originalTemplate: any) {
  return (data: any): AdaptedEmailResult => {
    const userName = data.user?.name || data.userName || '';
    const planType = data.planType;
    const daysRemaining = data.daysRemaining;
    return adaptTemplate(originalTemplate)(userName, planType, daysRemaining);
  };
}
