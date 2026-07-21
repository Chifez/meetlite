import { getEmailTemplate } from './email-wrapper.js';

export interface PlanCancellationData {
  userName: string;
  planType: string;
  endDate?: string | Date | null;
  lostFeatures?: Array<{ title: string; description: string }>;
}

export const getPlanCancellationEmailTemplate = (data: PlanCancellationData) => {
  const { userName, planType, endDate, lostFeatures } = data;
  const capitalizedPlan = planType ? planType.charAt(0).toUpperCase() + planType.slice(1) : 'Premium';

  const defaultLostFeatures = [
    { title: 'Unlimited Meeting Duration', description: 'Your meetings will be capped at 45 minutes.' },
    { title: 'Custom Branding', description: 'You will no longer be able to use custom logos.' },
    { title: 'Cloud Recording', description: 'Cloud recordings will be disabled.' }
  ];

  const featuresToDisplay = lostFeatures && lostFeatures.length > 0 ? lostFeatures : defaultLostFeatures;

  const contentStyles = `
    <style>
      .cancellation-title {
        color: #3D5A80;
        margin: 0 0 16px 0;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: -0.01em;
      }
      .cancellation-text {
        color: #1A1A1A;
        margin: 0 0 20px 0;
        font-size: 15px;
        line-height: 1.6;
      }
    </style>
  `;

  const content = `
    ${contentStyles}
    <h3 class="cancellation-title">Hi ${userName || 'there'}!</h3>
    <p class="cancellation-text">
      Your <strong>${capitalizedPlan}</strong> plan has been successfully cancelled.
    </p>
    
    <!-- Cancellation Details Card -->
    <div class="card">
      <div class="card-header">Cancellation Details</div>
      <table class="receipt-table">
        <tr class="receipt-row">
          <td class="receipt-label">Cancelled Plan</td>
          <td class="receipt-value">${capitalizedPlan}</td>
        </tr>
        <tr class="receipt-row">
          <td class="receipt-label">Access Until</td>
          <td class="receipt-value">${endDate ? new Date(endDate).toLocaleDateString() : 'N/A'}</td>
        </tr>
        <tr class="receipt-row">
          <td class="receipt-label">Status</td>
          <td class="receipt-value" style="color: #C1502E;">Cancelled</td>
        </tr>
      </table>
    </div>
    
    <p class="cancellation-text">
      You'll continue to have access to premium features until ${endDate ? new Date(endDate).toLocaleDateString() : 'N/A'}. 
      After that, you'll be moved to our Free plan.
    </p>
    
    <!-- Lost Features Card -->
    <div class="card">
      <div class="card-header">Features you'll lose access to</div>
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
    
    <!-- Warning Box -->
    <div class="card" style="background: #F8F9FA; padding: 16px; margin: 24px 0; border: 1px solid #E4E1D8; text-align: center;">
      <p style="color: #1A1A1A; margin: 0; font-size: 14px;">
        <strong>Tip:</strong> You can reactivate your plan anytime before the end date to continue enjoying premium features.
      </p>
    </div>
    
    <div style="text-align: center; margin-top: 32px;">
      <a href="${process.env.CLIENT_URL || 'https://minimeet.com'}/settings" class="btn-primary">
        Manage Subscription
      </a>
    </div>
    
    <!-- Need Assistance Section -->
    <div class="assistance-section">
      <div class="assistance-title">Need Assistance?</div>
      <div class="assistance-text">
        We're sorry to see you go! If you change your mind or need help, we're here.
      </div>
      <div class="assistance-links">
        <a href="${process.env.CLIENT_URL || 'https://minimeet.com'}/help">Help Center</a>
        <a href="${process.env.CLIENT_URL || 'https://minimeet.com'}/contact">Contact Support</a>
      </div>
    </div>
  `;

  return {
    subject: `Plan Cancellation Confirmed`,
    html: getEmailTemplate({
      title: 'Plan Cancelled',
      subtitle: "We're sorry to see you go",
      content,
      logoHeight: 24,
      pageTitle: 'Plan Cancelled - MeetLite',
    }),
  };
};
