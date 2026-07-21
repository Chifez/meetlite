import { getEmailTemplate } from './email-wrapper.js';

export interface PlanUpgradeData {
  userName: string;
  planType: string;
  endDate?: string | Date | null;
  amountPaid?: string;
  paymentMethod?: string;
  nextBillingDate?: string;
  invoiceNumber?: string;
  unlockedFeatures?: Array<{ title: string; description: string }>;
}

export const getPlanUpgradeEmailTemplate = (data: PlanUpgradeData) => {
  const {
    userName,
    planType,
    amountPaid,
    paymentMethod,
    nextBillingDate,
    invoiceNumber,
    unlockedFeatures,
  } = data;

  const contentStyles = `
    <style>
      .upgrade-title {
        color: #3D5A80;
        margin: 0 0 16px 0;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: -0.01em;
      }
      .upgrade-text {
        color: #1A1A1A;
        margin: 0 0 20px 0;
        font-size: 15px;
        line-height: 1.6;
      }
    </style>
  `;

  const capitalizedPlan = planType ? planType.charAt(0).toUpperCase() + planType.slice(1) : 'Premium';

  const defaultFeatures = [
    { title: 'Unlimited Meeting Duration', description: 'Host calls without the 45-minute limit.' },
    { title: 'Custom Branding', description: 'Add your company logo to waiting rooms.' },
    { title: 'Cloud Recording', description: 'Save and share your meetings seamlessly.' }
  ];

  const featuresToDisplay = unlockedFeatures && unlockedFeatures.length > 0 ? unlockedFeatures : defaultFeatures;

  const content = `
    ${contentStyles}
    <h3 class="upgrade-title">Hi ${userName || 'there'}!</h3>
    <p class="upgrade-text">
      Great news! Your MeetLite plan has been successfully upgraded to <strong>${capitalizedPlan}</strong>.
    </p>
    
    <!-- Receipt & Plan Details Card -->
    <div class="card">
      <div class="card-header">Receipt & Plan Details</div>
      <table class="receipt-table">
        <tr class="receipt-row">
          <td class="receipt-label">Plan</td>
          <td class="receipt-value">${capitalizedPlan}</td>
        </tr>
        <tr class="receipt-row">
          <td class="receipt-label">Status</td>
          <td class="receipt-value" style="color: #2E7D32;">● Active</td>
        </tr>
        ${amountPaid ? `
        <tr class="receipt-row">
          <td class="receipt-label">Amount Paid</td>
          <td class="receipt-value">${amountPaid}</td>
        </tr>
        ` : ''}
        ${paymentMethod ? `
        <tr class="receipt-row">
          <td class="receipt-label">Payment Method</td>
          <td class="receipt-value">${paymentMethod}</td>
        </tr>
        ` : ''}
        ${nextBillingDate ? `
        <tr class="receipt-row">
          <td class="receipt-label">Next Billing Date</td>
          <td class="receipt-value">${nextBillingDate}</td>
        </tr>
        ` : ''}
        ${invoiceNumber ? `
        <tr class="receipt-row">
          <td class="receipt-label">Invoice Number</td>
          <td class="receipt-value">${invoiceNumber}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    <!-- Unlocked Features Card -->
    <div class="card">
      <div class="card-header">Your Newly Unlocked Features</div>
      <ul class="feature-list">
        ${featuresToDisplay.map(f => `
          <li class="feature-item">
            <div style="display: flex;">
              <div style="color: #3D5A80; margin-right: 12px; font-weight: bold;">✓</div>
              <div>
                <div class="feature-title">${f.title}</div>
                <div class="feature-desc">${f.description}</div>
              </div>
            </div>
          </li>
        `).join('')}
      </ul>
    </div>
    
    <div style="text-align: center; margin-top: 32px;">
      <a href="${process.env.CLIENT_URL || 'https://minimeet.com'}/dashboard" class="btn-primary">
        Go to Dashboard
      </a>
    </div>
    
    <!-- Need Assistance Section -->
    <div class="assistance-section">
      <div class="assistance-title">Need Assistance?</div>
      <div class="assistance-text">
        Our support team is here to help you get the most out of your new features.
      </div>
      <div class="assistance-links">
        <a href="${process.env.CLIENT_URL || 'https://minimeet.com'}/help">Help Center</a>
        <a href="${process.env.CLIENT_URL || 'https://minimeet.com'}/contact">Contact Us</a>
      </div>
    </div>
  `;

  return {
    subject: `Plan Upgraded to ${capitalizedPlan}`,
    html: getEmailTemplate({
      title: 'Plan Upgraded!',
      subtitle: 'Welcome to premium features',
      content,
      logoHeight: 24,
      pageTitle: 'Plan Upgraded - MeetLite',
    }),
  };
};
