import { getEmailTemplate } from './email-wrapper.js';

export interface MeetingInviteEmailOptions {
  meeting: {
    title: string;
    description?: string;
    scheduledTime: Date | string;
    duration: number;
    createdBy: string;
  };
  joinUrl: string;
  hostEmail?: string;
}

export const getMeetingInviteEmailTemplate = ({
  meeting,
  joinUrl,
  hostEmail,
}: MeetingInviteEmailOptions) => {
  const meetingDate = new Date(meeting.scheduledTime);
  const timeString = meetingDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const dateString = meetingDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const content = `
    <div style="font-size: 16px; color: #1A1A1A; margin-bottom: 16px;">
        Hi there,
    </div>
    <p style="color: #4A4A4A; line-height: 1.6; margin-bottom: 24px; font-size: 16px;">
        You've been invited by <strong>${hostEmail || meeting.createdBy}</strong> to join an upcoming meeting on MeetLite. Please review the details below so you can come prepared.
    </p>
    
    <!-- Meeting Details Card -->
    <div class="card">
      <div class="card-header">Meeting Details</div>
      <div style="font-size: 20px; font-weight: 700; color: #1A1A1A; margin-bottom: 16px; letter-spacing: -0.02em;">
        ${meeting.title}
      </div>
      ${meeting.description ? `<p style="margin: 0 0 20px 0; color: #4A4A4A; font-size: 15px; line-height: 1.6;">${meeting.description}</p>` : ''}
      
      <table class="receipt-table">
        <tr class="receipt-row">
          <td class="receipt-label">Date</td>
          <td class="receipt-value">${dateString}</td>
        </tr>
        <tr class="receipt-row">
          <td class="receipt-label">Time</td>
          <td class="receipt-value">${timeString} (UTC)</td>
        </tr>
        <tr class="receipt-row">
          <td class="receipt-label">Duration</td>
          <td class="receipt-value">${meeting.duration} minutes</td>
        </tr>
        <tr class="receipt-row">
          <td class="receipt-label">Host</td>
          <td class="receipt-value">${hostEmail || meeting.createdBy}</td>
        </tr>
      </table>
    </div>

    <!-- Preparation List -->
    <div class="card">
      <div class="card-header">How to prepare</div>
      <ul class="feature-list">
        <li class="feature-item">
          <div style="display: flex;">
            <div style="color: #3D5A80; margin-right: 12px; font-weight: bold;">✓</div>
            <div class="feature-content">Find a quiet space with a stable internet connection</div>
          </div>
        </li>
        <li class="feature-item">
          <div style="display: flex;">
            <div style="color: #3D5A80; margin-right: 12px; font-weight: bold;">✓</div>
            <div class="feature-content">Test your microphone and camera before joining</div>
          </div>
        </li>
        <li class="feature-item" style="margin-bottom: 0;">
          <div style="display: flex;">
            <div style="color: #3D5A80; margin-right: 12px; font-weight: bold;">✓</div>
            <div class="feature-content">Review any materials provided by the host</div>
          </div>
        </li>
      </ul>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin-top: 32px; margin-bottom: 32px;">
      <a href="${joinUrl}" class="btn-primary">
        Join Meeting
      </a>
    </div>

    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #E4E1D8; color: #6B6B63; font-size: 13px; line-height: 1.5;">
      This link will be active when the host starts the meeting.<br/>
      If you have questions, reply to this email to reach the host.
    </div>
  `;

  return {
    subject: `You're Invited: ${meeting.title}`,
    html: getEmailTemplate({
      title: "You're Invited!",
      subtitle: 'Join a meeting on MeetLite',
      content,
      logoHeight: 24,
      pageTitle: 'Meeting Invitation',
    }),
  };
};

export default getMeetingInviteEmailTemplate;
