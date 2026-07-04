import { getEmailTemplate } from './email-wrapper.js';

export const getPaymentFailureEmailTemplate = (userName: string, planType: string, errorMessage: string) => {
  const contentStyles = `
    <style>
      .failure-title {
        color: #dc2626;
        margin: 0 0 16px 0;
        font-size: 1.2rem;
        font-weight: 600;
      }
      .failure-text {
        color: #555;
        margin: 0 0 20px 0;
        font-size: 0.95rem;
        line-height: 1.5;
      }
      .error-box {
        background: #fee2e2;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
        border-left: 4px solid #dc2626;
      }
      .error-box h3 {
        color: #991b1b;
        margin-top: 0;
        font-size: 1rem;
        font-weight: 600;
      }
      .error-box p {
        color: #991b1b;
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
      .update-button {
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
      .update-button:hover {
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
        .error-box, .info-box {
          padding: 16px;
          margin: 16px 0;
        }
        .update-button {
          padding: 10px 20px;
          font-size: 0.9rem;
        }
      }
    </style>
  `;

  const content = `
    ${contentStyles}
    <h3 class="failure-title">Hi ${userName || 'there'}!</h3>
    <p class="failure-text">
      We encountered an issue processing your payment for the <strong>${
        planType.charAt(0).toUpperCase() + planType.slice(1)
      }</strong> plan.
    </p>
    
    <!-- Error Box -->
    <div class="error-box">
      <h3>⚠️ Payment Failed</h3>
      <p>
        ${errorMessage || 'Your payment could not be processed. Please update your payment method to continue.'}
      </p>
    </div>
    
    <!-- Info Box -->
    <div class="info-box">
      <h3>What to do next:</h3>
      <ul>
        <li>Update your payment method in your account settings</li>
        <li>Check that your card has sufficient funds</li>
        <li>Verify your billing information is correct</li>
        <li>Contact your bank if the issue persists</li>
      </ul>
    </div>
    
    <p class="failure-text">
      Don't worry - your account remains active. Once you update your payment method, we'll automatically retry the payment.
    </p>
    
    <!-- CTA Button -->
    <div style="text-align: center;">
      <a href="${process.env.CLIENT_URL}/settings" class="update-button">
        Update Payment Method
      </a>
    </div>
    
    <p class="footer-note">
      Need help? Contact our support team and we'll be happy to assist you.
    </p>
  `;

  return {
    subject: `Payment Failed - Action Required`,
    html: getEmailTemplate({
      title: '⚠️ Payment Failed',
      subtitle: 'Update your payment method',
      content,
      logoHeight: 100,
      pageTitle: 'Payment Failed - MeetLite',
    }),
  };
};
