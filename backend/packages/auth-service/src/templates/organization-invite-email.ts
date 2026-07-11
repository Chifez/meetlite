import { getEmailTemplate } from './email-wrapper.js';
import { WORKSPACE_ROLES } from '@minimeet/shared';


export const getOrganizationInviteEmailTemplate = (
  organizationName: string,
  inviterName: string,
  inviterEmail: string,
  inviteUrl: string,
  message?: string,
  role = 'member'
) => {
  const roleText = role === WORKSPACE_ROLES.OWNER ? 'as an owner' : 'as a member';

  const contentStyles = `
    <style>
      .invitation-title {
        color: #7c3aed;
        margin: 0 0 16px 0;
        font-size: 1.2rem;
        font-weight: 600;
      }
      .invitation-text {
        color: #555;
        margin: 0 0 20px 0;
        font-size: 0.95rem;
        line-height: 1.5;
      }
      .invitation-card {
        background: #f8f7ff;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
        text-align: center;
        border-left: 4px solid #7c3aed;
      }
      .org-name {
        font-size: 1.3rem;
        font-weight: bold;
        color: #7c3aed;
        margin-bottom: 8px;
      }
      .role-badge {
        display: inline-block;
        background: #dbeafe;
        color: #1e40af;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 500;
        margin-bottom: 12px;
      }
      .inviter-info {
        color: #6b7280;
        font-size: 0.9rem;
      }
      .message-box {
        background: #fffbeb;
        border: 1px solid #fed7aa;
        border-radius: 8px;
        padding: 16px;
        margin: 20px 0;
        font-style: italic;
      }
      .message-text {
        color: #92400e;
        font-size: 0.9rem;
        line-height: 1.4;
        margin: 0;
      }
      .features-list {
        background: #f8f7ff;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
        border-left: 4px solid #7c3aed;
      }
      .feature-item {
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        color: #374151;
        font-size: 0.9rem;
      }
      .feature-icon {
        margin-right: 8px;
        color: #7c3aed;
        font-weight: bold;
      }
      .invite-button {
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
      .invite-button:hover {
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
      }
      @media only screen and (max-width: 480px) {
        .invitation-card {
          padding: 16px;
          margin: 16px 0;
        }
        .features-list {
          padding: 12px;
          margin-bottom: 16px;
        }
        .invite-button {
          padding: 10px 20px;
          font-size: 0.9rem;
        }
      }
    </style>
  `;

  const content = `
    ${contentStyles}
    <h3 class="invitation-title">Welcome to the team! 🎉</h3>
    <p class="invitation-text">
      You've been invited to join <strong>${organizationName}</strong> on MeetLite! You'll be able to participate in team meetings, collaborate on projects, and stay connected with your colleagues.
    </p>
    
    <!-- Invitation Card -->
    <div class="invitation-card">
      <div class="org-name">${organizationName}</div>
      <div class="role-badge">Invited ${roleText}</div>
      <div class="inviter-info">
        Invited by ${inviterName} (${inviterEmail})
      </div>
    </div>

    ${
      message
        ? `
    <!-- Personal Message -->
    <div class="message-box">
      <p class="message-text">
        <strong>Personal message:</strong><br>
        "${message}"
      </p>
    </div>
    `
        : ''
    }
    
    <!-- Features List -->
    <div class="features-list">
      <div class="feature-item">
        <span class="feature-icon">🎥</span>
        <span>Join unlimited team meetings</span>
      </div>
      <div class="feature-item">
        <span class="feature-icon">🤝</span>
        <span>Collaborate with whiteboards and workflows</span>
      </div>
      <div class="feature-item">
        <span class="feature-icon">📅</span>
        <span>Schedule and manage team meetings</span>
      </div>
      <div class="feature-item">
        <span class="feature-icon">🔒</span>
        <span>Access organization-specific features</span>
      </div>
    </div>
    
    <!-- CTA Button -->
    <div style="text-align: center;">
      <a href="${inviteUrl}" class="invite-button">
        Accept Invitation
      </a>
    </div>
    
    <p class="footer-note">
      <strong>What happens next?</strong><br>
      1. Click "Accept Invitation" above<br>
      2. Create your account or sign in<br>
      3. Start collaborating with your team!<br><br>
      This invitation will expire in 7 days. If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${inviteUrl}" style="color: #7c3aed; word-break: break-all;">${inviteUrl}</a>
    </p>
  `;

  return {
    subject: `You're invited to join ${organizationName} on MeetLite! 🎉`,
    html: getEmailTemplate({
      title: "You're Invited!",
      subtitle: `Join ${organizationName} on MeetLite`,
      content,
      logoHeight: 100,
      pageTitle: `Join ${organizationName} on MeetLite`,
    }),
  };
};
