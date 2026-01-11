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

/**
 * Create email templates object from template functions
 * This allows services to pass their existing templates to the EmailWorker
 *
 * @param {Object} templateFunctions - Object with template functions
 * @returns {Object} Templates object for EmailWorker
 */
export function createEmailTemplates(templateFunctions) {
  return templateFunctions;
}

/**
 * Default template wrapper - returns template as-is if it already has the right structure
 * Otherwise wraps it to ensure it returns {subject, html, text}
 */
export function wrapTemplate(templateFn) {
  return (data) => {
    const result = templateFn(data);

    // If template already returns {subject, html, text}, return as-is
    if (result && typeof result === 'object' && result.subject && result.html) {
      return result;
    }

    // Otherwise, assume it's just HTML and create wrapper
    // This is a fallback - templates should ideally return proper structure
    return {
      subject: result.subject || 'Notification from MeetLite',
      html: result.html || result,
      text:
        typeof result === 'string'
          ? result.replace(/<[^>]*>/g, '')
          : result.text || '',
    };
  };
}
