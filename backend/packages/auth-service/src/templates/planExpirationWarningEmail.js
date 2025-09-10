export const getPlanExpirationWarningEmailTemplate = (
  userName,
  planType,
  daysRemaining
) => ({
  subject: `⚠️ Your ${
    planType.charAt(0).toUpperCase() + planType.slice(1)
  } Plan Expires in ${daysRemaining} Days`,
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Plan Expiring Soon - MeetLite</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: 'Segoe UI', Arial, sans-serif;
          background: linear-gradient(135deg, #ffa726 0%, #ff7043 100%);
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
          box-shadow: 0 8px 32px rgba(255, 167, 38, 0.2);
          overflow: hidden;
        }
        .header-padding {
          background: linear-gradient(90deg, #ffa726 0%, #ff7043 100%);
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
          color: #fff3e0;
          font-size: 0.9rem;
          margin: 4px 0 0 0;
        }
        .warning-title {
          color: #ffa726;
          margin: 0 0 16px 0;
          font-size: 1.2rem;
          font-weight: 600;
        }
        .warning-text {
          color: #555;
          margin: 0 0 20px 0;
          font-size: 0.95rem;
          line-height: 1.5;
        }
        .warning-box {
          background: #fff3cd;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          border-left: 4px solid #ffc107;
        }
        .warning-box h3 {
          color: #856404;
          margin-top: 0;
          font-size: 1rem;
          font-weight: 600;
        }
        .warning-box p {
          color: #856404;
          margin: 0;
          font-size: 0.9rem;
        }
        .renew-button {
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
        .renew-button:hover {
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
          background: #fff3e0;
          color: #ffa726;
          text-align: center;
          padding: 12px 0;
          font-size: 0.8rem;
          border-top: 1px solid #ffcc80;
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
          .warning-box {
            padding: 16px;
            margin: 16px 0;
          }
          .renew-button {
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
          <h2 class="title-size">⚠️ Plan Expiring Soon</h2>
          <p class="subtitle-size">Action required to maintain access</p>
        </div>
        
        <!-- Content -->
        <div class="content-padding">
          <h3 class="warning-title">Hi ${userName || 'there'}!</h3>
          <p class="warning-text">
            Your <strong>${
              planType.charAt(0).toUpperCase() + planType.slice(1)
            }</strong> plan will expire in <strong>${daysRemaining} days</strong>.
          </p>
          
          <!-- Warning Box -->
          <div class="warning-box">
            <h3>⚠️ Important Notice</h3>
            <p>
              After expiration, you'll be automatically moved to our Free plan and lose access to premium features.
            </p>
          </div>
          
          <p class="warning-text">
            To continue enjoying premium features, please renew your subscription before it expires.
          </p>
          
          <!-- CTA Button -->
          <div style="text-align: center;">
            <a href="${process.env.CLIENT_URL}/settings" class="renew-button">
              Renew Now
            </a>
          </div>
          
          <p class="footer-note">
            Questions? Contact our support team for assistance.
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
