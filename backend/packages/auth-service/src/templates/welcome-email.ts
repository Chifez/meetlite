import { getEmailTemplate } from './email-wrapper.js';

export interface WelcomeEmailData {
  userName: string;
}

export const getWelcomeEmailTemplate = (data: WelcomeEmailData) => {
  const { userName } = data;

  const content = `
    <div style="font-size: 16px; color: #1A1A1A; margin-bottom: 16px;">
        Hi ${userName || 'there'},
    </div>
    <p style="color: #4A4A4A; line-height: 1.6; margin-bottom: 24px; font-size: 16px;">
        Welcome to MeetLite! We're thrilled to have you on board. You're just a few clicks away from hosting seamless, high-quality video meetings.
    </p>
    
    <!-- Next Steps Card -->
    <div class="card" style="border-top: 4px solid #3D5A80;">
      <div class="card-header" style="border-bottom: none; padding-bottom: 0; margin-bottom: 16px;">
        <h3 style="margin: 0; font-size: 18px; color: #1A1A1A; letter-spacing: -0.02em;">Here's what you can do next:</h3>
      </div>
      
      <ul class="feature-list">
        <li class="feature-item">
          <div style="display: flex;">
            <div style="color: #3D5A80; margin-right: 12px; font-weight: bold;">1.</div>
            <div class="feature-content">
              <div class="feature-title">Host high-quality video meetings instantly</div>
              <div class="feature-desc">Start a meeting with a single click and invite others.</div>
            </div>
          </div>
        </li>
        <li class="feature-item">
          <div style="display: flex;">
            <div style="color: #3D5A80; margin-right: 12px; font-weight: bold;">2.</div>
            <div class="feature-content">
              <div class="feature-title">Use AI-powered smart scheduling</div>
              <div class="feature-desc">Let us find the best time for everyone to meet.</div>
            </div>
          </div>
        </li>
        <li class="feature-item">
          <div style="display: flex;">
            <div style="color: #3D5A80; margin-right: 12px; font-weight: bold;">3.</div>
            <div class="feature-content">
              <div class="feature-title">Manage meetings seamlessly</div>
              <div class="feature-desc">Access your upcoming and past meetings in one place.</div>
            </div>
          </div>
        </li>
        <li class="feature-item" style="margin-bottom: 0;">
          <div style="display: flex;">
            <div style="color: #3D5A80; margin-right: 12px; font-weight: bold;">4.</div>
            <div class="feature-content">
              <div class="feature-title">Enjoy secure conversations</div>
              <div class="feature-desc">Your meetings are private and protected by default.</div>
            </div>
          </div>
        </li>
      </ul>
    </div>
    
    <p style="color: #4A4A4A; line-height: 1.6; margin-bottom: 32px; font-size: 15px;">
      Ready to dive in? Click the button below to head to your dashboard and schedule your first meeting.
    </p>
    
    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${process.env.CLIENT_URL || 'https://minimeet.com'}/dashboard" class="btn-primary">
        Get Started Now
      </a>
    </div>
    
    <!-- Need Assistance Section -->
    <div class="assistance-section">
      <div class="assistance-title">Need Help Getting Started?</div>
      <div class="assistance-text">
        Check out our guides or reach out to our team.
      </div>
      <div class="assistance-links">
        <a href="${process.env.CLIENT_URL || 'https://minimeet.com'}/help">Help Center</a>
        <a href="${process.env.CLIENT_URL || 'https://minimeet.com'}/contact">Contact Support</a>
      </div>
    </div>
  `;

  return {
    subject: 'Welcome to MeetLite!',
    html: getEmailTemplate({
      title: 'Welcome to MeetLite!',
      subtitle: 'Your journey to better meetings starts here',
      content,
      logoHeight: 24,
      pageTitle: 'Welcome to MeetLite',
    }),
  };
};
