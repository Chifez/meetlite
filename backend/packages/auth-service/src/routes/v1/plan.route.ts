import express from 'express';
import { PlanController } from '../../controllers/plan.controller.js';
// @ts-ignore
import { authenticateToken } from '../../middleware/authenticate-token.js';
// @ts-ignore
import { asyncHandler } from '../../middleware/error-handler.js';

const router = express.Router();
const planController = new PlanController();

router.use(authenticateToken);

router.get(
  '/usage',
  asyncHandler(planController.getPlanUsage.bind(planController))
);

router.get(
  '/constraints',
  asyncHandler(planController.getPlanConstraints.bind(planController))
);

router.post(
  '/validate',
  asyncHandler(planController.validateAction.bind(planController))
);

export default router;
