/**
 * Base email template wrapper that provides consistent styling and structure
 * @param {Object} options - Email template options
 * @param {string} options.title - Header title
 * @param {string} options.subtitle - Header subtitle
 * @param {string} options.content - HTML content for the body
 * @param {string} [options.footerText] - Footer text (defaults to "© MeetLite. All rights reserved.")
 * @param {number} [options.logoHeight=100] - Logo height in pixels
 * @param {string} [options.pageTitle] - Page title for <title> tag
 * @returns {string} Complete HTML email template
 */
export const getEmailTemplate = ({
  title,
  subtitle,
  content,
  footerText = '© MeetLite. All rights reserved.',
  logoHeight = 100,
  pageTitle,
}) => {
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
          font-family: 'Segoe UI', Arial, sans-serif;
          background: #f5f3ff;
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
          background: #7c3aed;
          padding: 24px 20px 16px 20px;
          text-align: center;
        }
        .logo-container {
          display: inline-block;
          margin-bottom: 2px;
        }
        .logo-container img {
          height: 100px;
          max-width: 100%;
          display: block;
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
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <!-- Header -->
        <div class="header-padding">
          <div class="logo-container">
            <img src="${process.env.LOGO_URL}" alt='MeetLite Logo' />
          </div>
          <h2 class="title-size">${title || ''}</h2>
          ${subtitle ? `<p class="subtitle-size">${subtitle}</p>` : ''}
        </div>
        
        <!-- Content -->
        <div class="content-padding">
          ${content}
        </div>
        
        <!-- Footer -->
        <div class="bottom-footer">
          <p style="margin: 0;">
            ${footerText}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};
