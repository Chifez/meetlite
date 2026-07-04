/**
 * Centralized Email Templates Index
 *
 * This file provides a centralized interface for email templates.
 * Templates can be imported from existing locations or defined here.
 *
 * Each template function should return an object with:
 * - subject: string
 * - html: string
 * - text: string (optional)
 * - attachments: array (optional)
 */

import { getMeetingInviteEmailTemplate } from './meeting/meeting-invite-email.js';
import { meetingReminderEmailTemplate, meetingReminderEmailText } from './meeting/meeting-reminder-email.js';

export { getMeetingInviteEmailTemplate, meetingReminderEmailTemplate, meetingReminderEmailText };

export interface EmailTemplateResult {
  subject: string;
  html: string;
  text?: string;
  attachments?: any[];
}

export type EmailTemplateFunction = (data: any) => EmailTemplateResult;

/**
 * Create email templates object from template functions
 * This allows services to pass their existing templates to the EmailWorker
 *
 * @param templateFunctions - Object with template functions
 * @returns Templates object for EmailWorker
 */
export function createEmailTemplates(templateFunctions: Record<string, EmailTemplateFunction>): Record<string, EmailTemplateFunction> {
  return templateFunctions;
}

/**
 * Default template wrapper - returns template as-is if it already has the right structure
 * Otherwise wraps it to ensure it returns {subject, html, text}
 */
export function wrapTemplate(templateFn: (...args: any[]) => any) {
  return (...args: any[]): EmailTemplateResult => {
    const result = templateFn(...args);

    if (result && typeof result === 'object' && result.subject && result.html) {
      return result as EmailTemplateResult;
    }

    return {
      subject: result?.subject || 'Notification from MeetLite',
      html: result?.html || result,
      text:
        typeof result === 'string'
          ? result.replace(/<[^>]*>/g, '')
          : result?.text || '',
    };
  };
}
