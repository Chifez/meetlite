import express from 'express';
import { authenticateToken } from '../../middleware/authenticate-token.js';
import { validatePlanStatus } from '../../middleware/plan-validation.js';
import { asyncHandler } from '../../middleware/error-handler.js';
import PlanManagementController from '../../controllers/plan-management.controller.js';

const router = express.Router();
const planManagementController = new PlanManagementController();

// All routes require authentication
router.use(authenticateToken);

// GET /plan/status - Get current plan status
router.get(
  '/status',
  asyncHandler(
    planManagementController.getPlanStatus.bind(planManagementController)
  )
);

// POST /plan/cancel - Cancel current user's plan
router.post(
  '/cancel',
  validatePlanStatus,
  asyncHandler(
    planManagementController.cancelPlan.bind(planManagementController)
  )
);

// POST /plan/cancel-auto-renewal - Cancel auto-renewal but keep access until period end
router.post(
  '/cancel-auto-renewal',
  asyncHandler(
    planManagementController.cancelAutoRenewal.bind(planManagementController)
  )
);

// POST /plan/extend - Extend user's plan (admin only)
router.post(
  '/extend',
  asyncHandler(
    planManagementController.extendPlan.bind(planManagementController)
  )
);

// POST /plan/check-expired - Manual check for expired plans (admin only)
router.post(
  '/check-expired',
  asyncHandler(
    planManagementController.checkExpiredPlans.bind(planManagementController)
  )
);

export default router;
