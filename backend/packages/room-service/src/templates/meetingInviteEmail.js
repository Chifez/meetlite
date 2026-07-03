import { getEmailTemplate } from './email-wrapper.js';

export const getMeetingInviteEmailTemplate = ({
  meeting,
  joinUrl,
  hostEmail,
}) => {
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

  // Content-specific styles
  const contentStyles = `
    <style>
      .meeting-title {
        color: #7c3aed;
        margin: 0 0 8px 0;
        font-size: 1.1rem;
        font-weight: 600;
        word-wrap: break-word;
      }
      .meeting-description {
        color: #555;
        margin: 0 0 16px 0;
        font-size: 0.9rem;
        line-height: 1.4;
        word-wrap: break-word;
      }
      .details-padding {
        background: #f8f7ff;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
        border-left: 4px solid #7c3aed;
      }
      .detail-item {
        margin-bottom: 8px;
        display: flex;
        align-items: center;
      }
      .detail-label {
        font-weight: 600;
        color: #374151;
        min-width: 80px;
        font-size: 0.9rem;
      }
      .detail-value {
        color: #7c3aed;
        margin-left: 12px;
        font-size: 0.9rem;
        flex: 1;
      }
      .join-button {
        display: inline-block;
        background: #7c3aed;
        color: #fff;
        font-weight: 600;
        padding: 12px 24px;
        border-radius: 8px;
        text-decoration: none;
        font-size: 0.95rem;
        box-shadow: 0 4px 12px rgba(124,58,237,0.3);
        transition: all 0.2s;
        min-width: 120px;
        text-align: center;
      }
      .join-button:hover {
        background: #6d28d9;
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(124,58,237,0.4);
      }
      .footer-note {
        color: #888;
        font-size: 0.8rem;
        margin-top: 16px;
        line-height: 1.4;
        text-align: center;
        word-wrap: break-word;
      }
      @media only screen and (max-width: 480px) {
        .details-padding {
          padding: 12px;
          margin-bottom: 16px;
        }
        .join-button {
          padding: 10px 20px;
          font-size: 0.9rem;
        }
        .detail-item {
          margin-bottom: 6px;
        }
        .detail-label {
          font-size: 0.85rem;
        }
        .detail-value {
          font-size: 0.85rem;
        }
      }
    </style>
  `;

  // Content HTML
  const content = `
    ${contentStyles}
    <h3 class="meeting-title">${meeting.title}</h3>
    <p class="meeting-description">${
      meeting.description || 'No description provided.'
    }</p>
    <div class="details-padding">
      <div class="detail-item">
        <span class="detail-label">📅 Date:</span>
        <span class="detail-value">${dateString}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">⏰ Time:</span>
        <span class="detail-value">${timeString} (UTC)</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">⏱️ Duration:</span>
        <span class="detail-value">${meeting.duration} minutes</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">👤 Host:</span>
        <span class="detail-value">${hostEmail || meeting.createdBy}</span>
      </div>
    </div>
    <div style="text-align: center;">
      <a href="${joinUrl}" class="join-button">Join Meeting</a>
    </div>
    <p class="footer-note">
      This link will be active when the host starts the meeting.<br/>
      If you have questions, reply to this email.
    </p>
  `;

  return {
    subject: `You're Invited: ${meeting.title}`,
    html: getEmailTemplate({
      title: "You're Invited!",
      subtitle: 'Join a meeting on MeetLite',
      content,
      logoHeight: 100,
      pageTitle: 'Meeting Invitation',
    }),
  };
};

export default getMeetingInviteEmailTemplate;
