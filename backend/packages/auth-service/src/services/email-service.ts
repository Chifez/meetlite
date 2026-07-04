import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { getWelcomeEmailTemplate } from '../templates/welcome-email.js';
import { getPasswordResetEmailTemplate } from '../templates/password-reset-email.js';
import { getOrganizationInviteEmailTemplate } from '../templates/organization-invite-email.js';
import { getTeamInviteEmailTemplate } from '../templates/team-invite-email.js';
import { getPlanUpgradeEmailTemplate } from '../templates/plan-upgrade-email.js';
import { getPlanCancellationEmailTemplate } from '../templates/plan-cancellation-email.js';
import { getPlanExpirationWarningEmailTemplate } from '../templates/plan-expiration-warning-email.js';

const createTransport = () => {
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
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

export const sendWelcomeEmail = async (userEmail: string, userName = '') => {
  try {
    const transporter = createTransport();
    const template = getWelcomeEmailTemplate(userName);
    const fromName = process.env.SMTP_FROM_NAME || 'MeetLite';

    const emailContent = {
      from: `${fromName} <${process.env.SMTP_FROM}>`,
      to: userEmail,
      subject: template.subject,
      html: template.html,
    };

    await transporter.sendMail(emailContent);
  } catch (error) {
    console.error('Welcome email error:', error);
    throw error;
  }
};

export const sendPasswordResetEmail = async (
  userEmail: string,
  resetToken: string,
  userName = ''
) => {
  try {
    const transporter = createTransport();
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    const template = getPasswordResetEmailTemplate(resetUrl, userName);
    const fromName = process.env.SMTP_FROM_NAME || 'MeetLite';

    const emailContent = {
      from: `${fromName} <${process.env.SMTP_FROM}>`,
      to: userEmail,
      subject: template.subject,
      html: template.html,
    };

    await transporter.sendMail(emailContent);
  } catch (error) {
    console.error('Password reset email error:', error);
    throw error;
  }
};

export const generateResetToken = () => {
  return uuidv4();
};

export const sendOrganizationInviteEmail = async (payload: {
  email: string;
  organizationName: string;
  inviteToken: string;
  message?: string;
  inviterName?: string;
  inviterEmail?: string;
  role?: string;
}) => {
  try {
    const {
      email,
      organizationName,
      inviteToken,
      message = '',
      inviterName = 'Admin',
      inviterEmail = '',
      role = 'member',
    } = payload;

    const transporter = createTransport();
    const inviteUrl = `${process.env.CLIENT_URL}/invite/${inviteToken}`;
    const fromName = process.env.SMTP_FROM_NAME || 'MeetLite';

    const template = getOrganizationInviteEmailTemplate(
      organizationName,
      inviterName,
      inviterEmail,
      inviteUrl,
      message,
      role
    );

    const emailContent = {
      from: `${fromName} <${process.env.SMTP_FROM}>`,
      to: email,
      subject: template.subject,
      html: template.html,
    };

    await transporter.sendMail(emailContent);
  } catch (error) {
    console.error('Organization invite email error:', error);
    throw error;
  }
};

export const sendPlanUpgradeEmail = async (
  userEmail: string,
  userName: string,
  planType: string,
  endDate: Date | null
) => {
  try {
    const transporter = createTransport();
    const template = getPlanUpgradeEmailTemplate(userName, planType, endDate);
    const fromName = process.env.SMTP_FROM_NAME || 'MeetLite';

    const emailContent = {
      from: `${fromName} <${process.env.SMTP_FROM}>`,
      to: userEmail,
      subject: template.subject,
      html: template.html,
    };

    await transporter.sendMail(emailContent);
  } catch (error) {
    console.error('Plan upgrade email error:', error);
    throw error;
  }
};

export const sendPlanCancellationEmail = async (
  userEmail: string,
  userName: string,
  planType: string,
  endDate: Date | null
) => {
  try {
    const transporter = createTransport();
    const template = getPlanCancellationEmailTemplate(
      userName,
      planType,
      endDate
    );
    const fromName = process.env.SMTP_FROM_NAME || 'MeetLite';

    const emailContent = {
      from: `${fromName} <${process.env.SMTP_FROM}>`,
      to: userEmail,
      subject: template.subject,
      html: template.html,
    };

    await transporter.sendMail(emailContent);
  } catch (error) {
    console.error('Plan cancellation email error:', error);
    throw error;
  }
};

export const sendPlanExpirationWarningEmail = async (
  userEmail: string,
  userName: string,
  planType: string,
  daysRemaining: number
) => {
  try {
    const transporter = createTransport();
    const template = getPlanExpirationWarningEmailTemplate(
      userName,
      planType,
      daysRemaining
    );
    const fromName = process.env.SMTP_FROM_NAME || 'MeetLite';

    const emailContent = {
      from: `${fromName} <${process.env.SMTP_FROM}>`,
      to: userEmail,
      subject: template.subject,
      html: template.html,
    };

    await transporter.sendMail(emailContent);
  } catch (error) {
    console.error('Plan expiration warning email error:', error);
    throw error;
  }
};

export const sendTeamInvitationEmail = async (payload: {
  email: string;
  teamName: string;
  organizationName: string;
  inviterName: string;
  inviterEmail: string;
  inviteUrl: string;
  message?: string;
  role?: string;
}) => {
  try {
    const {
      email,
      teamName,
      organizationName,
      inviterName,
      inviterEmail,
      inviteUrl,
      message = '',
      role = 'member',
    } = payload;

    const transporter = createTransport();
    const template = getTeamInviteEmailTemplate(
      teamName,
      organizationName,
      inviterName,
      inviterEmail,
      inviteUrl,
      message,
      role
    );
    const fromName = process.env.SMTP_FROM_NAME || 'MeetLite';

    const emailContent = {
      from: `${fromName} <${process.env.SMTP_FROM}>`,
      to: email,
      subject: template.subject,
      html: template.html,
    };

    await transporter.sendMail(emailContent);
  } catch (error) {
    console.error('Team invitation email error:', error);
    throw error;
  }
};
