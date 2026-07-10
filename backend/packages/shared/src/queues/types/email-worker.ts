import { Job } from 'bullmq';
import { BaseWorker } from '../base/base-worker.js';
import { decryptJobData } from '../utils/encryption.js';
import { emailService } from '../../services/email.service.js';

export interface EmailWorkerDependencies {
  User?: any;
  emailTemplates: Record<string, (data: any) => any>;
  auditEmailSent?: any;
  auditEmailFailed?: any;
}

/**
 * Email Worker
 * Processes email jobs from EmailQueue
 */
export class EmailWorker extends BaseWorker {
  private User: any;
  private emailTemplates: Record<string, (data: any) => any>;
  private auditEmailSent: any;
  private auditEmailFailed: any;

  constructor(dependencies: EmailWorkerDependencies, options: Record<string, any> = {}) {
    const { User, emailTemplates, auditEmailSent, auditEmailFailed } = dependencies;

    if (!emailTemplates) {
      throw new Error('Email templates are required');
    }

    const processJob = async function (this: EmailWorker, job: Job) {
      return await this.processEmailJob(job);
    };

    super('emails', processJob, {
      db: parseInt(process.env.BULL_REDIS_DB || '1'),
      prefix: 'bull:emails',
      concurrency: parseInt(process.env.EMAIL_WORKER_CONCURRENCY || '10'),
      limiter: {
        max: parseInt(process.env.EMAIL_RATE_LIMIT || '100'),
        duration: 60000,
      },
      ...options,
    });

    this.User = User;
    this.emailTemplates = emailTemplates;
    this.auditEmailSent = auditEmailSent;
    this.auditEmailFailed = auditEmailFailed;
  }

  /**
   * Process email job
   * @param job - BullMQ job
   * @returns Result
   */
  async processEmailJob(job: Job): Promise<any> {
    const jobData = decryptJobData(job.data);
    const { type, userId, userEmail, ...emailData } = jobData;

    try {
      // Get user for personalization
      const user =
        userId && this.User ? await this.User.findUnique({ where: { id: userId } }) : null;

      // Get email template based on type
      const template = this.getEmailTemplate(type, {
        user,
        userEmail: userEmail || user?.email,
        ...emailData,
      });

      if (!template) {
        throw new Error(`Email template not found for type: ${type}`);
      }

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
          userId: user?.id,
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
    } catch (error: any) {
      // Audit log failure
      if (this.auditEmailFailed) {
        await this.auditEmailFailed({
          userId,
          emailType: type,
          recipientEmail: userEmail,
          error: error.message,
        });
      }

      throw error;
    }
  }

  /**
   * Get email template based on type
   * @param type - Email type
   * @param data - Template data
   * @returns Template object with subject, html, text
   */
  getEmailTemplate(type: string, data: any): Record<string, any> | null {
    const templateFn = this.emailTemplates[type];

    if (!templateFn || typeof templateFn !== 'function') {
      console.warn(`⚠️  Email template not found for type: ${type}`);
      return null;
    }

    try {
      const template = templateFn(data);

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
export default EmailWorker;
