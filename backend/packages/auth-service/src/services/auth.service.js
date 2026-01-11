import bcrypt from 'bcryptjs';
import { google } from 'googleapis';
import { models } from '../index.js';
import { generateResetToken } from './email-service.js';
import { EmailQueue } from '@minimeet/shared';

export class AuthService {
  // Helper function to create Google OAuth client
  createGoogleClient() {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI ||
        'http://localhost:3000/api/auth/google/callback'
    );
  }

  // Handle Google OAuth
  async handleGoogleOAuth(code) {
    try {
      const googleClient = this.createGoogleClient();

      // Exchange code for tokens
      const { tokens } = await googleClient.getToken(code);
      googleClient.setCredentials(tokens);

      // Get user info from Google
      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      const googleId = payload.sub;
      const email = payload.email;

      // Find or create user
      let user = await models.User.findOne({ googleId });
      if (!user) {
        // If user with this email exists, link Google account
        user = await models.User.findOne({ email });
        if (user) {
          user.googleId = googleId;
          await user.save();
        } else {
          user = await models.User.create({ email, googleId });
        }
      }

      // Generate JWT token
      const { generateJWTToken } = await import('../utils/generate-token.js');
      const token = generateJWTToken(user);

      return { token };
    } catch (error) {
      console.error('Google OAuth error:', error);
      return { error: 'google_oauth_failed' };
    }
  }

  // Handle forgot password
  async handleForgotPassword(email) {
    try {
      // Check if user exists
      const user = await models.User.findOne({ email });
      if (!user) {
        // Don't reveal if user exists or not for security
        return {
          message:
            'If an account with that email exists, a password reset link has been sent.',
        };
      }

      // Generate reset token
      const resetToken = generateResetToken();
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Save reset token to user
      user.resetToken = resetToken;
      user.resetTokenExpiry = resetTokenExpiry;
      await user.save();

      // Queue password reset email
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
        // Return error if email fails, but don't reveal if user exists
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

  // Handle password reset
  async handlePasswordReset(token, newPassword) {
    try {
      // Find user with valid reset token
      const user = await models.User.findOne({
        resetToken: token,
        resetTokenExpiry: { $gt: new Date() },
      });

      if (!user) {
        throw new Error('Invalid or expired reset token');
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Update user password and clear reset token
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

  // Update user profile
  async updateUserProfile(userId, updates) {
    try {
      const user = await models.User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Update user fields
      if (updates.name !== undefined) {
        user.name = updates.name.trim();
      }
      if (updates.useNameInMeetings !== undefined) {
        user.useNameInMeetings = updates.useNameInMeetings;
      }

      // Update notification preferences
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

  // Complete user onboarding
  async completeUserOnboarding(userId, onboardingData) {
    try {
      const user = await models.User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const { name, useCase, teamSize, primaryUse, experience } =
        onboardingData;

      // Basic validation
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

      // Persist onboarding data
      user.onboarding = {
        name: name.trim(),
        useCase,
        teamSize,
        primaryUse,
        experience,
      };
      user.name = user.name || name.trim();
      user.onboardingCompleted = true;

      // Initialize plan if not set
      if (!user.plan || typeof user.plan === 'string') {
        user.plan = {
          type: 'free',
          startDate: new Date(),
          status: 'active',
        };
      }

      await user.save();

      // Queue welcome email
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
        // Do not fail the onboarding request due to email errors
      }

      return user;
    } catch (error) {
      console.error('Onboarding completion error:', error);
      throw error;
    }
  }
}
