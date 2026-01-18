import { AppError, ResponseHelpers } from '@minimeet/shared';
import nodemailer from 'nodemailer';

/**
 * Contact Controller
 * Handles public contact form submissions (demo requests, sales inquiries)
 */

export class ContactController {
  /**
   * POST /contact/sales - Submit contact sales form
   * Public endpoint - no authentication required
   * Protected by rate limiting
   */
  async contactSales(req, res) {
    const { name, email, company, message } = req.body;

    // Validation
    if (!name || !name.trim()) {
      throw AppError.validation('Name is required');
    }

    if (!email || !email.trim()) {
      throw AppError.validation('Email is required');
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw AppError.validation('Invalid email format');
    }

    // Prepare email content for sales team
    const salesEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Sales Inquiry</h2>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Name:</strong> ${name.trim()}</p>
          <p><strong>Email:</strong> ${email.trim()}</p>
          ${company ? `<p><strong>Company:</strong> ${company.trim()}</p>` : ''}
          ${message ? `<p><strong>Message:</strong></p><p style="white-space: pre-wrap;">${message.trim()}</p>` : ''}
        </div>
        <p style="color: #666; font-size: 12px;">
          Submitted from: ${req.ip}<br>
          User Agent: ${req.get('user-agent') || 'Unknown'}<br>
          Timestamp: ${new Date().toISOString()}
        </p>
      </div>
    `;

    const salesEmailText = `
New Sales Inquiry

Name: ${name.trim()}
Email: ${email.trim()}
${company ? `Company: ${company.trim()}` : ''}
${message ? `\nMessage:\n${message.trim()}` : ''}

Submitted from: ${req.ip}
Timestamp: ${new Date().toISOString()}
    `;

    // Create email transporter
    if (
      !process.env.SMTP_HOST ||
      !process.env.SMTP_USER ||
      !process.env.SMTP_PASS ||
      !process.env.SMTP_FROM
    ) {
      throw AppError.internal('Email service not configured');
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const fromName = process.env.SMTP_FROM_NAME || 'MeetLite';
    const fromEmail = process.env.SMTP_FROM;
    const salesEmail = process.env.SALES_EMAIL || process.env.SMTP_FROM;
    
    try {
      // Send email to sales team
      await transporter.sendMail({
        from: `${fromName} <${fromEmail}>`,
        to: salesEmail,
        subject: `New Sales Inquiry from ${name.trim()}`,
        html: salesEmailHtml,
        text: salesEmailText,
      });

      // Send confirmation email to user
      const confirmationHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Thank you for contacting MeetLite Sales!</h2>
          <p>Hi ${name.trim()},</p>
          <p>We've received your inquiry and our sales team will get back to you within 24 hours.</p>
          <p>In the meantime, feel free to explore our features or schedule a demo.</p>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            Best regards,<br>
            The MeetLite Team
          </p>
        </div>
      `;

      const confirmationText = `
Thank you for contacting MeetLite Sales!

Hi ${name.trim()},

We've received your inquiry and our sales team will get back to you within 24 hours.

In the meantime, feel free to explore our features or schedule a demo.

Best regards,
The MeetLite Team
      `;

      await transporter.sendMail({
        from: `${fromName} <${fromEmail}>`,
        to: email.trim(),
        subject: 'Thank you for contacting MeetLite Sales',
        html: confirmationHtml,
        text: confirmationText,
      });

      return ResponseHelpers.ok(res, {
        message: 'Your message has been sent successfully. We\'ll contact you soon!',
      });
    } catch (error) {
      console.error('Failed to send contact sales email:', error);
      throw AppError.internal('Failed to send message. Please try again later.');
    }
  }
}

