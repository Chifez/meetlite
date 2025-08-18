export const getWelcomeEmailTemplate = (userName) => ({
  subject: 'Welcome to MeetLite! 🎉',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to MeetLite</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: 'Segoe UI', Arial, sans-serif;
          background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%);
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
          box-shadow: 0 8px 32px rgba(160, 120, 255, 0.2);
          overflow: hidden;
        }
        .header-padding {
          background: linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%);
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
          color: #ede9fe;
          font-size: 0.9rem;
          margin: 4px 0 0 0;
        }
        .welcome-title {
          color: #7c3aed;
          margin: 0 0 16px 0;
          font-size: 1.2rem;
          font-weight: 600;
        }
        .welcome-text {
          color: #555;
          margin: 0 0 20px 0;
          font-size: 0.95rem;
          line-height: 1.5;
        }
        .features-list {
          background: #f8f7ff;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
          border-left: 4px solid #7c3aed;
        }
        .feature-item {
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          color: #374151;
          font-size: 0.9rem;
        }
        .feature-icon {
          margin-right: 8px;
          color: #7c3aed;
          font-weight: bold;
        }
        .get-started-button {
          display: inline-block;
          background: linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%);
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
        .get-started-button:hover {
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
        .bottom-footer {
          background: #ede9fe;
          color: #7c3aed;
          text-align: center;
          padding: 12px 0;
          font-size: 0.8rem;
          border-top: 1px solid #e0e7ff;
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
          .features-list {
            padding: 12px;
            margin-bottom: 16px;
          }
          .get-started-button {
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
          <h2 class="title-size">Welcome to MeetLite!</h2>
          <p class="subtitle-size">Your journey to better meetings starts here</p>
        </div>
        
        <!-- Content -->
        <div class="content-padding">
          <h3 class="welcome-title">Hi ${userName || 'there'}! 👋</h3>
          <p class="welcome-text">
            Welcome to MeetLite! We're excited to have you on board. You're now ready to create amazing meeting experiences with our powerful video conferencing platform.
          </p>
          
          <!-- Features List -->
          <div class="features-list">
            <div class="feature-item">
              <span class="feature-icon">🎥</span>
              <span>High-quality video meetings</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🤖</span>
              <span>AI-powered smart scheduling</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">📅</span>
              <span>Easy meeting management</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🔒</span>
              <span>Secure and private conversations</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">📱</span>
              <span>Works on all your devices</span>
            </div>
          </div>
          
          <!-- CTA Button -->
          <div style="text-align: center;">
            <a href="${
              process.env.CLIENT_URL
            }/dashboard" class="get-started-button">
              Get Started Now
            </a>
          </div>
          
          <p class="footer-note">
            If you have any questions or need help getting started, feel free to reach out to our support team.
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
