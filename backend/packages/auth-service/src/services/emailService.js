import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { getWelcomeEmailTemplate } from '../templates/welcomeEmail.js';
import { getPasswordResetEmailTemplate } from '../templates/passwordResetEmail.js';

// Email service configuration - following room-service pattern
const createTransport = () => {
  // Check if SMTP is properly configured
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS ||
    !process.env.SMTP_FROM
  ) {
    throw new Error('SMTP configuration incomplete');
  }

  const fromEmail = process.env.SMTP_FROM;
  if (!fromEmail) {
    throw new Error('Host email configuration missing');
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Email templates are now imported from separate files

// Email service functions - following room-service pattern
export const sendWelcomeEmail = async (userEmail, userName = '') => {
  try {
    const transporter = createTransport();
    const template = getWelcomeEmailTemplate(userName);

    const emailContent = {
      from: process.env.SMTP_FROM,
      to: userEmail,
      subject: template.subject,
      html: template.html,
    };

    await transporter.sendMail(emailContent);
    console.log(`Welcome email sent to ${userEmail}`);
  } catch (error) {
    console.error('Welcome email error:', error);
    throw error;
  }
};

export const sendPasswordResetEmail = async (
  userEmail,
  resetToken,
  userName = ''
) => {
  try {
    const transporter = createTransport();
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    const template = getPasswordResetEmailTemplate(resetUrl, userName);

    const emailContent = {
      from: 'noreply@meetlite.app',
      to: userEmail,
      subject: template.subject,
      html: template.html,
    };

    await transporter.sendMail(emailContent);
    console.log(`Password reset email sent to ${userEmail}`);
  } catch (error) {
    console.error('Password reset email error:', error);
    throw error;
  }
};

export const generateResetToken = () => {
  return uuidv4();
};
