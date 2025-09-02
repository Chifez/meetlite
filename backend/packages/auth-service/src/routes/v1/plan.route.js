import express from 'express';
import { PlanController } from '../../controllers/plan.controller.js';
import { authenticateToken } from '../../middleware/authenticate-token.js';
import { asyncHandler } from '../../middleware/error-handler.js';

const router = express.Router();
const planController = new PlanController();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /plan/usage - Get current user's plan usage
router.get(
  '/usage',
  asyncHandler(planController.getPlanUsage.bind(planController))
);

// GET /plan/constraints - Get plan constraints for current user
router.get(
  '/constraints',
  asyncHandler(planController.getPlanConstraints.bind(planController))
);

// POST /plan/validate - Validate a specific action against plan limits
router.post(
  '/validate',
  asyncHandler(planController.validateAction.bind(planController))
);

export default router;
