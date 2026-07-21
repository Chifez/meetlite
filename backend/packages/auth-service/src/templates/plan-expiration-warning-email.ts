import { getEmailTemplate } from './email-wrapper.js';

export interface PlanExpirationWarningData {
  userName: string;
  planType: string;
  daysRemaining: number;
}

export const getPlanExpirationWarningEmailTemplate = (data: PlanExpirationWarningData) => {
  const { userName, planType, daysRemaining } = data;
  const capitalizedPlan = planType ? planType.charAt(0).toUpperCase() + planType.slice(1) : 'Premium';

  const content = `
    <div style="font-size: 16px; color: #1A1A1A; margin-bottom: 16px;">
        Hi ${userName || 'there'},
    </div>
    <p style="color: #4A4A4A; line-height: 1.6; margin-bottom: 24px; font-size: 16px;">
        Your <strong>${capitalizedPlan}</strong> plan will expire in <strong>${daysRemaining} days</strong>.
    </p>
    
    <!-- Warning Card -->
    <div class="card" style="border-top: 4px solid #F57F17;">
      <div class="card-header" style="border-bottom: none; padding-bottom: 0; margin-bottom: 12px;">
        <h3 style="margin: 0; font-size: 18px; color: #F57F17; letter-spacing: -0.02em;">Important Notice</h3>
      </div>
      <p style="margin: 0; color: #4A4A4A; font-size: 15px; line-height: 1.6;">
        After expiration, you'll be automatically moved to our Free plan and lose access to premium features.
      </p>
    </div>
    
    <p style="color: #4A4A4A; line-height: 1.6; margin-top: 16px; margin-bottom: 32px; font-size: 15px;">
      To continue enjoying premium features, please renew your subscription before it expires.
    </p>
    
    <!-- CTA Button -->
    <div style="text-align: center; margin-top: 32px;">
      <a href="${process.env.CLIENT_URL || 'https://minimeet.com'}/settings" class="btn-primary">
        Renew Now
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
    subject: `Your ${capitalizedPlan} Plan Expires in ${daysRemaining} Days`,
    html: getEmailTemplate({
      title: 'Plan Expiring Soon',
      subtitle: 'Action required to maintain access',
      content,
      logoHeight: 24,
      pageTitle: 'Plan Expiring Soon - MeetLite',
    }),
  };
};
