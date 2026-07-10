import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
// @ts-ignore
import jwt from 'jsonwebtoken';
import { prisma } from '@minimeet/shared';
import { AuthService } from '../services/auth.service.js';
import { generateJWTToken } from '../utils/generate-token.js';
import { sanitizePlan } from '../utils/sanitize-plan.js';
import { AppError } from '@minimeet/shared';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  // Signup
  async signup(req: Request, res: Response) {
    const { email, password } = req.body;

    if (!email || !password) {
      throw AppError.validation('Email and password are required');
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError(
        'USER_2002',
        `User with email '${email}' already exists`
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
      }
    });

    const token = generateJWTToken(user);

    res.status(201).json({ token });
  }

  // Login
  async login(req: Request, res: Response) {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw AppError.unauthorized('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw AppError.unauthorized('Invalid credentials');
    }

    const token = generateJWTToken(user);

    res.json({ token });
  }

  // Refresh token
  async refreshToken(req: Request, res: Response) {
    const { token } = req.body;

    if (!token) {
      throw AppError.validation('Token is required');
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!, {
        ignoreExpiration: true,
      });
    } catch (error) {
      throw AppError.unauthorized('Invalid token');
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      throw AppError.unauthorized('User not found');
    }

    if (decoded.tokenVersion && decoded.tokenVersion !== user.tokenVersion) {
      throw AppError.unauthorized('Token has been invalidated');
    }

    const newToken = generateJWTToken(user);

    res.json({ token: newToken });
  }

  // Validate token
  async validateToken(req: Request, res: Response) {
    const { token } = req.body;

    if (!token) {
      throw AppError.validation('Token is required');
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      throw AppError.unauthorized('User not found');
    }

    if (decoded.tokenVersion && decoded.tokenVersion !== user.tokenVersion) {
      throw AppError.unauthorized('Token has been invalidated');
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        useNameInMeetings: user.useNameInMeetings,
        onboardingCompleted: user.onboardingCompleted,
        onboarding: {
          useCase: user.onboardingUseCase,
          teamSize: user.onboardingTeamSize,
          experience: user.onboardingExperience,
        },
        organizationId: user.organizationId,
        role: user.role,
        plan: sanitizePlan({
          type: user.planType,
          status: user.planStatus,
          startDate: user.planStartDate,
          endDate: user.planEndDate,
        }),
        createdAt: user.createdAt,
      },
      expiresAt: decoded.exp,
    });
  }

  // Validate reset token
  async validateResetToken(req: Request, res: Response) {
    const { token } = req.body;
    if (!token) {
      throw AppError.validation('Token is required');
    }
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      }
    });
    if (!user) {
      throw AppError.validation('Invalid or expired reset token');
    }
    res.json({ valid: true });
  }

  // Google OAuth initiation
  async initiateGoogleAuth(req: Request, res: Response) {
    const googleClient = this.authService.createGoogleClient();
    const url = googleClient.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['profile', 'email'],
    });
    res.redirect(url);
  }

  // Google OAuth callback
  async handleGoogleCallback(req: Request, res: Response) {
    const { code } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    if (!code) {
      return res.redirect(`${frontendUrl}/login?error=no_code_provided`);
    }

    const result = await this.authService.handleGoogleOAuth(code as string);
    const { token, error } = result;

    if (error) {
      return res.redirect(`${frontendUrl}/login?error=${error}`);
    }

    res.redirect(`${frontendUrl}/login?token=${token}`);
  }

  // Forgot password
  async forgotPassword(req: Request, res: Response) {
    const { email } = req.body;

    if (!email) {
      throw AppError.validation('Email is required');
    }

    const result = await this.authService.handleForgotPassword(email);
    res.json(result);
  }

  // Reset password
  async resetPassword(req: Request, res: Response) {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      throw AppError.validation('Token and new password are required');
    }

    if (newPassword.length < 6) {
      throw AppError.validation('Password must be at least 6 characters long');
    }

    const result = await this.authService.handlePasswordReset(
      token,
      newPassword
    );
    res.json(result);
  }

  // Update profile
  async updateProfile(req: any, res: Response) {
    const { name, useNameInMeetings, notificationPreferences } = req.body;

    let user;
    if (req.user) {
      user = req.user;
    } else {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        throw AppError.unauthorized('Authentication required');
      }

      const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
      user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) {
        throw AppError.notFound('User');
      }
    }

    const updatedUser = await this.authService.updateUserProfile(user.id || user._id, {
      name,
      useNameInMeetings,
      notificationPreferences,
    });

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        useNameInMeetings: updatedUser.useNameInMeetings,
        notificationPreferences: {
          enabled: updatedUser.notifyEnabled,
          channels: {
            inApp: updatedUser.notifyInApp,
            email: updatedUser.notifyEmail,
            push: updatedUser.notifyPush,
          },
          types: {
            meetingReminders: updatedUser.notifyMeetingReminders,
            meetingInvitations: updatedUser.notifyMeetingInvitations,
            recordingReady: updatedUser.notifyRecordingReady,
          }
        },
      },
    });
  }

  // Get profile
  async getProfile(req: any, res: Response) {
    let user;
    if (req.user) {
      user = req.user;
    } else {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        throw AppError.unauthorized('Authentication required');
      }

      const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
      user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) {
        throw AppError.notFound('User');
      }
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        useNameInMeetings: user.useNameInMeetings,
        onboardingCompleted: user.onboardingCompleted,
        onboarding: {
          useCase: user.onboardingUseCase,
          teamSize: user.onboardingTeamSize,
          experience: user.onboardingExperience,
        },
        organizationId: user.organizationId,
        role: user.role,
        plan: {
          type: user.planType,
          status: user.planStatus,
          startDate: user.planStartDate,
          endDate: user.planEndDate,
        },
        isSystemAdmin: user.isSystemAdmin || false,
        notificationPreferences: {
          enabled: user.notifyEnabled ?? true,
          channels: {
            inApp: user.notifyInApp ?? true,
            email: user.notifyEmail ?? true,
            push: user.notifyPush ?? false,
          },
          types: {
            meetingReminders: user.notifyMeetingReminders ?? true,
            meetingInvitations: user.notifyMeetingInvitations ?? true,
            recordingReady: user.notifyRecordingReady ?? true,
          },
        },
        createdAt: user.createdAt,
      },
    });
  }

  // Complete onboarding
  async completeOnboarding(req: any, res: Response) {
    // Trigger nodemon reload
    let user;
    if (req.user) {
      user = req.user;
    } else {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        throw AppError.unauthorized('Authentication required');
      }

      const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
      user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) {
        throw AppError.notFound('User');
      }
    }

    const { name, useCase, teamSize, primaryUse, experience } = req.body || {};

    const updatedUser = await this.authService.completeUserOnboarding(
      user.id || user._id,
      { name, useCase, teamSize, primaryUse, experience }
    );

    return res.json({
      message: 'Onboarding completed',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        useNameInMeetings: updatedUser.useNameInMeetings,
        onboardingCompleted: updatedUser.onboardingCompleted,
        onboarding: {
          useCase: updatedUser.onboardingUseCase,
          teamSize: updatedUser.onboardingTeamSize,
          experience: updatedUser.onboardingExperience,
        },
        organizationId: updatedUser.organizationId,
        role: updatedUser.role,
        plan: {
          type: updatedUser.planType,
          status: updatedUser.planStatus,
          startDate: updatedUser.planStartDate,
          endDate: updatedUser.planEndDate,
        },
        createdAt: updatedUser.createdAt,
      },
    });
  }
}
export default new AuthController();
