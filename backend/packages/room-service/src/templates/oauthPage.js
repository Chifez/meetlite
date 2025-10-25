const createOAuthPage = (type, title, message, iconPath) => {
  const isSuccess = type === 'success';
  const iconColor = isSuccess ? '#34a853' : '#ea4335';
  const iconBg = isSuccess ? '#34a853' : '#ea4335';

  return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Google Sans', 'Roboto', Arial, sans-serif;
              background-color: #f8f9fa;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              color: #202124;
            }
            
            .container {
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
              padding: 48px 40px;
              text-align: center;
              max-width: 400px;
              width: 90%;
            }
            
            .icon {
              width: 48px;
              height: 48px;
              background: ${iconBg};
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 24px;
            }
            
            .icon svg {
              width: 24px;
              height: 24px;
              fill: white;
            }
            
            h1 {
              font-size: 24px;
              font-weight: 400;
              color: #202124;
              margin-bottom: 16px;
              line-height: 1.3;
            }
            
            p {
              font-size: 14px;
              color: #5f6368;
              line-height: 1.5;
              margin-bottom: 32px;
            }
            
            .close-button {
              background: #1a73e8;
              color: white;
              border: none;
              border-radius: 4px;
              padding: 12px 24px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              transition: background-color 0.2s ease;
              min-width: 120px;
            }
            
            .close-button:hover {
              background: #1557b0;
            }
            
            .close-button:active {
              background: #174ea6;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">
              <svg viewBox="0 0 24 24">
                <path d="${iconPath}"/>
              </svg>
            </div>
            <h1>${title}</h1>
            <p>${message}</p>
            <button class="close-button" onclick="window.close()">Close</button>
          </div>
        </body>
      </html>
    `;
};

// Predefined templates
const oauthTemplates = {
  googleSuccess: () =>
    createOAuthPage(
      'success',
      'Connection successful',
      'Your Google Calendar has been successfully connected. You can now close this window and return to your meetings page.',
      'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'
    ),

  googleError: () =>
    createOAuthPage(
      'error',
      'Connection failed',
      "Sorry, we couldn't connect your Google Calendar. Please try again.",
      'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'
    ),

  outlookSuccess: () =>
    createOAuthPage(
      'success',
      'Connection successful',
      'Your Outlook Calendar has been successfully connected. You can now close this window and return to your meetings page.',
      'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'
    ),

  outlookError: () =>
    createOAuthPage(
      'error',
      'Connection failed',
      "Sorry, we couldn't connect your Outlook Calendar. Please try again.",
      'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'
    ),
};

export { createOAuthPage, oauthTemplates };
