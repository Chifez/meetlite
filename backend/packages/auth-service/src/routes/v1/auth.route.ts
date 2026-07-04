import express from 'express';
import { AuthController } from '../../controllers/auth.controller.js';
// @ts-ignore
import { authenticateToken } from '../../middleware/authenticate-token.js';
import {
  validateLoginInput,
  validateSignupInput,
  validateOnboardingInput,
  validatePasswordReset,
  validateForgotPassword,
// @ts-ignore
} from '../../middleware/validation.js';
// @ts-ignore
import { asyncHandler } from '../../middleware/error-handler.js';

const router = express.Router();
const authController = new AuthController();

// Public routes with rate limiting
router.post(
  '/signup',
  validateSignupInput,
  asyncHandler(authController.signup.bind(authController))
);
router.post(
  '/login',
  validateLoginInput,
  asyncHandler(authController.login.bind(authController))
);
router.post(
  '/refresh',
  asyncHandler(authController.refreshToken.bind(authController))
);
router.post(
  '/validate',
  asyncHandler(authController.validateToken.bind(authController))
);
router.post(
  '/validate-reset-token',
  asyncHandler(authController.validateResetToken.bind(authController))
);

// Google OAuth routes
router.get(
  '/google',
  asyncHandler(authController.initiateGoogleAuth.bind(authController))
);
router.get(
  '/google/callback',
  asyncHandler(authController.handleGoogleCallback.bind(authController))
);

// Password reset routes with strict rate limiting
router.post(
  '/forgot-password',
  validateForgotPassword,
  asyncHandler(authController.forgotPassword.bind(authController))
);
router.post(
  '/reset-password',
  validatePasswordReset,
  asyncHandler(authController.resetPassword.bind(authController))
);

// Protected routes (require authentication)
router.get(
  '/profile',
  authenticateToken,
  asyncHandler(authController.getProfile.bind(authController))
);
router.put(
  '/profile',
  authenticateToken,
  asyncHandler(authController.updateProfile.bind(authController))
);
router.post(
  '/onboarding',
  authenticateToken,
  validateOnboardingInput,
  asyncHandler(authController.completeOnboarding.bind(authController))
);

export default router;
