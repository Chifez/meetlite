import express from 'express';
import { authenticateToken } from '../../middleware/authenticate-token.js';
import { requireAdmin } from '../../middleware/require-admin.js';
import { adminRateLimiter, adminLogRateLimiter } from '../../middleware/admin-rate-limiter.js';
import { asyncHandler } from '../../middleware/error-handler.js';
import AdminController from '../../controllers/admin.controller.js';
import { EnterpriseInquiryController } from '../../controllers/enterprise-inquiry.controller.js';

const router = express.Router();
const enterpriseInquiryController = new EnterpriseInquiryController();

// All admin routes require authentication and admin access
router.use(authenticateToken);
router.use(requireAdmin);
router.use(adminRateLimiter);

// Overview metrics
router.get('/metrics', asyncHandler(AdminController.getOverviewMetrics.bind(AdminController)));
router.get('/metrics/user-growth', asyncHandler(AdminController.getUserGrowthData.bind(AdminController)));
router.get('/metrics/plan-distribution', asyncHandler(AdminController.getPlanDistribution.bind(AdminController)));

// Users management
router.get('/users', asyncHandler(AdminController.getUsersList.bind(AdminController)));
router.get('/users/:userId', asyncHandler(AdminController.getUserDetails.bind(AdminController)));
router.patch('/users/:userId', asyncHandler(AdminController.updateUser.bind(AdminController)));
router.delete('/users/:userId', asyncHandler(AdminController.deleteUser.bind(AdminController)));
router.post('/users/:userId/suspend', asyncHandler(AdminController.suspendUser.bind(AdminController)));
router.post('/users/:userId/unsuspend', asyncHandler(AdminController.unsuspendUser.bind(AdminController)));
router.post('/users/:userId/reset-password', asyncHandler(AdminController.resetUserPassword.bind(AdminController)));

// Organizations management
router.get('/organizations', asyncHandler(AdminController.getOrganizationsList.bind(AdminController)));

// Meetings management
router.get('/meetings', asyncHandler(AdminController.getMeetingsList.bind(AdminController)));
router.delete('/meetings/:meetingId', asyncHandler(AdminController.deleteMeeting.bind(AdminController)));

// Revenue
router.get('/revenue/metrics', asyncHandler(AdminController.getRevenueMetrics.bind(AdminController)));
router.get('/revenue/chart', asyncHandler(AdminController.getRevenueChartData.bind(AdminController)));

// System health
router.get('/system/health', asyncHandler(AdminController.getSystemHealth.bind(AdminController)));

// Enterprise Inquiries management
router.get('/inquiries', asyncHandler(enterpriseInquiryController.listInquiries.bind(enterpriseInquiryController)));
router.get('/inquiries/stats', asyncHandler(enterpriseInquiryController.getStats.bind(enterpriseInquiryController)));
router.get('/inquiries/:id', asyncHandler(enterpriseInquiryController.getInquiry.bind(enterpriseInquiryController)));
router.patch('/inquiries/:id', asyncHandler(enterpriseInquiryController.updateInquiry.bind(enterpriseInquiryController)));
router.post('/inquiries/:id/notes', asyncHandler(enterpriseInquiryController.addNote.bind(enterpriseInquiryController)));

export default router;



