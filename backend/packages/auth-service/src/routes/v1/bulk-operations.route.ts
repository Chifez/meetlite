import express from 'express';
// @ts-ignore
import { authenticateToken } from '../../middleware/authenticate-token.js';
// @ts-ignore
import { asyncHandler } from '../../middleware/error-handler.js';
import BulkOperationsController from '../../controllers/bulk-operations.controller.js';

const router = express.Router();
const bulkOperationsController = new BulkOperationsController();

router.use(authenticateToken);

router.post(
  '/invite',
  asyncHandler(
    bulkOperationsController.bulkInviteMembers.bind(bulkOperationsController)
  )
);

router.delete(
  '/remove',
  asyncHandler(
    bulkOperationsController.bulkRemoveMembers.bind(bulkOperationsController)
  )
);

router.put(
  '/update-roles',
  asyncHandler(
    bulkOperationsController.bulkUpdateRoles.bind(bulkOperationsController)
  )
);

router.get(
  '/members/:organizationId',
  asyncHandler(
    bulkOperationsController.getOrganizationMembers.bind(
      bulkOperationsController
    )
  )
);

export default router;
