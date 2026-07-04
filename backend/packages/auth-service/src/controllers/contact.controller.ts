import { Request, Response } from 'express';
// @ts-ignore
import { AppError, ResponseHelpers, EnterpriseInquiry } from '@minimeet/shared';
// @ts-ignore
import nodemailer from 'nodemailer';

/**
 * Contact Controller
 * Handles public contact form submissions (demo requests, sales inquiries)
 */

export class ContactController {
  /**
   * POST /contact/sales - Submit contact sales form
   */
  async contactSales(req: any, res: Response) {
    const {
      name,
      email,
      phone,
      jobTitle,
      companyName,
      companySize,
      industry,
      website,
      country,
      primaryUseCase,
      expectedUsers,
      timeline,
      requirements,
      message,
      isStartup,
      fundingStage,
      source,
      isAuthenticated,
      company,
    } = req.body;

    // Validation
    if (!name || !name.trim()) {
      throw AppError.validation('Name is required');
    }

    if (!email || !email.trim()) {
      throw AppError.validation('Email is required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw AppError.validation('Invalid email format');
    }

    const finalCompanyName = (companyName || company || '').trim();
    if (!finalCompanyName) {
      throw AppError.validation('Company name is required');
    }

    const userId = req.user?._id || null;

    let inquiry: any;
    try {
      inquiry = await EnterpriseInquiry.create({
        name: name.trim(),
        email: email.trim(),
        phone: phone?.trim() || '',
        jobTitle: jobTitle?.trim() || '',
        companyName: finalCompanyName,
        companySize: companySize || '',
        industry: industry || '',
        website: website?.trim() || '',
        country: country?.trim() || '',
        primaryUseCase: primaryUseCase || '',
        expectedUsers: expectedUsers?.trim() || '',
        timeline: timeline || '',
        requirements: requirements?.trim() || '',
        message: message?.trim() || '',
        isStartup: isStartup || false,
        fundingStage: isStartup ? fundingStage || '' : '',
        source: source || 'unknown',
        isAuthenticated: isAuthenticated || false,
        userId: userId,
        status: 'new',
        priority: isStartup ? 'high' : 'medium',
      });
    } catch (dbError) {
      console.error('Failed to save enterprise inquiry:', dbError);
    }

    const salesEmailHtml = this._generateSalesEmailHtml({
      inquiryId: inquiry?._id?.toString(),
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim(),
      jobTitle: jobTitle?.trim(),
      companyName: finalCompanyName,
      companySize,
      industry,
      website: website?.trim(),
      country: country?.trim(),
      primaryUseCase,
      expectedUsers: expectedUsers?.trim(),
      timeline,
      requirements: requirements?.trim(),
      message: message?.trim(),
      isStartup,
      fundingStage,
      source,
      isAuthenticated,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    const salesEmailText = this._generateSalesEmailText({
      inquiryId: inquiry?._id?.toString(),
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim(),
      jobTitle: jobTitle?.trim(),
      companyName: finalCompanyName,
      companySize,
      industry,
      primaryUseCase,
      expectedUsers: expectedUsers?.trim(),
      timeline,
      message: message?.trim(),
      isStartup,
      fundingStage,
    });

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
      port: parseInt(process.env.SMTP_PORT || '587'),
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
      const priorityPrefix = isStartup ? '[STARTUP] ' : '';
      const inquiryIdSuffix = inquiry?._id
        ? ` [#${inquiry._id.toString().slice(-6)}]`
        : '';

      await transporter.sendMail({
        from: `${fromName} <${fromEmail}>`,
        to: salesEmail,
        subject: `${priorityPrefix}New Enterprise Inquiry from ${finalCompanyName}${inquiryIdSuffix}`,
        html: salesEmailHtml,
        text: salesEmailText,
      });

      const confirmationHtml = this._generateConfirmationEmailHtml({
        name: name.trim(),
        isStartup,
      });

      const confirmationText = this._generateConfirmationEmailText({
        name: name.trim(),
        isStartup,
      });

      await transporter.sendMail({
        from: `${fromName} <${fromEmail}>`,
        to: email.trim(),
        subject: 'Thank you for contacting MeetLite Sales',
        html: confirmationHtml,
        text: confirmationText,
      });

      return ResponseHelpers.ok(res, {
        message:
          "Your inquiry has been submitted successfully. We'll contact you within 24 hours!",
        inquiryId: inquiry?._id?.toString(),
      });
    } catch (error) {
      console.error('Failed to send contact sales email:', error);
      throw AppError.internal(
        'Failed to send message. Please try again later.'
      );
    }
  }

  /**
   * Generate HTML email for sales team
   */
  _generateSalesEmailHtml(data: any) {
    const {
      inquiryId,
      name,
      email,
      phone,
      jobTitle,
      companyName,
      companySize,
      industry,
      website,
      country,
      primaryUseCase,
      expectedUsers,
      timeline,
      requirements,
      message,
      isStartup,
      fundingStage,
      source,
      isAuthenticated,
      ip,
    } = data;

    const adminUrl = process.env.CLIENT_URL || 'http://localhost:5174';
    const inquiryLink = inquiryId
      ? `${adminUrl}/admin/inquiries?id=${inquiryId}`
      : null;

    const formatValue = (label: string, value: any) =>
      value
        ? `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: #666;">${label}</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${value}</td></tr>`
        : '';

    const formatUseCase = (uc: string) => {
      const labels: any = {
        team_meetings: 'Team Meetings',
        client_calls: 'Client Calls',
        webinars: 'Webinars & Events',
        training: 'Training & Onboarding',
        remote_work: 'Remote Work Collaboration',
        sales_demos: 'Sales Demos',
        support: 'Customer Support',
        education: 'Education & Learning',
        other: 'Other',
      };
      return labels[uc] || uc;
    };

    const formatTimeline = (tl: string) => {
      const labels: any = {
        immediate: 'Immediately',
        '1-month': 'Within 1 month',
        '1-3-months': '1-3 months',
        '3-6-months': '3-6 months',
        '6-months+': '6+ months',
        'just-exploring': 'Just exploring',
      };
      return labels[tl] || tl;
    };

    const formatIndustry = (ind: string) => {
      const labels: any = {
        technology: 'Technology',
        healthcare: 'Healthcare',
        finance: 'Finance & Banking',
        education: 'Education',
        retail: 'Retail & E-commerce',
        manufacturing: 'Manufacturing',
        media: 'Media & Entertainment',
        consulting: 'Consulting',
        nonprofit: 'Non-profit',
        government: 'Government',
        startup: 'Startup',
        other: 'Other',
      };
      return labels[ind] || ind;
    };

    return `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; background-color: #f9f9f9; padding: 20px;">
        <div style="background-color: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">
          <div style="background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); color: #fff; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">New Enterprise Inquiry</h1>
            ${isStartup ? '<p style="margin: 10px 0 0; background: #fbbf24; color: #000; display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold;">STARTUP</p>' : ''}
            ${inquiryId ? `<p style="margin: 10px 0 0; font-size: 12px; opacity: 0.8;">ID: ${inquiryId}</p>` : ''}
          </div>

          <div style="padding: 20px;">
            <h2 style="color: #333; font-size: 16px; margin: 0 0 15px; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">Contact Information</h2>
            <table style="width: 100%; border-collapse: collapse;">
              ${formatValue('Name', name)}
              ${formatValue('Email', `<a href="mailto:${email}" style="color: #7c3aed;">${email}</a>`)}
              ${formatValue('Phone', phone)}
              ${formatValue('Job Title', jobTitle)}
            </table>
          </div>

          <div style="padding: 0 20px 20px;">
            <h2 style="color: #333; font-size: 16px; margin: 0 0 15px; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">Company Information</h2>
            <table style="width: 100%; border-collapse: collapse;">
              ${formatValue('Company', companyName)}
              ${formatValue('Size', companySize)}
              ${formatValue('Industry', formatIndustry(industry))}
              ${formatValue('Website', website ? `<a href="${website}" style="color: #7c3aed;">${website}</a>` : '')}
              ${formatValue('Country', country)}
            </table>
          </div>

          <div style="padding: 0 20px 20px;">
            <h2 style="color: #333; font-size: 16px; margin: 0 0 15px; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">Requirements</h2>
            <table style="width: 100%; border-collapse: collapse;">
              ${formatValue('Use Case', formatUseCase(primaryUseCase))}
              ${formatValue('Expected Users', expectedUsers)}
              ${formatValue('Timeline', formatTimeline(timeline))}
            </table>
          </div>

          ${
            isStartup
              ? `
          <div style="padding: 0 20px 20px;">
            <h2 style="color: #333; font-size: 16px; margin: 0 0 15px; border-bottom: 2px solid #fbbf24; padding-bottom: 8px;">🚀 Startup Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
              ${formatValue('Funding Stage', fundingStage)}
            </table>
          </div>
          `
              : ''
          }

          ${
            message || requirements
              ? `
          <div style="padding: 0 20px 20px;">
            <h2 style="color: #333; font-size: 16px; margin: 0 0 15px; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">Additional Information</h2>
            ${requirements ? `<p style="color: #666; margin: 0 0 10px;"><strong>Requirements:</strong> ${requirements}</p>` : ''}
            ${message ? `<p style="color: #666; white-space: pre-wrap; margin: 0;"><strong>Message:</strong><br>${message}</p>` : ''}
          </div>
          `
              : ''
          }

          <div style="background-color: #f5f5f5; padding: 15px 20px; border-top: 1px solid #eee;">
            <p style="color: #888; font-size: 12px; margin: 0;">
              Source: ${source || 'Unknown'} | 
              ${isAuthenticated ? 'Authenticated User' : 'Guest User'} | 
              IP: ${ip || 'Unknown'}<br>
              Submitted: ${new Date().toISOString()}
            </p>
            ${inquiryLink ? `<p style="margin: 10px 0 0;"><a href="${inquiryLink}" style="background: #7c3aed; color: #fff; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block; font-size: 14px;">View in Admin</a></p>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generate plain text email for sales team
   */
  _generateSalesEmailText(data: any) {
    const {
      inquiryId,
      name,
      email,
      phone,
      jobTitle,
      companyName,
      companySize,
      industry,
      primaryUseCase,
      expectedUsers,
      timeline,
      message,
      isStartup,
      fundingStage,
    } = data;

    return `
NEW ENTERPRISE INQUIRY${isStartup ? ' [STARTUP]' : ''}
${inquiryId ? `ID: ${inquiryId}` : ''}
=================================

CONTACT INFORMATION
-------------------
Name: ${name}
Email: ${email}
${phone ? `Phone: ${phone}` : ''}
${jobTitle ? `Job Title: ${jobTitle}` : ''}

COMPANY INFORMATION
-------------------
Company: ${companyName}
${companySize ? `Size: ${companySize}` : ''}
${industry ? `Industry: ${industry}` : ''}

REQUIREMENTS
------------
${primaryUseCase ? `Use Case: ${primaryUseCase}` : ''}
${expectedUsers ? `Expected Users: ${expectedUsers}` : ''}
${timeline ? `Timeline: ${timeline}` : ''}

${isStartup ? `STARTUP DETAILS\n---------------\nFunding Stage: ${fundingStage || 'Not specified'}\n` : ''}

${message ? `MESSAGE\n-------\n${message}` : ''}

Submitted: ${new Date().toISOString()}
    `.trim();
  }

  /**
   * Generate HTML confirmation email for user
   */
  _generateConfirmationEmailHtml({ name, isStartup }: { name: string; isStartup: boolean }) {
    const startupMessage = isStartup
      ? `<p style="background: #fef3c7; border: 1px solid #fcd34d; padding: 12px; border-radius: 6px; margin: 20px 0;">
          🚀 <strong>Startup Program:</strong> We noticed you're a startup! We have special pricing and packages for early-stage companies. Our team will discuss options with you.
        </p>`
      : '';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px;">
        <div style="background-color: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 30px;">
          <h2 style="color: #333; margin-top: 0;">Thank you for contacting MeetLite Sales!</h2>
          <p style="color: #555;">Hi ${name},</p>
          <p style="color: #555;">We've received your inquiry and our sales team will get back to you within 24 hours.</p>
          ${startupMessage}
          <p style="color: #555;">In the meantime, feel free to:</p>
          <ul style="color: #555;">
            <li>Explore our <a href="${process.env.CLIENT_URL}/features" style="color: #7c3aed;">features</a></li>
            <li>Check out our <a href="${process.env.CLIENT_URL}/pricing" style="color: #7c3aed;">pricing</a></li>
            <li>Schedule a <a href="${process.env.CLIENT_URL}/demo" style="color: #7c3aed;">product demo</a></li>
          </ul>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            Best regards,<br>
            The MeetLite Team
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Generate plain text confirmation email for user
   */
  _generateConfirmationEmailText({ name, isStartup }: { name: string; isStartup: boolean }) {
    const startupMessage = isStartup
      ? `

STARTUP PROGRAM
We noticed you're a startup! We have special pricing and packages for early-stage companies. Our team will discuss options with you.
`
      : '';

    return `
Thank you for contacting MeetLite Sales!

Hi ${name},

We've received your inquiry and our sales team will get back to you within 24 hours.
${startupMessage}
In the meantime, feel free to explore our features or schedule a demo.

Best regards,
The MeetLite Team
    `.trim();
  }
}
export default ContactController;
