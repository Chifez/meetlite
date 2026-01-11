import { BaseWorker } from '../base/base-worker.js';
import { decryptJobData } from '../utils/encryption.js';
import { emailService } from '../../services/email.service.js';

/**
 * Email Worker
 * Processes email jobs from EmailQueue
 *
 * Note: This worker requires external dependencies to be injected:
 * - User model (from shared models)
 * - Email templates object with template functions
 * - Audit service functions (optional)
 */
export class EmailWorker extends BaseWorker {
  constructor(dependencies, options = {}) {
    const { User, emailTemplates, auditEmailSent, auditEmailFailed } =
      dependencies;

    if (!emailTemplates) {
      throw new Error('Email templates are required');
    }

    // Store dependencies in a closure to avoid accessing 'this' before super()
    const workerDeps = {
      User,
      emailTemplates,
      auditEmailSent,
      auditEmailFailed,
    };

    // Process job handler - will be called by BaseWorker with 'this' bound
    const processJob = async (job) => {
      return await this.processEmailJob(job);
    };

    super('emails', processJob, {
      db: parseInt(process.env.BULL_REDIS_DB || '1'),
      prefix: 'bull:emails',
      concurrency: parseInt(process.env.EMAIL_WORKER_CONCURRENCY || '10'),
      limiter: {
        max: parseInt(process.env.EMAIL_RATE_LIMIT || '100'),
        duration: 60000, // Per minute
      },
      ...options,
    });

    // Store dependencies on instance after super() call
    this.User = User;
    this.emailTemplates = emailTemplates;
    this.auditEmailSent = auditEmailSent;
    this.auditEmailFailed = auditEmailFailed;
  }

  /**
   * Process email job
   * @param {Object} job - BullMQ job
   * @returns {Promise<Object>}
   */
  async processEmailJob(job) {
    const jobData = decryptJobData(job.data);
    const { type, userId, userEmail, ...emailData } = jobData;

    try {
      // Get user for personalization (if userId provided)
      const user =
        userId && this.User ? await this.User.findById(userId).lean() : null;

      // Get email template based on type
      const template = this.getEmailTemplate(type, {
        user,
        userEmail: userEmail || user?.email,
        ...emailData,
      });

      if (!template) {
        throw new Error(`Email template not found for type: ${type}`);
      }

      // Send email
      const recipientEmail = userEmail || user?.email;
      if (!recipientEmail) {
        throw new Error('No recipient email provided');
      }

      const result = await emailService.sendEmail({
        to: recipientEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
        attachments: template.attachments,
      });

      // Audit log success
      if (this.auditEmailSent) {
        await this.auditEmailSent({
          userId: user?._id?.toString(),
          emailType: type,
          recipientEmail,
          messageId: result.messageId,
        });
      }

      return {
        success: true,
        messageId: result.messageId,
        recipientEmail,
      };
    } catch (error) {
      // Audit log failure
      if (this.auditEmailFailed) {
        await this.auditEmailFailed({
          userId,
          emailType: type,
          recipientEmail: userEmail,
          error: error.message,
        });
      }

      // Re-throw error for BullMQ retry logic
      throw error;
    }
  }

  /**
   * Get email template based on type
   * @param {string} type - Email type
   * @param {Object} data - Template data
   * @returns {Object|null} Template object with subject, html, text
   */
  getEmailTemplate(type, data) {
    const templateFn = this.emailTemplates[type];

    if (!templateFn || typeof templateFn !== 'function') {
      console.warn(`⚠️  Email template not found for type: ${type}`);
      return null;
    }

    try {
      const template = templateFn(data);

      // Ensure template has required fields
      if (!template || !template.subject || !template.html) {
        throw new Error(`Invalid template structure for type: ${type}`);
      }

      return {
        subject: template.subject,
        html: template.html,
        text: template.text || template.html?.replace(/<[^>]*>/g, ''),
        attachments: template.attachments,
      };
    } catch (error) {
      console.error(`❌ Error generating template for type ${type}:`, error);
      throw error;
    }
  }
}
