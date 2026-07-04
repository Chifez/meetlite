import { getEmailTemplate } from './email-wrapper.js';

export const getWelcomeEmailTemplate = (userName: string) => {
  const contentStyles = `
    <style>
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
      .get-started-button:hover {
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
  `;

  const content = `
    ${contentStyles}
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
      <a href="${process.env.CLIENT_URL}/dashboard" class="get-started-button">
        Get Started Now
      </a>
    </div>
    
    <p class="footer-note">
      If you have any questions or need help getting started, feel free to reach out to our support team.
    </p>
  `;

  return {
    subject: 'Welcome to MeetLite! 🎉',
    html: getEmailTemplate({
      title: 'Welcome to MeetLite!',
      subtitle: 'Your journey to better meetings starts here',
      content,
      logoHeight: 100,
      pageTitle: 'Welcome to MeetLite',
    }),
  };
};
