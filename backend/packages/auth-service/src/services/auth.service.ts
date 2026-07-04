import bcrypt from 'bcryptjs';
// @ts-ignore
import { google } from 'googleapis';
import { models } from '../index.js';
import { generateResetToken } from './email-service.js';
import { EmailQueue } from '@minimeet/shared';
import { generateJWTToken } from '../utils/generate-token.js';

export class AuthService {
  createGoogleClient() {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI ||
        'http://localhost:3000/api/auth/google/callback'
    );
  }

  async handleGoogleOAuth(code: string) {
    try {
      const googleClient = this.createGoogleClient();

      const { tokens } = await googleClient.getToken(code);
      googleClient.setCredentials(tokens);

      if (!tokens.id_token) {
        throw new Error('Google ID token is missing');
      }

      const ticket = (await googleClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      })) as any;

      const payload = ticket.getPayload()!;
      const googleId = payload.sub;
      const email = payload.email!;

      let user = await models.User.findOne({ googleId });
      if (!user) {
        user = await models.User.findOne({ email });
        if (user) {
          user.googleId = googleId;
          await user.save();
        } else {
          user = await models.User.create({ email, googleId });
        }
      }

      const token = generateJWTToken(user);

      return { token };
    } catch (error) {
      console.error('Google OAuth error:', error);
      return { error: 'google_oauth_failed' };
    }
  }

  async handleForgotPassword(email: string) {
    try {
      const user = await models.User.findOne({ email });
      if (!user) {
        return {
          message:
            'If an account with that email exists, a password reset link has been sent.',
        };
      }

      const resetToken = generateResetToken();
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      user.resetToken = resetToken;
      user.resetTokenExpiry = resetTokenExpiry;
      await user.save();

      try {
        const emailQueue = new EmailQueue();
        await emailQueue.addEmailJob(
          'password_reset',
          {
            userEmail: email,
            resetToken,
            userName: user.name || '',
          },
          {
            priority: 1,
            jobId: `password-reset-${user._id}-${Date.now()}`,
          }
        );
      } catch (emailError) {
        console.error('Failed to queue password reset email:', emailError);
        return {
          message:
            'Failed to send password reset email. Please try again later.',
          error: 'EMAIL_SEND_FAILED',
        };
      }

      return {
        message:
          'If an account with that email exists, a password reset link has been sent.',
      };
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  }

  async handlePasswordReset(token: string, newPassword: string) {
    try {
      const user = await models.User.findOne({
        resetToken: token,
        resetTokenExpiry: { $gt: new Date() },
      });

      if (!user) {
        throw new Error('Invalid or expired reset token');
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      user.password = hashedPassword;
      user.resetToken = null;
      user.resetTokenExpiry = null;
      await user.save();

      return { message: 'Password reset successfully' };
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  }

  async updateUserProfile(userId: any, updates: any) {
    try {
      const user = await models.User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (updates.name !== undefined) {
        user.name = updates.name.trim();
      }
      if (updates.useNameInMeetings !== undefined) {
        user.useNameInMeetings = updates.useNameInMeetings;
      }

      if (updates.notificationPreferences !== undefined) {
        const prefs = updates.notificationPreferences;

        if (prefs.enabled !== undefined) {
          user.notificationPreferences.enabled = prefs.enabled;
        }

        if (prefs.channels !== undefined) {
          if (prefs.channels.inApp !== undefined) {
            user.notificationPreferences.channels.inApp = prefs.channels.inApp;
          }
          if (prefs.channels.email !== undefined) {
            user.notificationPreferences.channels.email = prefs.channels.email;
          }
          if (prefs.channels.push !== undefined) {
            user.notificationPreferences.channels.push = prefs.channels.push;
          }
        }

        if (prefs.types !== undefined) {
          if (prefs.types.meetingReminders !== undefined) {
            user.notificationPreferences.types.meetingReminders =
              prefs.types.meetingReminders;
          }
          if (prefs.types.meetingInvitations !== undefined) {
            user.notificationPreferences.types.meetingInvitations =
              prefs.types.meetingInvitations;
          }
          if (prefs.types.meetingUpdates !== undefined) {
            user.notificationPreferences.types.meetingUpdates =
              prefs.types.meetingUpdates;
          }
          if (prefs.types.recordingReady !== undefined) {
            user.notificationPreferences.types.recordingReady =
              prefs.types.recordingReady;
          }
        }
      }

      await user.save();
      return user;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }

  async completeUserOnboarding(userId: any, onboardingData: any) {
    try {
      const user = await models.User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const { name, useCase, teamSize, primaryUse, experience } =
        onboardingData;

      const validUseCases = ['personal', 'education', 'business', 'team'];
      const validTeamSizes = ['1-5', '6-20', '21-50', '50+'];
      const validExperience = ['beginner', 'intermediate', 'advanced'];

      if (!name || typeof name !== 'string') {
        throw new Error('Name is required');
      }
      if (!validUseCases.includes(useCase)) {
        throw new Error('Invalid use case');
      }
      if (
        useCase === 'team' &&
        teamSize &&
        !validTeamSizes.includes(teamSize)
      ) {
        throw new Error('Invalid team size');
      }
      if (!Array.isArray(primaryUse) || primaryUse.length === 0) {
        throw new Error('Select at least one primary use');
      }
      if (!validExperience.includes(experience)) {
        throw new Error('Invalid experience level');
      }

      user.onboarding = {
        name: name.trim(),
        useCase,
        teamSize,
        primaryUse,
        experience,
      };
      user.name = user.name || name.trim();
      user.onboardingCompleted = true;

      if (!user.plan || typeof user.plan === 'string') {
        user.plan = {
          type: 'free',
          startDate: new Date(),
          status: 'active',
        };
      }

      await user.save();

      try {
        const emailQueue = new EmailQueue();
        await emailQueue.addEmailJob(
          'welcome',
          {
            userId: user._id.toString(),
            userEmail: user.email,
            userName: user.name || '',
          },
          {
            priority: 1,
            jobId: `welcome-email-${user._id}`,
          }
        );
      } catch (emailError) {
        console.error('Failed to queue welcome email:', emailError);
      }

      return user;
    } catch (error) {
      console.error('Onboarding completion error:', error);
      throw error;
    }
  }
}
