import { getEmailTemplate } from './email-wrapper.js';

export const getPasswordResetEmailTemplate = (resetUrl: string, userName: string) => {
  const contentStyles = `
    <style>
      .reset-title {
        color: #7c3aed;
        margin: 0 0 16px 0;
        font-size: 1.2rem;
        font-weight: 600;
      }
      .reset-text {
        color: #555;
        margin: 0 0 20px 0;
        font-size: 0.95rem;
        line-height: 1.5;
      }
      .warning-box {
        background: #fef3c7;
        border: 1px solid #f59e0b;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
      }
      .warning-text {
        color: #92400e;
        font-size: 0.9rem;
        line-height: 1.4;
        margin: 0;
      }
      .reset-button {
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
      .reset-button:hover {
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
        .warning-box {
          padding: 12px;
          margin-bottom: 16px;
        }
        .reset-button {
          padding: 10px 20px;
          font-size: 0.9rem;
        }
      }
    </style>
  `;

  const content = `
    ${contentStyles}
    <h3 class="reset-title">Hi ${userName || 'there'}!</h3>
    <p class="reset-text">
      We received a request to reset your password for your MeetLite account. Click the button below to create a new password.
    </p>
    
    <!-- Warning Box -->
    <div class="warning-box">
      <p class="warning-text">
        <strong>Security Notice:</strong> This link will expire in 1 hour for your security. If you didn't request this password reset, please ignore this email.
      </p>
    </div>
    
    <!-- CTA Button -->
    <div style="text-align: center;">
      <a href="${resetUrl}" class="reset-button">
        Reset Password
      </a>
    </div>
    
    <p class="footer-note">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="color: #7c3aed; word-break: break-all;">${resetUrl}</a>
    </p>
  `;

  return {
    subject: 'Reset Your MeetLite Password',
    html: getEmailTemplate({
      title: 'Reset Your Password',
      subtitle: 'Secure access to your account',
      content,
      logoHeight: 100,
      pageTitle: 'Reset Your Password',
    }),
  };
};
