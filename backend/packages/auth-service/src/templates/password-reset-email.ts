import { getEmailTemplate } from './email-wrapper.js';

export interface PasswordResetData {
  resetUrl: string;
  userName: string;
}

export const getPasswordResetEmailTemplate = (data: PasswordResetData) => {
  const { resetUrl, userName } = data;

  const content = `
    <div style="font-size: 16px; color: #1A1A1A; margin-bottom: 16px;">
        Hi ${userName || 'there'},
    </div>
    <p style="color: #4A4A4A; line-height: 1.6; margin-bottom: 24px; font-size: 16px;">
      We received a request to reset your password for your MeetLite account. Click the button below to create a new password.
    </p>
    
    <!-- Warning Card -->
    <div class="card" style="border-top: 4px solid #F57F17; margin-bottom: 24px;">
      <p style="margin: 0; color: #4A4A4A; font-size: 15px; line-height: 1.6;">
        <strong>Security Notice:</strong> This link will expire in 1 hour for your security. If you didn't request this password reset, please ignore this email.
      </p>
    </div>
    
    <!-- CTA Button -->
    <div style="text-align: center; margin-top: 32px;">
      <a href="${resetUrl}" class="btn-primary">
        Reset Password
      </a>
    </div>
    
    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #E4E1D8; color: #6B6B63; font-size: 13px; line-height: 1.5; text-align: center;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="color: #3D5A80; word-break: break-all;">${resetUrl}</a>
    </div>
  `;

  return {
    subject: 'Reset Your MeetLite Password',
    html: getEmailTemplate({
      title: 'Reset Your Password',
      subtitle: 'Secure access to your account',
      content,
      logoHeight: 24,
      pageTitle: 'Reset Your Password',
    }),
  };
};
