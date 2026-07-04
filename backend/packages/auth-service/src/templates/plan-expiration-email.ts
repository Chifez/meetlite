import { getEmailTemplate } from './email-wrapper.js';

export const getPlanExpirationEmailTemplate = (userName: string, planType: string) => {
  const contentStyles = `
    <style>
      .expiration-title {
        color: #dc2626;
        margin: 0 0 16px 0;
        font-size: 1.2rem;
        font-weight: 600;
      }
      .expiration-text {
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
      .info-box {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
        border-left: 4px solid #7c3aed;
      }
      .info-box h3 {
        color: #333;
        margin-top: 0;
        font-size: 1rem;
        font-weight: 600;
      }
      .info-box ul {
        color: #666;
        padding-left: 20px;
        margin: 0;
      }
      .info-box li {
        margin-bottom: 8px;
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
        .warning-box, .info-box {
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
    <h3 class="expiration-title">Hi ${userName || 'there'}!</h3>
    <p class="expiration-text">
      Your <strong>${
        planType.charAt(0).toUpperCase() + planType.slice(1)
      }</strong> plan has expired.
    </p>
    
    <!-- Warning Box -->
    <div class="warning-box">
      <h3>⚠️ Plan Expired</h3>
      <p>
        Your subscription has ended and you've been automatically moved to our Free plan. You no longer have access to premium features.
      </p>
    </div>
    
    <!-- Info Box -->
    <div class="info-box">
      <h3>What happens now:</h3>
      <ul>
        <li>You've been moved to the Free plan</li>
        <li>Premium features are no longer available</li>
        <li>Your data and account remain intact</li>
        <li>You can upgrade again anytime</li>
      </ul>
    </div>
    
    <p class="expiration-text">
      Want to continue enjoying premium features? Renew your subscription now!
    </p>
    
    <!-- CTA Button -->
    <div style="text-align: center;">
      <a href="${process.env.CLIENT_URL}/settings" class="renew-button">
        Renew Plan
      </a>
    </div>
    
    <p class="footer-note">
      Questions? Contact our support team for assistance.
    </p>
  `;

  return {
    subject: `Your ${planType.charAt(0).toUpperCase() + planType.slice(1)} Plan Has Expired`,
    html: getEmailTemplate({
      title: '📋 Plan Expired',
      subtitle: 'Renew to continue premium features',
      content,
      logoHeight: 100,
      pageTitle: 'Plan Expired - MeetLite',
    }),
  };
};
