import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Centralized Email Service
 * All email sending goes through this service via queues
 * Singleton pattern for connection reuse and pooling
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    // Lazy initialization - don't initialize here
  }

  /**
   * Lazy initialization of transport
   * Only initializes when first needed
   */
  ensureTransport() {
    if (this.transporter && this.isConfigured) {
      return;
    }

    try {
      if (
        !process.env.SMTP_HOST ||
        !process.env.SMTP_USER ||
        !process.env.SMTP_PASS ||
        !process.env.SMTP_FROM
      ) {
        console.warn(
          '⚠️  SMTP not configured - emails will be queued but not sent'
        );
        this.isConfigured = false;
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        pool: true, // Use connection pooling
        maxConnections: 5,
        maxMessages: 100,
      });

      this.isConfigured = true;
    } catch (error) {
      console.error('Failed to initialize email transport:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Send email
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email
   * @param {string} options.subject - Email subject
   * @param {string} options.html - HTML content
   * @param {string} options.text - Plain text content (optional)
   * @param {Array} options.attachments - Email attachments (optional)
   * @returns {Promise<Object>} Result with success flag and messageId
   */
  async sendEmail(options) {
    // Lazy initialization - only initialize when first used
    this.ensureTransport();

    if (!this.isConfigured) {
      throw new Error('SMTP not configured');
    }

    const fromName = process.env.SMTP_FROM_NAME || 'MeetLite';
    const fromEmail = process.env.SMTP_FROM;

    const emailContent = {
      from: `${fromName} <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html?.replace(/<[^>]*>/g, '') || '',
      ...(options.attachments && { attachments: options.attachments }),
    };

    const result = await this.transporter.sendMail(emailContent);
    return { success: true, messageId: result.messageId };
  }

  /**
   * Verify SMTP connection
   * @returns {Promise<boolean>}
   */
  async verifyConnection() {
    if (!this.transporter) return false;
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('SMTP connection verification failed:', error);
      return false;
    }
  }

  /**
   * Check if email service is configured
   * @returns {boolean}
   */
  isServiceConfigured() {
    return this.isConfigured;
  }
}

// Export singleton instance
export const emailService = new EmailService();
