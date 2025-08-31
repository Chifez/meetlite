import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import { models } from '../index.js';
import { AuthService } from '../services/auth.service.js';
import { generateJWTToken } from '../utils/generate-token.js';

export class AuthController {
  constructor() {
    this.authService = new AuthService();
  }

  // Signup
  async signup(req, res) {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return res
          .status(400)
          .json({ message: 'Email and password are required' });
      }

      // Check if user exists
      const existingUser = await models.User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
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
    } catch (error) {
      console.error('Signup error:', error);

      // Handle specific MongoDB errors
      if (error.code === 11000) {
        return res.status(400).json({ message: 'User already exists' });
      }

      if (error.name === 'ValidationError') {
        return res.status(400).json({ message: 'Invalid input data' });
      }

      res.status(500).json({ message: 'Server error' });
    }
  }

  // Login
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Check if user exists
      const user = await models.User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Verify password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Generate token with organization context
      const token = generateJWTToken(user);

      res.json({ token });
    } catch (error) {
      console.error('Login error:', error);

      // Handle specific errors
      if (error.name === 'CastError') {
        return res.status(400).json({ message: 'Invalid user data' });
      }

      res.status(500).json({ message: 'Server error' });
    }
  }

  // Refresh token
  async refreshToken(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: 'Token is required' });
      }

      // Verify the existing token (even if expired, we can still get user info)
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET, {
          ignoreExpiration: true,
        });
      } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      // Check if user still exists
      const user = await models.User.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Check token version for invalidation
      if (decoded.tokenVersion && decoded.tokenVersion !== user.tokenVersion) {
        return res.status(401).json({ message: 'Token has been invalidated' });
      }

      // Generate new token with current organization context
      const newToken = generateJWTToken(user);

      res.json({ token: newToken });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Validate token
  async validateToken(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: 'Token is required' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if user still exists
      const user = await models.User.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Check token version for invalidation
      if (decoded.tokenVersion && decoded.tokenVersion !== user.tokenVersion) {
        return res.status(401).json({ message: 'Token has been invalidated' });
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
          plan: user.plan,
          createdAt: user.createdAt,
        },
        expiresAt: decoded.exp,
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token' });
      }

      console.error('Token validation error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Validate reset token
  async validateResetToken(req, res) {
    try {
      const { token } = req.body;
      if (!token) {
        return res
          .status(400)
          .json({ valid: false, message: 'Token is required' });
      }
      const user = await models.User.findOne({
        resetToken: token,
        resetTokenExpiry: { $gt: new Date() },
      });
      if (!user) {
        return res
          .status(400)
          .json({ valid: false, message: 'Invalid or expired reset token' });
      }
      res.json({ valid: true });
    } catch (error) {
      console.error('Validate reset token error:', error);
      res.status(500).json({ valid: false, message: 'Server error' });
    }
  }

  // Google OAuth initiation
  async initiateGoogleAuth(req, res) {
    try {
      const googleClient = this.authService.createGoogleClient();
      const url = googleClient.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: ['profile', 'email'],
      });
      res.redirect(url);
    } catch (error) {
      console.error('Google OAuth initiation error:', error);
      res.status(500).json({ message: 'Failed to initiate Google OAuth' });
    }
  }

  // Google OAuth callback
  async handleGoogleCallback(req, res) {
    try {
      const { code } = req.query;
      if (!code) return res.status(400).send('No code provided');

      const result = await this.authService.handleGoogleOAuth(code);
      const { token, error } = result;

      if (error) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=${error}`);
      }

      // Redirect to frontend with token
      res.redirect(`${process.env.FRONTEND_URL}/login?token=${token}`);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect(
        `${process.env.FRONTEND_URL}/login?error=google_oauth_failed`
      );
    }
  }

  // Forgot password
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      const result = await this.authService.handleForgotPassword(email);
      res.json(result);
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Reset password
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res
          .status(400)
          .json({ message: 'Token and new password are required' });
      }

      if (newPassword.length < 6) {
        return res
          .status(400)
          .json({ message: 'Password must be at least 6 characters long' });
      }

      const result = await this.authService.handlePasswordReset(
        token,
        newPassword
      );
      res.json(result);
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Update profile
  async updateProfile(req, res) {
    try {
      const { name, useNameInMeetings } = req.body;

      // Handle both middleware and manual token extraction for backward compatibility
      let user;
      if (req.user) {
        // From authenticateToken middleware
        user = req.user;
      } else {
        // Manual token extraction (fallback for backward compatibility)
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
          return res.status(401).json({ message: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await models.User.findById(decoded.userId);
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
      }

      const updatedUser = await this.authService.updateUserProfile(user._id, {
        name,
        useNameInMeetings,
      });

      res.json({
        message: 'Profile updated successfully',
        user: {
          id: updatedUser._id,
          email: updatedUser.email,
          name: updatedUser.name,
          useNameInMeetings: updatedUser.useNameInMeetings,
        },
      });
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token' });
      }
      console.error('Update profile error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Get profile
  async getProfile(req, res) {
    try {
      // Handle both middleware and manual token extraction for backward compatibility
      let user;
      if (req.user) {
        // From authenticateToken middleware
        user = req.user;
      } else {
        // Manual token extraction (fallback for backward compatibility)
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
          return res.status(401).json({ message: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await models.User.findById(decoded.userId);
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
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
          plan: user.plan,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token' });
      }
      console.error('Get profile error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Complete onboarding
  async completeOnboarding(req, res) {
    try {
      // Handle both middleware and manual token extraction for backward compatibility
      let user;
      if (req.user) {
        // From authenticateToken middleware
        user = req.user;
      } else {
        // Manual token extraction (fallback for backward compatibility)
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
          return res.status(401).json({ message: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await models.User.findById(decoded.userId);
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
      }

      const { name, useCase, teamSize, primaryUse, experience } =
        req.body || {};

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
          organizationId: updatedUser.onboardingCompleted,
          role: updatedUser.role,
          plan: updatedUser.plan,
          createdAt: updatedUser.createdAt,
        },
      });
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token' });
      }
      if (error.name === 'ValidationError') {
        return res.status(400).json({ message: error.message });
      }
      console.error('Onboarding completion error:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  }
}
