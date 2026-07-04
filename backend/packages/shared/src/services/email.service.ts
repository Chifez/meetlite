import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content?: any;
    path?: string;
    contentType?: string;
  }>;
}

export interface SendEmailResult {
  success: boolean;
  messageId: string;
}

/**
 * Centralized Email Service
 * All email sending goes through this service via queues
 * Singleton pattern for connection reuse and pooling
 */
class EmailService {
  private transporter: nodemailer.Transporter | null;
  private isConfigured: boolean;

  constructor() {
    this.transporter = null;
    this.isConfigured = false;
  }

  /**
   * Lazy initialization of transport
   * Only initializes when first needed
   */
  ensureTransport(): void {
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
   * @param options - Email options
   * @returns Result with success flag and messageId
   */
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    this.ensureTransport();

    if (!this.isConfigured || !this.transporter) {
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
   */
  async verifyConnection(): Promise<boolean> {
    this.ensureTransport();
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
   */
  isServiceConfigured(): boolean {
    return this.isConfigured;
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;
