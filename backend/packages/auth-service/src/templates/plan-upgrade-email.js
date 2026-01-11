import { getEmailTemplate } from './email-wrapper.js';

export const getPlanUpgradeEmailTemplate = (userName, planType, endDate) => {
  // Content-specific styles
  const contentStyles = `
    <style>
      .upgrade-title {
        color: #7c3aed;
        margin: 0 0 16px 0;
        font-size: 1.2rem;
        font-weight: 600;
      }
      .upgrade-text {
        color: #555;
        margin: 0 0 20px 0;
        font-size: 0.95rem;
        line-height: 1.5;
      }
      .plan-details {
        background: #f8f9fa;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
        border-left: 4px solid #7c3aed;
      }
      .plan-details h3 {
        color: #333;
        margin-top: 0;
        font-size: 1rem;
        font-weight: 600;
      }
      .plan-details ul {
        color: #666;
        padding-left: 20px;
        margin: 0;
      }
      .plan-details li {
        margin-bottom: 8px;
        font-size: 0.9rem;
      }
      .dashboard-button {
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
      .dashboard-button:hover {
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
        .plan-details {
          padding: 16px;
          margin: 16px 0;
        }
        .dashboard-button {
          padding: 10px 20px;
          font-size: 0.9rem;
        }
      }
    </style>
  `;

  // Content HTML
  const content = `
    ${contentStyles}
    <h3 class="upgrade-title">Hi ${userName || 'there'}!</h3>
    <p class="upgrade-text">
      Great news! Your MeetLite plan has been successfully upgraded to <strong>${
        planType.charAt(0).toUpperCase() + planType.slice(1)
      }</strong>.
    </p>
    
    <!-- Plan Details -->
    <div class="plan-details">
      <h3>Plan Details:</h3>
      <ul>
        <li><strong>Plan:</strong> ${
          planType.charAt(0).toUpperCase() + planType.slice(1)
        }</li>
        <li><strong>Valid Until:</strong> ${new Date(
          endDate
        ).toLocaleDateString()}</li>
        <li><strong>Status:</strong> Active</li>
      </ul>
    </div>
    
    <p class="upgrade-text">
      You now have access to all premium features. Start exploring your new capabilities!
    </p>
    
    <!-- CTA Button -->
    <div style="text-align: center;">
      <a href="${process.env.CLIENT_URL}/dashboard" class="dashboard-button">
        Go to Dashboard
      </a>
    </div>
    
    <p class="footer-note">
      If you have any questions, feel free to contact our support team.
    </p>
  `;

  return {
    subject: `🎉 Plan Upgraded to ${
      planType.charAt(0).toUpperCase() + planType.slice(1)
    }`,
    html: getEmailTemplate({
      title: '🎉 Plan Upgraded!',
      subtitle: 'Welcome to premium features',
      content,
      logoHeight: 100,
      pageTitle: 'Plan Upgraded - MeetLite',
    }),
  };
};
