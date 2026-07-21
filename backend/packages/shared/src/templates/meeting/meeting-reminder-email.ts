/**
 * Meeting Reminder Email Template
 * Beautiful, responsive email template for meeting reminders
 */

import { getEmailTemplate } from './email-wrapper.js';

export interface MeetingReminderEmailOptions {
    recipientName?: string;
    meetingTitle: string;
    meetingDescription?: string;
    meetingDate: Date | string;
    meetingTime: string;
    duration: number;
    timezone: string;
    joinUrl: string;
    organizerName?: string;
    logoUrl?: string;
}

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
}: MeetingReminderEmailOptions): string => {
    const formattedDate = new Date(meetingDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const content = `
    <div style="font-size: 16px; color: #1A1A1A; margin-bottom: 16px;">
        Hi ${recipientName || 'there'},
    </div>
    <p style="color: #4A4A4A; line-height: 1.6; margin-bottom: 24px; font-size: 16px;">
        This is a friendly reminder that your meeting <strong>${meetingTitle}</strong> is starting soon. 
    </p>

    <!-- Meeting Details Card -->
    <div class="card">
        <div class="card-header">
            Meeting Details
            <div style="color: #C1502E; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 8px;">
                ⏰ Starting in 10 minutes
            </div>
        </div>
        <div style="font-size: 20px; font-weight: 700; color: #1A1A1A; margin-bottom: 16px; letter-spacing: -0.02em;">
            ${meetingTitle}
        </div>
        ${meetingDescription ? `<p style="margin: 0 0 20px 0; color: #4A4A4A; font-size: 15px; line-height: 1.6;">${meetingDescription}</p>` : ''}
        
        <table class="receipt-table">
            <tr class="receipt-row">
                <td class="receipt-label">Date</td>
                <td class="receipt-value">${formattedDate}</td>
            </tr>
            <tr class="receipt-row">
                <td class="receipt-label">Time</td>
                <td class="receipt-value">${meetingTime} (${timezone})</td>
            </tr>
            <tr class="receipt-row">
                <td class="receipt-label">Duration</td>
                <td class="receipt-value">${duration} minutes</td>
            </tr>
            ${organizerName ? `
            <tr class="receipt-row">
                <td class="receipt-label">Host</td>
                <td class="receipt-value">${organizerName}</td>
            </tr>
            ` : ''}
        </table>
    </div>

    <!-- Preparation List -->
    <div class="card">
      <div class="card-header">Quick Checks before joining</div>
      <ul class="feature-list">
        <li class="feature-item">
          <div style="display: flex;">
            <div style="color: #3D5A80; margin-right: 12px; font-weight: bold;">✓</div>
            <div class="feature-content">Find a quiet space with a stable internet connection</div>
          </div>
        </li>
        <li class="feature-item" style="margin-bottom: 0;">
          <div style="display: flex;">
            <div style="color: #3D5A80; margin-right: 12px; font-weight: bold;">✓</div>
            <div class="feature-content">Test your microphone and camera</div>
          </div>
        </li>
      </ul>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin-top: 32px; margin-bottom: 32px;">
        <a href="${joinUrl}" class="btn-primary" style="background: #2E7D5B;">
            Join Meeting Now
        </a>
    </div>

    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #E4E1D8; color: #6B6B63; font-size: 13px; line-height: 1.5; text-align: center;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${joinUrl}" style="color: #3D5A80; word-break: break-all;">${joinUrl}</a>
    </div>
  `;

    return getEmailTemplate({
        title: 'Meeting Reminder',
        subtitle: 'Your meeting is starting soon',
        content,
        logoHeight: 24,
        pageTitle: 'Meeting Reminder',
    });
};

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
}: MeetingReminderEmailOptions): string => {
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
This is an automated reminder from MeetLite.
Manage your notification preferences at ${process.env.CLIENT_URL || 'https://minimeet.com'}/settings/notifications

© ${new Date().getFullYear()} MeetLite. All rights reserved.
  `.trim();
};

export default {
    meetingReminderEmailTemplate,
    meetingReminderEmailText,
};
