import { getEmailTemplate } from './email-wrapper.js';

export const getPlanExpirationWarningEmailTemplate = (
  userName: string,
  planType: string,
  daysRemaining: number
) => {
  const contentStyles = `
    <style>
      .warning-title {
        color: #7c3aed;
        margin: 0 0 16px 0;
        font-size: 1.2rem;
        font-weight: 600;
      }
      .warning-text {
        color: #555;
        margin: 0 0 20px 0;
        font-size: 0.95rem;
        line-height: 1.5;
      }
      .warning-box {
        background: #fff3cd;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
        border-left: 4px solid #ffc107;
      }
      .warning-box h3 {
        color: #856404;
        margin-top: 0;
        font-size: 1rem;
        font-weight: 600;
      }
      .warning-box p {
        color: #856404;
        margin: 0;
        font-size: 0.9rem;
      }
      .renew-button {
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
      .renew-button:hover {
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
          padding: 16px;
          margin: 16px 0;
        }
        .renew-button {
          padding: 10px 20px;
          font-size: 0.9rem;
        }
      }
    </style>
  `;

  const content = `
    ${contentStyles}
    <h3 class="warning-title">Hi ${userName || 'there'}!</h3>
    <p class="warning-text">
      Your <strong>${
        planType.charAt(0).toUpperCase() + planType.slice(1)
      }</strong> plan will expire in <strong>${daysRemaining} days</strong>.
    </p>
    
    <!-- Warning Box -->
    <div class="warning-box">
      <h3>⚠️ Important Notice</h3>
      <p>
        After expiration, you'll be automatically moved to our Free plan and lose access to premium features.
      </p>
    </div>
    
    <p class="warning-text">
      To continue enjoying premium features, please renew your subscription before it expires.
    </p>
    
    <!-- CTA Button -->
    <div style="text-align: center;">
      <a href="${process.env.CLIENT_URL}/settings" class="renew-button">
        Renew Now
      </a>
    </div>
    
    <p class="footer-note">
      Questions? Contact our support team for assistance.
    </p>
  `;

  return {
    subject: `Your ${
      planType.charAt(0).toUpperCase() + planType.slice(1)
    } Plan Expires in ${daysRemaining} Days`,
    html: getEmailTemplate({
      title: 'Plan Expiring Soon',
      subtitle: 'Action required to maintain access',
      content,
      logoHeight: 100,
      pageTitle: 'Plan Expiring Soon - MeetLite',
    }),
  };
};
