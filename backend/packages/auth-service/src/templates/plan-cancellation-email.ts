import { getEmailTemplate } from './email-wrapper.js';

export const getPlanCancellationEmailTemplate = (
  userName: string,
  planType: string,
  endDate: string | Date | null
) => {
  const contentStyles = `
    <style>
      .cancellation-title {
        color: #7c3aed;
        margin: 0 0 16px 0;
        font-size: 1.2rem;
        font-weight: 600;
      }
      .cancellation-text {
        color: #555;
        margin: 0 0 20px 0;
        font-size: 0.95rem;
        line-height: 1.5;
      }
      .cancellation-details {
        background: #fff;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
        border-left: 4px solid #7c3aed;
      }
      .cancellation-details h3 {
        color: #333;
        margin-top: 0;
        font-size: 1rem;
        font-weight: 600;
      }
      .cancellation-details ul {
        color: #666;
        padding-left: 20px;
        margin: 0;
      }
      .cancellation-details li {
        margin-bottom: 8px;
        font-size: 0.9rem;
      }
      .warning-box {
        background: #fff3cd;
        padding: 15px;
        border-radius: 8px;
        margin: 20px 0;
        border-left: 4px solid #ffc107;
      }
      .warning-box p {
        color: #856404;
        margin: 0;
        font-size: 0.9rem;
      }
      .settings-button {
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
      .settings-button:hover {
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
        .cancellation-details {
          padding: 16px;
          margin: 16px 0;
        }
        .warning-box {
          padding: 12px;
          margin: 16px 0;
        }
        .settings-button {
          padding: 10px 20px;
          font-size: 0.9rem;
        }
      }
    </style>
  `;

  const content = `
    ${contentStyles}
    <h3 class="cancellation-title">Hi ${userName || 'there'}!</h3>
    <p class="cancellation-text">
      Your <strong>${
        planType.charAt(0).toUpperCase() + planType.slice(1)
      }</strong> plan has been successfully cancelled.
    </p>
    
    <!-- Cancellation Details -->
    <div class="cancellation-details">
      <h3>Cancellation Details:</h3>
      <ul>
        <li><strong>Cancelled Plan:</strong> ${
          planType.charAt(0).toUpperCase() + planType.slice(1)
        }</li>
        <li><strong>Access Until:</strong> ${endDate ? new Date(endDate).toLocaleDateString() : 'N/A'}</li>
        <li><strong>Status:</strong> Cancelled</li>
      </ul>
    </div>
    
    <p class="cancellation-text">
      You'll continue to have access to premium features until ${endDate ? new Date(endDate).toLocaleDateString() : 'N/A'}. 
      After that, you'll be moved to our Free plan.
    </p>
    
    <!-- Warning Box -->
    <div class="warning-box">
      <p>
        <strong>💡 Tip:</strong> You can reactivate your plan anytime before the end date to continue enjoying premium features.
      </p>
    </div>
    
    <!-- CTA Button -->
    <div style="text-align: center;">
      <a href="${process.env.CLIENT_URL}/settings" class="settings-button">
        Manage Subscription
      </a>
    </div>
    
    <p class="footer-note">
      We're sorry to see you go! If you change your mind, we're here to help.
    </p>
  `;

  return {
    subject: `Plan Cancellation Confirmed`,
    html: getEmailTemplate({
      title: '📋 Plan Cancelled',
      subtitle: "We're sorry to see you go",
      content,
      logoHeight: 100,
      pageTitle: 'Plan Cancelled - MeetLite',
    }),
  };
};
