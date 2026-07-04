import express from 'express';
// @ts-ignore
import { authenticateToken } from '../../middleware/authenticate-token.js';
import { validatePlanStatus } from '../../middleware/plan-validation.js';
// @ts-ignore
import { asyncHandler } from '../../middleware/error-handler.js';
import PlanManagementController from '../../controllers/plan-management.controller.js';

const router = express.Router();
const planManagementController = new PlanManagementController();

router.use(authenticateToken);

router.get(
  '/status',
  asyncHandler(
    planManagementController.getPlanStatus.bind(planManagementController)
  )
);

router.post(
  '/cancel',
  validatePlanStatus,
  asyncHandler(
    planManagementController.cancelPlan.bind(planManagementController)
  )
);

router.post(
  '/cancel-auto-renewal',
  asyncHandler(
    planManagementController.cancelAutoRenewal.bind(planManagementController)
  )
);

router.post(
  '/extend',
  asyncHandler(
    planManagementController.extendPlan.bind(planManagementController)
  )
);

router.post(
  '/check-expired',
  asyncHandler(
    planManagementController.checkExpiredPlans.bind(planManagementController)
  )
);

export default router;
