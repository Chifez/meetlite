import { Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';

// Validate login input
export const validateLoginInput = (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res
      .status(400)
      .json({ message: 'Email and password must be strings' });
  }

  if (email.trim().length === 0 || password.trim().length === 0) {
    return res
      .status(400)
      .json({ message: 'Email and password cannot be empty' });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  next();
};

// Validate signup input
export const validateSignupInput = (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res
      .status(400)
      .json({ message: 'Email and password must be strings' });
  }

  if (email.trim().length === 0 || password.trim().length === 0) {
    return res
      .status(400)
      .json({ message: 'Email and password cannot be empty' });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ message: 'Password must be at least 6 characters long' });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  next();
};

// Validate onboarding input
export const validateOnboardingInput = (req: Request, res: Response, next: NextFunction) => {
  const { name, useCase, teamSize, primaryUse, experience } = req.body || {};

  // Basic validation
  const validUseCases = ['personal', 'education', 'business', 'team'];
  const validTeamSizes = ['1-5', '6-20', '21-50', '50+'];
  const validExperience = ['beginner', 'intermediate', 'advanced'];

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ message: 'Name is required' });
  }
  if (!validUseCases.includes(useCase)) {
    return res.status(400).json({ message: 'Invalid use case' });
  }
  if (useCase === 'team' && teamSize && !validTeamSizes.includes(teamSize)) {
    return res.status(400).json({ message: 'Invalid team size' });
  }
  if (!Array.isArray(primaryUse) || primaryUse.length === 0) {
    return res.status(400).json({ message: 'Select at least one primary use' });
  }
  if (!validExperience.includes(experience)) {
    return res.status(400).json({ message: 'Invalid experience level' });
  }

  next();
};

// Validate password reset input
export const validatePasswordReset = (req: Request, res: Response, next: NextFunction) => {
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

  next();
};

// Validate forgot password input
export const validateForgotPassword = (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  if (typeof email !== 'string' || email.trim().length === 0) {
    return res.status(400).json({ message: 'Email cannot be empty' });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  next();
};

// Validate organization creation/update
export const validateCreateOrganization = (req: Request, res: Response, next: NextFunction) => {
  const { name, description } = req.body;

  if (!name || name.trim().length < 2) {
    return res.status(400).json({
      message: 'Organization name must be at least 2 characters',
    });
  }

  if (name.length > 100) {
    return res.status(400).json({
      message: 'Organization name must be less than 100 characters',
    });
  }

  if (description && description.length > 500) {
    return res.status(400).json({
      message: 'Description must be less than 500 characters',
    });
  }

  next();
};

// Validate member invitation
export const validateMemberInvitation = (req: Request, res: Response, next: NextFunction) => {
  const { organizationId, email, role } = req.body;

  if (!organizationId || !email) {
    return res.status(400).json({
      message: 'Organization ID and email are required',
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  if (role && !['member', 'owner'].includes(role)) {
    return res.status(400).json({
      message: 'Invalid role. Must be member or owner',
    });
  }

  next();
};

// Validate workspace switch
export const validateWorkspaceSwitch = (req: Request, res: Response, next: NextFunction) => {
  const { type, organizationId } = req.body;

  if (!type || !['personal', 'organization'].includes(type)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid workspace type. Must be "personal" or "organization"',
    });
  }

  if (type === 'organization' && !organizationId) {
    return res.status(400).json({
      success: false,
      message: 'organizationId is required for organization workspace',
    });
  }

  next();
};

// Validate MongoDB ObjectId parameter
export const validateObjectId = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.params[paramName];

    if (!id || !/^[0-9a-fA-F]{24}$|^[0-9a-fA-F-]{36}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName} format`,
      });
    }

    next();
  };
};

// express-validator rules
export const validateContactSales = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  body('company')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Company name must be less than 200 characters'),
  body('message')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Message must be less than 2000 characters'),
];
