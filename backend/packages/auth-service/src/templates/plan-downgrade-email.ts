import { getEmailTemplate } from './email-wrapper.js';

export const getPlanDowngradeEmailTemplate = (
  userName: string,
  previousPlanType: string,
  newPlanType = 'free'
) => {
  const contentStyles = `
    <style>
      .downgrade-title {
        color: #7c3aed;
        margin: 0 0 16px 0;
        font-size: 1.2rem;
        font-weight: 600;
      }
      .downgrade-text {
        color: #555;
        margin: 0 0 20px 0;
        font-size: 0.95rem;
        line-height: 1.5;
      }
      .downgrade-details {
        background: #fff;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
        border-left: 4px solid #f59e0b;
      }
      .downgrade-details h3 {
        color: #333;
        margin-top: 0;
        font-size: 1rem;
        font-weight: 600;
      }
      .downgrade-details ul {
        color: #666;
        padding-left: 20px;
        margin: 0;
      }
      .downgrade-details li {
        margin-bottom: 8px;
        font-size: 0.9rem;
      }
      .features-lost {
        background: #fef2f2;
        padding: 15px;
        border-radius: 8px;
        margin: 20px 0;
        border-left: 4px solid #ef4444;
      }
      .features-lost h4 {
        color: #dc2626;
        margin: 0 0 10px 0;
        font-size: 0.95rem;
        font-weight: 600;
      }
      .features-lost ul {
        color: #7f1d1d;
        padding-left: 20px;
        margin: 0;
      }
      .features-lost li {
        margin-bottom: 6px;
        font-size: 0.85rem;
      }
      .upgrade-button {
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
      .upgrade-button:hover {
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
        .downgrade-details {
          padding: 16px;
          margin: 16px 0;
        }
        .features-lost {
          padding: 12px;
          margin: 16px 0;
        }
        .upgrade-button {
          padding: 10px 20px;
          font-size: 0.9rem;
        }
      }
    </style>
  `;

  const formatPlanName = (planType: string) => {
    return planType.charAt(0).toUpperCase() + planType.slice(1);
  };

  const content = `
    ${contentStyles}
    <h3 class="downgrade-title">Hi ${userName || 'there'}!</h3>
    <p class="downgrade-text">
      Your subscription has ended and your account has been downgraded from 
      <strong>${formatPlanName(previousPlanType)}</strong> to 
      <strong>${formatPlanName(newPlanType)}</strong>.
    </p>
    
    <!-- Downgrade Details -->
    <div class="downgrade-details">
      <h3>Account Status:</h3>
      <ul>
        <li><strong>Previous Plan:</strong> ${formatPlanName(previousPlanType)}</li>
        <li><strong>Current Plan:</strong> ${formatPlanName(newPlanType)}</li>
        <li><strong>Effective:</strong> Immediately</li>
      </ul>
    </div>
    
    <!-- Features Lost Section -->
    <div class="features-lost">
      <h4>Features no longer available:</h4>
      <ul>
        <li>Extended meeting duration</li>
        <li>Advanced recording & transcripts</li>
        <li>Priority support</li>
        <li>Advanced analytics</li>
        <li>Custom branding options</li>
      </ul>
    </div>
    
    <p class="downgrade-text">
      You can continue using MeetLite with the Free plan features. 
      If you'd like to regain access to premium features, you can upgrade anytime.
    </p>
    
    <!-- CTA Button -->
    <div style="text-align: center;">
      <a href="${process.env.CLIENT_URL}/settings" class="upgrade-button">
        Upgrade Your Plan
      </a>
    </div>
    
    <p class="footer-note">
      Need help? Contact our support team anytime.
    </p>
  `;

  return {
    subject: `Your MeetLite Account Has Been Downgraded`,
    html: getEmailTemplate({
      title: '📉 Plan Downgraded',
      subtitle: 'Your subscription has ended',
      content,
      logoHeight: 100,
      pageTitle: 'Plan Downgraded - MeetLite',
    }),
  };
};
