import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import { models } from '../index.js';
import { AuthService } from '../services/auth.service.js';
import { generateJWTToken } from '../utils/generate-token.js';
import { sanitizePlan } from '../utils/sanitize-plan.js';
import { AppError } from '@minimeet/shared';

export class AuthController {
  constructor() {
    this.authService = new AuthService();
  }

  // Signup
  async signup(req, res) {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      throw AppError.validation('Email and password are required');
    }

    // Check if user exists
    const existingUser = await models.User.findOne({ email });
    if (existingUser) {
      throw new AppError(
        'USER_2002',
        `User with email '${email}' already exists`
      );
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = new models.User({
      email,
      password: hashedPassword,
    });

    await user.save();

    // Generate token with organization context
    const token = generateJWTToken(user);

    res.status(201).json({ token });
  }

  // Login
  async login(req, res) {
    const { email, password } = req.body;

    // Check if user exists
    const user = await models.User.findOne({ email });
    if (!user) {
      throw AppError.unauthorized('Invalid credentials');
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw AppError.unauthorized('Invalid credentials');
    }

    // Generate token with organization context
    const token = generateJWTToken(user);

    res.json({ token });
  }

  // Refresh token
  async refreshToken(req, res) {
    const { token } = req.body;

    if (!token) {
      throw AppError.validation('Token is required');
    }

    // Verify the existing token (even if expired, we can still get user info)
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        ignoreExpiration: true,
      });
    } catch (error) {
      throw AppError.unauthorized('Invalid token');
    }

    // Check if user still exists
    const user = await models.User.findById(decoded.userId);
    if (!user) {
      throw AppError.unauthorized('User not found');
    }

    // Check token version for invalidation
    if (decoded.tokenVersion && decoded.tokenVersion !== user.tokenVersion) {
      throw AppError.unauthorized('Token has been invalidated');
    }

    // Generate new token with current organization context
    const newToken = generateJWTToken(user);

    res.json({ token: newToken });
  }

  // Validate token
  async validateToken(req, res) {
    const { token } = req.body;

    if (!token) {
      throw AppError.validation('Token is required');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists
    const user = await models.User.findById(decoded.userId);
    if (!user) {
      throw AppError.unauthorized('User not found');
    }

    // Check token version for invalidation
    if (decoded.tokenVersion && decoded.tokenVersion !== user.tokenVersion) {
      throw AppError.unauthorized('Token has been invalidated');
    }

    res.json({
      valid: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        useNameInMeetings: user.useNameInMeetings,
        onboardingCompleted: user.onboardingCompleted,
        onboarding: user.onboarding,
        organizationId: user.organizationId,
        role: user.role,
        plan: sanitizePlan(user.plan),
        createdAt: user.createdAt,
      },
      expiresAt: decoded.exp,
    });
  }

  // Validate reset token
  async validateResetToken(req, res) {
    const { token } = req.body;
    if (!token) {
      throw AppError.validation('Token is required');
    }
    const user = await models.User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });
    if (!user) {
      throw AppError.validation('Invalid or expired reset token');
    }
    res.json({ valid: true });
  }

  // Google OAuth initiation
  async initiateGoogleAuth(req, res) {
    const googleClient = this.authService.createGoogleClient();
    const url = googleClient.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['profile', 'email'],
    });
    res.redirect(url);
  }

  // Google OAuth callback
  async handleGoogleCallback(req, res) {
    const { code } = req.query;
    if (!code) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
      return res.redirect(`${frontendUrl}/login?error=no_code_provided`);
    }

    // Get frontend URL with fallback
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';

    const result = await this.authService.handleGoogleOAuth(code);
    const { token, error } = result;

    if (error) {
      return res.redirect(`${frontendUrl}/login?error=${error}`);
    }

    // Redirect to frontend with token
    res.redirect(`${frontendUrl}/login?token=${token}`);
  }

  // Forgot password
  async forgotPassword(req, res) {
    const { email } = req.body;

    if (!email) {
      throw AppError.validation('Email is required');
    }

    const result = await this.authService.handleForgotPassword(email);
    res.json(result);
  }

  // Reset password
  async resetPassword(req, res) {
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
  async updateProfile(req, res) {
    const { name, useNameInMeetings, notificationPreferences } = req.body;

    // Handle both middleware and manual token extraction for backward compatibility
    let user;
    if (req.user) {
      // From authenticateToken middleware
      user = req.user;
    } else {
      // Manual token extraction (fallback for backward compatibility)
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        throw AppError.unauthorized('Authentication required');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = await models.User.findById(decoded.userId);
      if (!user) {
        throw AppError.notFound('User');
      }
    }

    const updatedUser = await this.authService.updateUserProfile(user._id, {
      name,
      useNameInMeetings,
      notificationPreferences,
    });

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        name: updatedUser.name,
        useNameInMeetings: updatedUser.useNameInMeetings,
        notificationPreferences: updatedUser.notificationPreferences,
      },
    });
  }

  // Get profile
  async getProfile(req, res) {
    // Handle both middleware and manual token extraction for backward compatibility
    let user;
    if (req.user) {
      // From authenticateToken middleware
      user = req.user;
    } else {
      // Manual token extraction (fallback for backward compatibility)
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        throw AppError.unauthorized('Authentication required');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = await models.User.findById(decoded.userId);
      if (!user) {
        throw AppError.notFound('User');
      }
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        useNameInMeetings: user.useNameInMeetings,
        onboardingCompleted: user.onboardingCompleted,
        onboarding: user.onboarding,
        organizationId: user.organizationId,
        role: user.role,
        plan: sanitizePlan(user.plan),
        notificationPreferences: user.notificationPreferences || {
          enabled: true,
          channels: {
            inApp: true,
            email: true,
            push: false,
          },
          types: {
            meetingReminders: true,
            meetingInvitations: true,
            meetingUpdates: true,
            recordingReady: true,
          },
        },
        createdAt: user.createdAt,
      },
    });
  }

  // Complete onboarding
  async completeOnboarding(req, res) {
    // Handle both middleware and manual token extraction for backward compatibility
    let user;
    if (req.user) {
      // From authenticateToken middleware
      user = req.user;
    } else {
      // Manual token extraction (fallback for backward compatibility)
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        throw AppError.unauthorized('Authentication required');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = await models.User.findById(decoded.userId);
      if (!user) {
        throw AppError.notFound('User');
      }
    }

    const { name, useCase, teamSize, primaryUse, experience } = req.body || {};

    const updatedUser = await this.authService.completeUserOnboarding(
      user._id,
      { name, useCase, teamSize, primaryUse, experience }
    );

    return res.json({
      message: 'Onboarding completed',
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        name: updatedUser.name,
        useNameInMeetings: updatedUser.useNameInMeetings,
        onboardingCompleted: updatedUser.onboardingCompleted,
        onboarding: updatedUser.onboarding,
        organizationId: updatedUser.organizationId,
        role: updatedUser.role,
        plan: sanitizePlan(updatedUser.plan),
        createdAt: updatedUser.createdAt,
      },
    });
  }
}
