import express from 'express';
import { authenticateToken } from '../../middleware/authenticate-token.js';
import { asyncHandler } from '../../middleware/error-handler.js';
import BulkOperationsController from '../../controllers/bulk-operations.controller.js';

const router = express.Router();
const bulkOperationsController = new BulkOperationsController();

// All routes require authentication
router.use(authenticateToken);

// POST /bulk/invite - Bulk invite members
router.post(
  '/invite',
  asyncHandler(
    bulkOperationsController.bulkInviteMembers.bind(bulkOperationsController)
  )
);

// DELETE /bulk/remove - Bulk remove members
router.delete(
  '/remove',
  asyncHandler(
    bulkOperationsController.bulkRemoveMembers.bind(bulkOperationsController)
  )
);

// PUT /bulk/update-roles - Bulk update member roles
router.put(
  '/update-roles',
  asyncHandler(
    bulkOperationsController.bulkUpdateRoles.bind(bulkOperationsController)
  )
);

// GET /bulk/members/:organizationId - Get organization members with pagination
router.get(
  '/members/:organizationId',
  asyncHandler(
    bulkOperationsController.getOrganizationMembers.bind(
      bulkOperationsController
    )
  )
);

export default router;
