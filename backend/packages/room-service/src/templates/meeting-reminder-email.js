/**
 * Meeting Reminder Email Template
 * Beautiful, responsive email template for meeting reminders
 */

export const meetingReminderEmailTemplate = ({
  recipientName,
  meetingTitle,
  meetingDescription,
  meetingDate,
  meetingTime,
  duration,
  timezone,
  joinUrl,
  organizerName,
  logoUrl,
}) => {
  const formattedDate = new Date(meetingDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meeting Reminder</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f5f5f5;
            line-height: 1.6;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
        }
        .header {
            background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%);
            padding: 30px 20px;
            text-align: center;
        }
        .logo {
            max-width: 150px;
            height: auto;
        }
        .content {
            padding: 40px 30px;
        }
        .greeting {
            font-size: 18px;
            color: #333333;
            margin-bottom: 20px;
        }
        .reminder-box {
            background-color: #FFF5F0;
            border-left: 4px solid #FF6B35;
            padding: 20px;
            margin: 25px 0;
            border-radius: 4px;
        }
        .reminder-label {
            font-size: 12px;
            color: #FF6B35;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
        }
        .meeting-title {
            font-size: 24px;
            font-weight: 600;
            color: #1a1a1a;
            margin: 0 0 15px 0;
        }
        .meeting-details {
            margin: 20px 0;
        }
        .detail-row {
            display: flex;
            align-items: flex-start;
            margin-bottom: 12px;
            font-size: 15px;
        }
        .detail-icon {
            width: 20px;
            margin-right: 12px;
            color: #666666;
        }
        .detail-label {
            font-weight: 600;
            color: #333333;
            min-width: 80px;
        }
        .detail-value {
            color: #666666;
            flex: 1;
        }
        .description {
            background-color: #f9f9f9;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            color: #555555;
            font-size: 14px;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%);
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            margin: 25px 0;
            text-align: center;
            box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
        }
        .cta-button:hover {
            opacity: 0.9;
        }
        .footer {
            background-color: #f9f9f9;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e5e5e5;
        }
        .footer-text {
            color: #999999;
            font-size: 13px;
            margin: 5px 0;
        }
        .footer-link {
            color: #FF6B35;
            text-decoration: none;
        }
        @media only screen and (max-width: 600px) {
            .content {
                padding: 30px 20px;
            }
            .meeting-title {
                font-size: 20px;
            }
            .cta-button {
                display: block;
                width: 100%;
                box-sizing: border-box;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <img src="${logoUrl}" alt="MiniMeet Logo" class="logo">
        </div>

        <!-- Content -->
        <div class="content">
            <div class="greeting">
                Hi ${recipientName || 'there'},
            </div>

            <div class="reminder-box">
                <div class="reminder-label">⏰ Meeting Reminder</div>
                <h1 class="meeting-title">${meetingTitle}</h1>
                
                <div class="meeting-details">
                    <div class="detail-row">
                        <span class="detail-label">📅 Date:</span>
                        <span class="detail-value">${formattedDate}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">🕐 Time:</span>
                        <span class="detail-value">${meetingTime} (${timezone})</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">⏱️ Duration:</span>
                        <span class="detail-value">${duration} minutes</span>
                    </div>
                    ${
                      organizerName
                        ? `
                    <div class="detail-row">
                        <span class="detail-label">👤 Host:</span>
                        <span class="detail-value">${organizerName}</span>
                    </div>
                    `
                        : ''
                    }
                </div>
            </div>

            ${
              meetingDescription
                ? `
            <div class="description">
                <strong>Description:</strong><br>
                ${meetingDescription}
            </div>
            `
                : ''
            }

            <p style="color: #555555; font-size: 15px;">
                Your meeting starts in <strong>10 minutes</strong>. Click the button below to join:
            </p>

            <center>
                <a href="${joinUrl}" class="cta-button">
                    🎥 Join Meeting Now
                </a>
            </center>

            <p style="color: #999999; font-size: 13px; margin-top: 25px;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${joinUrl}" style="color: #FF6B35; word-break: break-all;">${joinUrl}</a>
            </p>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p class="footer-text">
                This is an automated reminder from MiniMeet.
            </p>
            <p class="footer-text">
                <a href="${process.env.CLIENT_URL}/settings/notifications" class="footer-link">
                    Manage notification preferences
                </a>
            </p>
            <p class="footer-text" style="margin-top: 15px;">
                © ${new Date().getFullYear()} MiniMeet. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>
  `.trim();
};

/**
 * Plain text version for email clients that don't support HTML
 */
export const meetingReminderEmailText = ({
  recipientName,
  meetingTitle,
  meetingDate,
  meetingTime,
  duration,
  timezone,
  joinUrl,
  organizerName,
  meetingDescription,
}) => {
  const formattedDate = new Date(meetingDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
Hi ${recipientName || 'there'},

⏰ MEETING REMINDER

${meetingTitle}

Your meeting starts in 10 minutes!

Meeting Details:
- Date: ${formattedDate}
- Time: ${meetingTime} (${timezone})
- Duration: ${duration} minutes
${organizerName ? `- Host: ${organizerName}` : ''}

${meetingDescription ? `Description:\n${meetingDescription}\n` : ''}

Join the meeting:
${joinUrl}

---
This is an automated reminder from MiniMeet.
Manage your notification preferences at ${process.env.CLIENT_URL}/settings/notifications

© ${new Date().getFullYear()} MiniMeet. All rights reserved.
  `.trim();
};

export default {
  meetingReminderEmailTemplate,
  meetingReminderEmailText,
};

