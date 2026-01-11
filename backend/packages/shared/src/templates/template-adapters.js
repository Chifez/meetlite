/**
 * Template Adapters
 *
 * Helper functions to adapt existing template functions to work with EmailWorker
 * Existing templates return {subject, html}, EmailWorker expects {subject, html, text}
 */

/**
 * Adapt a template function to work with EmailWorker
 * Adds text field if missing
 *
 * @param {Function} templateFn - Original template function
 * @returns {Function} Adapted template function
 */
export function adaptTemplate(templateFn) {
  return (data) => {
    const result = templateFn(data);

    // If already has text, return as-is
    if (result && result.text) {
      return result;
    }

    // Add text field by stripping HTML
    return {
      ...result,
      text: result.html ? result.html.replace(/<[^>]*>/g, '') : '',
    };
  };
}

/**
 * Create template adapter for welcome email
 * Converts (userName) -> ({user, userEmail, ...})
 */
export function adaptWelcomeTemplate(originalTemplate) {
  return (data) => {
    const userName = data.user?.name || data.userName || '';
    return adaptTemplate(originalTemplate)(userName);
  };
}

/**
 * Create template adapter for password reset email
 * Converts (userEmail, resetToken, userName) -> ({user, userEmail, resetToken, ...})
 */
export function adaptPasswordResetTemplate(originalTemplate) {
  return (data) => {
    const userEmail = data.userEmail || data.user?.email;
    const resetToken = data.resetToken || data.token;
    const userName = data.user?.name || data.userName || '';
    return adaptTemplate(originalTemplate)(userEmail, resetToken, userName);
  };
}

/**
 * Create template adapter for organization invite email
 * Converts object params -> ({user, userEmail, ...})
 */
export function adaptOrganizationInviteTemplate(originalTemplate) {
  return (data) => {
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
export function adaptTeamInviteTemplate(originalTemplate) {
  return (data) => {
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
export function adaptMeetingInviteTemplate(originalTemplate) {
  return (data) => {
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
 * Combines HTML and text templates into single {subject, html, text} object
 */
export function adaptMeetingReminderTemplate(htmlTemplate, textTemplate) {
  return (data) => {
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
export function adaptPlanEmailTemplate(originalTemplate) {
  return (data) => {
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
 * Takes different signature: (userName, planType, daysRemaining)
 */
export function adaptPlanExpirationWarningTemplate(originalTemplate) {
  return (data) => {
    const userName = data.user?.name || data.userName || '';
    const planType = data.planType;
    const daysRemaining = data.daysRemaining;
    return adaptTemplate(originalTemplate)(userName, planType, daysRemaining);
  };
}
