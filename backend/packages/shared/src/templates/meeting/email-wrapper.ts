export interface EmailTemplateOptions {
  title: string;
  subtitle?: string;
  content: string;
  footerText?: string;
  logoHeight?: number;
  pageTitle?: string;
}

export const getEmailTemplate = ({
  title,
  subtitle,
  content,
  footerText = '© 2025 MeetLite. All rights reserved.',
  logoHeight = 24,
  pageTitle,
}: EmailTemplateOptions): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${pageTitle || title || 'MeetLite'}</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background: #F0EFE9;
          min-height: 100vh;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          color: #1A1A1A;
        }
        .email-outer {
          width: 100%;
          padding: 48px 0 64px 0;
        }
        .email-container {
          max-width: 520px;
          width: 100%;
          margin: 0 auto;
          background: #FFFFFF;
          border-radius: 16px;
          box-shadow: 0 1px 3px rgba(26, 26, 26, 0.06), 0 8px 32px -8px rgba(26, 26, 26, 0.1);
          overflow: hidden;
        }
        .header-padding {
          padding: 32px 40px 28px 40px;
          border-bottom: 1px solid #EDECEA;
        }
        .logo-container {
          display: flex;
          align-items: center;
          margin-bottom: 28px;
        }
        .logo-container img {
          height: ${logoHeight}px;
          width: auto;
          display: block;
        }
        .logo-text {
          color: #1A1A1A;
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -0.02em;
          margin-left: 9px;
        }
        .title-size {
          color: #1A1A1A;
          font-size: 22px;
          margin: 0;
          font-weight: 700;
          letter-spacing: -0.025em;
          line-height: 1.25;
        }
        .subtitle-size {
          color: #6B6B63;
          font-size: 15px;
          margin: 6px 0 0 0;
          line-height: 1.5;
          font-weight: 400;
        }
        .content-padding {
          padding: 32px 40px 40px 40px;
        }
        .bottom-footer {
          background: #F7F6F2;
          color: #9B9B93;
          text-align: center;
          padding: 24px 40px;
          font-size: 12px;
          line-height: 1.6;
          border-top: 1px solid #EDECEA;
        }
        .footer-links {
          margin-bottom: 10px;
        }
        .footer-links a {
          color: #6B6B63;
          text-decoration: none;
          margin: 0 10px;
          font-size: 12px;
          font-weight: 500;
        }
        .footer-links a:hover {
          color: #3D5A80;
        }
        .card {
          background: #FFFFFF;
          border-radius: 12px;
          padding: 24px;
          margin: 24px 0;
          border: 1px solid #E4E1D8;
          box-shadow: 0 2px 8px rgba(26, 26, 26, 0.04);
        }
        .card-header {
          border-bottom: 1px solid #E4E1D8;
          padding-bottom: 16px;
          margin-bottom: 16px;
          font-weight: 600;
          font-size: 16px;
          color: #1A1A1A;
        }
        .receipt-table {
          width: 100%;
          border-collapse: collapse;
        }
        .receipt-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #F0EFE9;
          font-size: 14px;
        }
        .receipt-row:last-child {
          border-bottom: none;
        }
        .receipt-label {
          color: #6B6B63;
        }
        .receipt-value {
          font-weight: 500;
          color: #1A1A1A;
          text-align: right;
        }
        .feature-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .feature-item {
          margin-bottom: 16px;
          font-size: 14px;
          color: #1A1A1A;
        }
        .feature-title {
          font-weight: 600;
          margin-bottom: 4px;
        }
        .feature-desc {
          color: #6B6B63;
          font-size: 13px;
          line-height: 1.4;
        }
        .assistance-section {
          background: #F7F6F2;
          border-radius: 12px;
          padding: 24px;
          text-align: center;
          margin-top: 32px;
        }
        .assistance-title {
          font-weight: 600;
          margin-bottom: 8px;
          font-size: 15px;
          color: #1A1A1A;
        }
        .assistance-text {
          color: #6B6B63;
          font-size: 13px;
          margin-bottom: 16px;
          line-height: 1.5;
        }
        .assistance-links a {
          display: inline-block;
          margin: 0 8px;
          color: #3D5A80;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
        }
        .btn-primary {
          display: inline-block;
          background: #3D5A80;
          color: #ffffff;
          font-weight: 500;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          font-size: 14px;
          text-align: center;
        }
        @media only screen and (max-width: 560px) {
          .email-outer {
            padding: 0;
          }
          .email-container {
            margin: 0;
            max-width: 100%;
            border-radius: 0;
            box-shadow: none;
          }
          .header-padding {
            padding: 24px 24px 20px 24px;
          }
          .content-padding {
            padding: 24px 24px 32px 24px;
          }
          .title-size {
            font-size: 20px;
          }
          .bottom-footer {
            padding: 20px 24px;
          }
          .footer-links a {
            display: inline-block;
            margin: 0 6px 4px 6px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-outer">
        <div class="email-container">
          <!-- Header -->
          <div class="header-padding">
            <div class="logo-container">
              <img src="${process.env.LOGO_URL || 'https://minimeet.com/logo.png'}" alt='MeetLite Logo' />
              <span class="logo-text">MeetLite</span>
            </div>
            ${title ? `<h2 class="title-size">${title}</h2>` : ''}
            ${subtitle ? `<p class="subtitle-size">${subtitle}</p>` : ''}
          </div>
          
          <!-- Content -->
          <div class="content-padding">
            ${content}
          </div>
          
          <!-- Footer -->
          <div class="bottom-footer">
            <div class="footer-links">
              <a href="#">Help Center</a>
              <a href="#">Privacy Policy</a>
              <a href="#">Unsubscribe</a>
            </div>
            <p style="margin: 0;">${footerText}</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};
