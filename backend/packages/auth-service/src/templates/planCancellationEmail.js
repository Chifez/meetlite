export const getPlanCancellationEmailTemplate = (
  userName,
  planType,
  endDate
) => ({
  subject: `📋 Plan Cancellation Confirmed`,
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Plan Cancelled - MeetLite</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: 'Segoe UI', Arial, sans-serif;
          background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .email-container {
          max-width: 480px;
          width: 100%;
          margin: 20px;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(255, 107, 107, 0.2);
          overflow: hidden;
        }
        .header-padding {
          background: linear-gradient(90deg, #ff6b6b 0%, #ee5a24 100%);
          padding: 24px 20px 16px 20px;
          text-align: center;
        }
        .content-padding {
          padding: 24px 20px 20px 20px;
        }
        .title-size {
          color: #fff;
          font-size: 1.4rem;
          margin: 0;
          font-weight: 700;
          letter-spacing: -0.5px;
        }
        .subtitle-size {
          color: #ffe0e0;
          font-size: 0.9rem;
          margin: 4px 0 0 0;
        }
        .cancellation-title {
          color: #ff6b6b;
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
          border-left: 4px solid #ff6b6b;
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
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          color: #fff;
          font-weight: 600;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          font-size: 0.95rem;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          transition: all 0.2s;
          min-width: 120px;
          text-align: center;
        }
        .settings-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
        }
        .footer-note {
          color: #888;
          font-size: 0.8rem;
          margin-top: 16px;
          line-height: 1.4;
          text-align: center;
        }
        .bottom-footer {
          background: #ffe0e0;
          color: #ff6b6b;
          text-align: center;
          padding: 12px 0;
          font-size: 0.8rem;
          border-top: 1px solid #ffb3b3;
        }
        @media only screen and (max-width: 480px) {
          .email-container {
            margin: 12px;
            max-width: calc(100% - 24px);
          }
          .header-padding {
            padding: 20px 16px 12px 16px;
          }
          .content-padding {
            padding: 20px 16px 16px 16px;
          }
          .title-size {
            font-size: 1.2rem;
          }
          .subtitle-size {
            font-size: 0.85rem;
          }
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
    </head>
    <body>
      <div class="email-container">
        <!-- Header -->
        <div class="header-padding">
          <img src="${
            process.env.LOGO_URL
          }" alt='Brand Logo' style='height: 32px; margin-bottom: 8px; max-width: 100%;' />
          <h2 class="title-size">📋 Plan Cancelled</h2>
          <p class="subtitle-size">We're sorry to see you go</p>
        </div>
        
        <!-- Content -->
        <div class="content-padding">
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
              <li><strong>Access Until:</strong> ${new Date(
                endDate
              ).toLocaleDateString()}</li>
              <li><strong>Status:</strong> Cancelled</li>
            </ul>
          </div>
          
          <p class="cancellation-text">
            You'll continue to have access to premium features until ${new Date(
              endDate
            ).toLocaleDateString()}. 
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
            <a href="${
              process.env.CLIENT_URL
            }/settings" class="settings-button">
              Manage Subscription
            </a>
          </div>
          
          <p class="footer-note">
            We're sorry to see you go! If you change your mind, we're here to help.
          </p>
        </div>
        
        <!-- Footer -->
        <div class="bottom-footer">
          <p style="margin: 0;">
            Made with ❤️ by the MeetLite team
          </p>
        </div>
      </div>
    </body>
    </html>
  `,
});
