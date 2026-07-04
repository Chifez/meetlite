import express from 'express';
import { verifyToken } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/error-handler.js';
import { AnalyticsController } from '../../controllers/analytics.controller.js';

const router = express.Router();
const analyticsController = new AnalyticsController();

// Apply authentication to all routes
router.use(verifyToken as any);

/**
 * Get organization analytics
 * GET /api/v1/analytics/organization/:organizationId
 */
router.get(
  '/organization/:organizationId',
  asyncHandler(
    analyticsController.getOrganizationAnalytics.bind(analyticsController)
  )
);

/**
 * Get recording statistics (alternative endpoint)
 * GET /api/v1/analytics/recordings/stats
 */
router.get(
  '/recordings/stats',
  asyncHandler(analyticsController.getRecordingStats.bind(analyticsController))
);

export default router;
