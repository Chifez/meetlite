import { getEmailTemplate } from './email-wrapper.js';
import { WORKSPACE_ROLES } from '@minimeet/shared';

export interface TeamInviteData {
  teamName: string;
  organizationName: string;
  inviterName: string;
  inviterEmail: string;
  inviteUrl: string;
  message?: string;
  role?: string;
}

export const getTeamInviteEmailTemplate = (data: TeamInviteData) => {
  const {
    teamName,
    organizationName,
    inviterName,
    inviterEmail,
    inviteUrl,
    message,
    role = 'member'
  } = data;
  
  const roleText = role === WORKSPACE_ROLES.OWNER ? 'as an owner' : 'as a member';

  const content = `
    <h3 style="color: #3D5A80; margin: 0 0 16px 0; font-size: 18px; font-weight: 700; letter-spacing: -0.01em;">Welcome to the team!</h3>
    <p style="color: #1A1A1A; margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">
      You've been invited to join <strong>${teamName}</strong> team in <strong>${organizationName}</strong> on MeetLite! You'll be able to participate in team meetings, collaborate on projects, and work together with your team members.
    </p>
    
    <!-- Invitation Card -->
    <div class="card" style="text-align: center;">
      <div style="font-size: 20px; font-weight: 700; color: #3D5A80; margin-bottom: 4px; letter-spacing: -0.01em;">${teamName}</div>
      <div style="font-size: 14px; color: #6B6B63; margin-bottom: 12px;">${organizationName}</div>
      <div style="display: inline-block; background: #E4E1D8; color: #1A1A1A; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 12px;">Invited ${roleText}</div>
      <div style="color: #6B6B63; font-size: 14px;">
        Invited by ${inviterName}${inviterEmail ? ` (${inviterEmail})` : ''}
      </div>
    </div>

    ${message ? `
    <!-- Personal Message -->
    <div class="card" style="font-style: italic; background: #F8F9FA;">
      <p style="color: #1A1A1A; font-size: 14px; line-height: 1.5; margin: 0;">
        <strong>Personal message:</strong><br>
        "${message}"
      </p>
    </div>
    ` : ''}
    
    <!-- Features List -->
    <div class="card">
      <div class="card-header">What you can do</div>
      <ul class="feature-list">
        <li class="feature-item">
          <div style="display: flex;">
            <div style="color: #3D5A80; margin-right: 12px; font-weight: bold;">✓</div>
            <div class="feature-content">Join team meetings and collaborate</div>
          </div>
        </li>
        <li class="feature-item">
          <div style="display: flex;">
            <div style="color: #3D5A80; margin-right: 12px; font-weight: bold;">✓</div>
            <div class="feature-content">Work together on projects and workflows</div>
          </div>
        </li>
        <li class="feature-item">
          <div style="display: flex;">
            <div style="color: #3D5A80; margin-right: 12px; font-weight: bold;">✓</div>
            <div class="feature-content">Schedule and manage team meetings</div>
          </div>
        </li>
        <li class="feature-item" style="margin-bottom: 0;">
          <div style="display: flex;">
            <div style="color: #3D5A80; margin-right: 12px; font-weight: bold;">✓</div>
            <div class="feature-content">Access team-specific features and resources</div>
          </div>
        </li>
      </ul>
    </div>
    
    <!-- CTA Button -->
    <div style="text-align: center; margin-top: 32px;">
      <a href="${inviteUrl}" class="btn-primary">
        Accept Invitation
      </a>
    </div>
    
    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #E4E1D8; color: #6B6B63; font-size: 13px; line-height: 1.5;">
      <strong>What happens next?</strong><br>
      1. Click "Accept Invitation" above<br>
      2. Create your account or sign in if you already have one<br>
      3. Start collaborating with your team!<br><br>
      This invitation will expire in 7 days. If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${inviteUrl}" style="color: #3D5A80; word-break: break-all;">${inviteUrl}</a>
    </div>
  `;

  return {
    subject: `You're invited to join ${teamName} team on ${organizationName}!`,
    html: getEmailTemplate({
      title: "You're Invited!",
      subtitle: `Join ${teamName} on MeetLite`,
      content,
      logoHeight: 24,
      pageTitle: `Join ${teamName} on MeetLite`,
    }),
  };
};
