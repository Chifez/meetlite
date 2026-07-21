import { getEmailTemplate } from './email-wrapper.js';

export interface PlanDowngradeData {
  userName: string;
  previousPlanType: string;
  newPlanType?: string;
  lostFeatures?: Array<{ title: string; description: string }>;
}

export const getPlanDowngradeEmailTemplate = (data: PlanDowngradeData) => {
  const { userName, previousPlanType, newPlanType = 'free', lostFeatures } = data;
  
  const formatPlanName = (planType: string) => {
    return planType ? planType.charAt(0).toUpperCase() + planType.slice(1) : 'Premium';
  };

  const defaultLostFeatures = [
    { title: 'Extended meeting duration', description: 'Meetings are now capped at 45 minutes.' },
    { title: 'Advanced recording & transcripts', description: 'Cloud recordings are disabled.' },
    { title: 'Priority support', description: 'Standard support response times apply.' },
    { title: 'Custom branding options', description: 'Custom logos are removed.' }
  ];

  const featuresToDisplay = lostFeatures && lostFeatures.length > 0 ? lostFeatures : defaultLostFeatures;

  const content = `
    <div style="font-size: 16px; color: #1A1A1A; margin-bottom: 16px;">
        Hi ${userName || 'there'},
    </div>
    <p style="color: #4A4A4A; line-height: 1.6; margin-bottom: 24px; font-size: 16px;">
        Your subscription has ended and your account has been downgraded from 
        <strong>${formatPlanName(previousPlanType)}</strong> to 
        <strong>${formatPlanName(newPlanType)}</strong>.
    </p>
    
    <!-- Downgrade Details Card -->
    <div class="card">
      <div class="card-header">Account Status</div>
      <table class="receipt-table">
        <tr class="receipt-row">
          <td class="receipt-label">Previous Plan</td>
          <td class="receipt-value">${formatPlanName(previousPlanType)}</td>
        </tr>
        <tr class="receipt-row">
          <td class="receipt-label">Current Plan</td>
          <td class="receipt-value">${formatPlanName(newPlanType)}</td>
        </tr>
        <tr class="receipt-row">
          <td class="receipt-label">Effective Date</td>
          <td class="receipt-value">Immediately</td>
        </tr>
      </table>
    </div>
    
    <!-- Features Lost Card -->
    <div class="card">
      <div class="card-header">Features no longer available</div>
      <ul class="feature-list">
        ${featuresToDisplay.map(f => `
          <li class="feature-item">
            <div style="display: flex;">
              <div style="color: #6B6B63; margin-right: 12px; font-weight: bold;">-</div>
              <div class="feature-content">
                <div class="feature-title" style="color: #4A4A4A;">${f.title}</div>
                <div class="feature-desc">${f.description}</div>
              </div>
            </div>
          </li>
        `).join('')}
      </ul>
    </div>
    
    <p style="color: #4A4A4A; line-height: 1.6; margin-top: 16px; margin-bottom: 32px; font-size: 15px;">
      You can continue using MeetLite with the Free plan features. If you'd like to regain access to premium features, you can upgrade anytime.
    </p>
    
    <div style="text-align: center; margin-top: 32px;">
      <a href="${process.env.CLIENT_URL || 'https://minimeet.com'}/settings" class="btn-primary">
        Upgrade Your Plan
      </a>
    </div>
    
    <!-- Need Assistance Section -->
    <div class="assistance-section">
      <div class="assistance-title">Need Assistance?</div>
      <div class="assistance-text">
        If you have any questions about your account changes, our support team is here to help.
      </div>
      <div class="assistance-links">
        <a href="${process.env.CLIENT_URL || 'https://minimeet.com'}/help">Help Center</a>
        <a href="${process.env.CLIENT_URL || 'https://minimeet.com'}/contact">Contact Support</a>
      </div>
    </div>
  `;

  return {
    subject: `Your MeetLite Account Has Been Downgraded`,
    html: getEmailTemplate({
      title: 'Plan Downgraded',
      subtitle: 'Your subscription has ended',
      content,
      logoHeight: 24,
      pageTitle: 'Plan Downgraded - MeetLite',
    }),
  };
};
