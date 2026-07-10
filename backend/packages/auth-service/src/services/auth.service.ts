import bcrypt from 'bcryptjs';
import { google } from 'googleapis';
import { generateResetToken } from './email-service.js';
import { EmailQueue, prisma } from '@minimeet/shared';
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

      let user = await prisma.user.findFirst({ where: { googleId } });
      if (!user) {
        user = await prisma.user.findUnique({ where: { email } });
        if (user) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { googleId }
          });
        } else {
          user = await prisma.user.create({
            data: { email, googleId }
          });
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
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return {
          message:
            'If an account with that email exists, a password reset link has been sent.',
        };
      }

      const resetToken = generateResetToken();
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpiry
        }
      });

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
            jobId: `password-reset-${user.id}-${Date.now()}`,
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
      const user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpiry: { gt: new Date() },
        }
      });

      if (!user) {
        throw new Error('Invalid or expired reset token');
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null,
        }
      });

      return { message: 'Password reset successfully' };
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  }

  async updateUserProfile(userId: string, updates: any) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new Error('User not found');
      }

      const data: any = {};
      if (updates.name !== undefined) {
        data.name = updates.name.trim();
      }
      if (updates.useNameInMeetings !== undefined) {
        data.useNameInMeetings = updates.useNameInMeetings;
      }

      if (updates.notificationPreferences !== undefined) {
        const prefs = updates.notificationPreferences;

        if (prefs.enabled !== undefined) {
          data.notificationPreferencesEnabled = prefs.enabled;
        }

        if (prefs.channels !== undefined) {
          if (prefs.channels.inApp !== undefined) {
            data.notificationPreferencesChannelsInApp = prefs.channels.inApp;
          }
          if (prefs.channels.email !== undefined) {
            data.notificationPreferencesChannelsEmail = prefs.channels.email;
          }
          if (prefs.channels.push !== undefined) {
            data.notificationPreferencesChannelsPush = prefs.channels.push;
          }
        }

        if (prefs.types !== undefined) {
          if (prefs.types.meetingReminders !== undefined) {
            data.notificationPreferencesTypesMeetingReminders =
              prefs.types.meetingReminders;
          }
          if (prefs.types.meetingInvitations !== undefined) {
            data.notificationPreferencesTypesMeetingInvitations =
              prefs.types.meetingInvitations;
          }
          if (prefs.types.meetingUpdates !== undefined) {
            data.notificationPreferencesTypesMeetingUpdates =
              prefs.types.meetingUpdates;
          }
          if (prefs.types.recordingReady !== undefined) {
            data.notificationPreferencesTypesRecordingReady =
              prefs.types.recordingReady;
          }
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data
      });
      return updatedUser;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }

  async completeUserOnboarding(userId: string, onboardingData: any) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
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

      const data: any = {
        onboardingName: name.trim(),
        onboardingUseCase: useCase,
        onboardingTeamSize: teamSize,
        onboardingPrimaryUse: primaryUse,
        onboardingExperience: experience,
        name: user.name || name.trim(),
        onboardingCompleted: true,
      };

      if (!user.planType) {
        data.planType = 'free';
        data.planStartDate = new Date();
        data.planStatus = 'active';
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data
      });

      try {
        const emailQueue = new EmailQueue();
        await emailQueue.addEmailJob(
          'welcome',
          {
            userId: updatedUser.id.toString(),
            userEmail: updatedUser.email,
            userName: updatedUser.name || '',
          },
          {
            priority: 1,
            jobId: `welcome-email-${updatedUser.id}`,
          }
        );
      } catch (emailError) {
        console.error('Failed to queue welcome email:', emailError);
      }

      return updatedUser;
    } catch (error) {
      console.error('Onboarding completion error:', error);
      throw error;
    }
  }
}
