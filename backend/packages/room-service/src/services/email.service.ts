import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Email Service
 * Centralized email sending functionality
 */

let transporter: nodemailer.Transporter | null = null;

/**
 * Initialize email transporter
 */
const getTransporter = (): nodemailer.Transporter => {
  if (transporter) {
    return transporter;
  }

  // Check if SMTP is properly configured
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS ||
    !process.env.SMTP_FROM
  ) {
    throw new Error('SMTP configuration incomplete');
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email
 * @param {SendEmailParams} options - Email options
 * @returns {Promise<void>}
 */
export const sendEmail = async ({ to, subject, html, text }: SendEmailParams): Promise<void> => {
  try {
    const emailTransporter = getTransporter();
    const fromEmail = process.env.SMTP_FROM;
    const fromName = process.env.SMTP_FROM_NAME || 'MeetLite';

    const mailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text fallback
    };

    await emailTransporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}`);
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error);
    throw error;
  }
};

/**
 * Verify SMTP connection
 * @returns {Promise<boolean>}
 */
export const verifyEmailConnection = async (): Promise<boolean> => {
  try {
    const emailTransporter = getTransporter();
    await emailTransporter.verify();
    return true;
  } catch (error) {
    console.error('❌ SMTP verification failed:', error);
    return false;
  }
};

export default {
  sendEmail,
  verifyEmailConnection,
};
