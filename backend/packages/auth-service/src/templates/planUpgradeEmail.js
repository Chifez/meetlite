export const getPlanUpgradeEmailTemplate = (userName, planType, endDate) => ({
  subject: `🎉 Plan Upgraded to ${
    planType.charAt(0).toUpperCase() + planType.slice(1)
  }`,
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Plan Upgraded - MeetLite</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: 'Segoe UI', Arial, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
          box-shadow: 0 8px 32px rgba(102, 126, 234, 0.2);
          overflow: hidden;
        }
        .header-padding {
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
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
          color: #e0e7ff;
          font-size: 0.9rem;
          margin: 4px 0 0 0;
        }
        .upgrade-title {
          color: #667eea;
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
          border-left: 4px solid #667eea;
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
        .dashboard-button:hover {
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
          background: #e0e7ff;
          color: #667eea;
          text-align: center;
          padding: 12px 0;
          font-size: 0.8rem;
          border-top: 1px solid #c7d2fe;
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
    </head>
    <body>
      <div class="email-container">
        <!-- Header -->
        <div class="header-padding">
          <img src="${
            process.env.LOGO_URL
          }" alt='Brand Logo' style='height: 32px; margin-bottom: 8px; max-width: 100%;' />
          <h2 class="title-size">🎉 Plan Upgraded!</h2>
          <p class="subtitle-size">Welcome to premium features</p>
        </div>
        
        <!-- Content -->
        <div class="content-padding">
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
            <a href="${
              process.env.CLIENT_URL
            }/dashboard" class="dashboard-button">
              Go to Dashboard
            </a>
          </div>
          
          <p class="footer-note">
            If you have any questions, feel free to contact our support team.
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
