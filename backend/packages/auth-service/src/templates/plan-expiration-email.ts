import { getEmailTemplate } from './email-wrapper.js';

export interface PlanExpirationData {
  userName: string;
  planType: string;
}

export const getPlanExpirationEmailTemplate = (data: PlanExpirationData) => {
  const { userName, planType } = data;
  const capitalizedPlan = planType ? planType.charAt(0).toUpperCase() + planType.slice(1) : 'Premium';

  const content = `
    <div style="font-size: 16px; color: #1A1A1A; margin-bottom: 16px;">
        Hi ${userName || 'there'},
    </div>
    <p style="color: #4A4A4A; line-height: 1.6; margin-bottom: 24px; font-size: 16px;">
        Your <strong>${capitalizedPlan}</strong> plan has expired.
    </p>
    
    <!-- Warning Card -->
    <div class="card" style="border-top: 4px solid #C1502E; margin-bottom: 24px;">
      <div class="card-header" style="border-bottom: none; padding-bottom: 0; margin-bottom: 12px;">
        <h3 style="margin: 0; font-size: 18px; color: #C1502E; letter-spacing: -0.02em;">Plan Expired</h3>
      </div>
      <p style="margin: 0; color: #4A4A4A; font-size: 15px; line-height: 1.6;">
        Your subscription has ended and you've been automatically moved to our Free plan. You no longer have access to premium features.
      </p>
    </div>
    
    <!-- Info Box -->
    <div class="card">
      <div class="card-header">What happens now</div>
      <ul class="feature-list">
        <li class="feature-item">
          <div style="display: flex;">
            <div style="color: #6B6B63; margin-right: 12px; font-weight: bold;">-</div>
            <div class="feature-content">You've been moved to the Free plan</div>
          </div>
        </li>
        <li class="feature-item">
          <div style="display: flex;">
            <div style="color: #6B6B63; margin-right: 12px; font-weight: bold;">-</div>
            <div class="feature-content">Premium features are no longer available</div>
          </div>
        </li>
        <li class="feature-item">
          <div style="display: flex;">
            <div style="color: #2E7D32; margin-right: 12px; font-weight: bold;">✓</div>
            <div class="feature-content">Your data and account remain intact</div>
          </div>
        </li>
        <li class="feature-item">
          <div style="display: flex;">
            <div style="color: #2E7D32; margin-right: 12px; font-weight: bold;">✓</div>
            <div class="feature-content">You can upgrade again anytime</div>
          </div>
        </li>
      </ul>
    </div>
    
    <p style="color: #4A4A4A; line-height: 1.6; margin-top: 16px; margin-bottom: 32px; font-size: 15px;">
      Want to continue enjoying premium features? Renew your subscription now!
    </p>
    
    <!-- CTA Button -->
    <div style="text-align: center; margin-top: 32px;">
      <a href="${process.env.CLIENT_URL || 'https://minimeet.com'}/settings" class="btn-primary">
        Renew Plan
      </a>
    </div>
    
    <!-- Need Assistance Section -->
    <div class="assistance-section">
      <div class="assistance-title">Need Assistance?</div>
      <div class="assistance-text">
        Questions? Contact our support team for assistance.
      </div>
      <div class="assistance-links">
        <a href="${process.env.CLIENT_URL || 'https://minimeet.com'}/help">Help Center</a>
        <a href="${process.env.CLIENT_URL || 'https://minimeet.com'}/contact">Contact Support</a>
      </div>
    </div>
  `;

  return {
    subject: `Your ${capitalizedPlan} Plan Has Expired`,
    html: getEmailTemplate({
      title: 'Plan Expired',
      subtitle: 'Renew to continue premium features',
      content,
      logoHeight: 24,
      pageTitle: 'Plan Expired - MeetLite',
    }),
  };
};
