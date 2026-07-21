import { getEmailTemplate } from './email-wrapper.js';

export interface PaymentFailureData {
  userName: string;
  planType: string;
  amountFailed?: string;
  errorMessage?: string;
  nextRetryDate?: string;
}

export const getPaymentFailureEmailTemplate = (data: PaymentFailureData) => {
  const { userName, planType, amountFailed, errorMessage, nextRetryDate } = data;
  const capitalizedPlan = planType ? planType.charAt(0).toUpperCase() + planType.slice(1) : 'Premium';

  const content = `
    <div style="font-size: 16px; color: #1A1A1A; margin-bottom: 16px;">
        Hi ${userName || 'there'},
    </div>
    <p style="color: #4A4A4A; line-height: 1.6; margin-bottom: 24px; font-size: 16px;">
        We encountered an issue processing your payment for the <strong>${capitalizedPlan}</strong> plan.
    </p>
    
    <!-- Failure Notice Card -->
    <div class="card" style="border-top: 4px solid #C1502E;">
      <div class="card-header" style="border-bottom: none; padding-bottom: 0; margin-bottom: 16px;">
        <h3 style="margin: 0; font-size: 18px; color: #C1502E; letter-spacing: -0.02em;">Payment Failed</h3>
      </div>
      <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 15px; line-height: 1.6;">
        ${errorMessage || 'Your payment could not be processed. Please update your payment method to continue using premium features.'}
      </p>
      
      <table class="receipt-table">
        <tr class="receipt-row">
          <td class="receipt-label">Plan</td>
          <td class="receipt-value">${capitalizedPlan}</td>
        </tr>
        ${amountFailed ? `
        <tr class="receipt-row">
          <td class="receipt-label">Amount Due</td>
          <td class="receipt-value">${amountFailed}</td>
        </tr>
        ` : ''}
        ${nextRetryDate ? `
        <tr class="receipt-row">
          <td class="receipt-label">Next Retry</td>
          <td class="receipt-value">${nextRetryDate}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    <!-- Next Steps Card -->
    <div class="card">
      <div class="card-header">How to resolve this</div>
      <ul class="feature-list">
        <li class="feature-item">
          <div style="display: flex;">
            <div style="color: #C1502E; margin-right: 12px; font-weight: bold;">•</div>
            <div class="feature-content">Check that your card has sufficient funds or hasn't expired.</div>
          </div>
        </li>
        <li class="feature-item">
          <div style="display: flex;">
            <div style="color: #C1502E; margin-right: 12px; font-weight: bold;">•</div>
            <div class="feature-content">Update your payment method in your account settings.</div>
          </div>
        </li>
        <li class="feature-item">
          <div style="display: flex;">
            <div style="color: #C1502E; margin-right: 12px; font-weight: bold;">•</div>
            <div class="feature-content">Contact your bank if the issue persists.</div>
          </div>
        </li>
      </ul>
      <p style="color: #4A4A4A; line-height: 1.6; margin-top: 16px; margin-bottom: 0; font-size: 14px;">
        Don't worry - your account remains active for now. Once you update your payment method, we'll automatically retry the payment and restore your full access.
      </p>
    </div>
    
    <div style="text-align: center; margin-top: 32px;">
      <a href="${process.env.CLIENT_URL || 'https://minimeet.com'}/settings" class="btn-primary" style="background: #C1502E;">
        Update Payment Method
      </a>
    </div>
    
    <!-- Need Assistance Section -->
    <div class="assistance-section">
      <div class="assistance-title">Need Assistance?</div>
      <div class="assistance-text">
        Our support team is here to help you resolve this billing issue.
      </div>
      <div class="assistance-links">
        <a href="${process.env.CLIENT_URL || 'https://minimeet.com'}/help">Help Center</a>
        <a href="${process.env.CLIENT_URL || 'https://minimeet.com'}/contact">Contact Support</a>
      </div>
    </div>
  `;

  return {
    subject: `Payment Failed - Action Required`,
    html: getEmailTemplate({
      title: 'Payment Failed',
      subtitle: 'Update your payment method',
      content,
      logoHeight: 24,
      pageTitle: 'Payment Failed - MeetLite',
    }),
  };
};
