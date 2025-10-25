import express from 'express';
import { authenticateToken } from '../../middleware/authenticate-token.js';
import { asyncHandler } from '../../middleware/error-handler.js';
import MultiOrganizationController from '../../controllers/multi-organization.controller.js';

const router = express.Router();
const multiOrganizationController = new MultiOrganizationController();

// All routes require authentication
router.use(authenticateToken);

// GET /multi-org/organizations - Get user's organizations
router.get(
  '/organizations',
  asyncHandler(
    multiOrganizationController.getUserOrganizations.bind(
      multiOrganizationController
    )
  )
);

// POST /multi-org/switch - Switch active organization
router.post(
  '/switch',
  asyncHandler(
    multiOrganizationController.switchActiveOrganization.bind(
      multiOrganizationController
    )
  )
);

// POST /multi-org/transfer-ownership - Transfer organization ownership
router.post(
  '/transfer-ownership',
  asyncHandler(
    multiOrganizationController.transferOwnership.bind(
      multiOrganizationController
    )
  )
);

// PUT /multi-org/update-role - Update user's role in organization
router.put(
  '/update-role',
  asyncHandler(
    multiOrganizationController.updateUserRole.bind(multiOrganizationController)
  )
);

// DELETE /multi-org/leave - Leave organization
router.delete(
  '/leave',
  asyncHandler(
    multiOrganizationController.leaveOrganization.bind(
      multiOrganizationController
    )
  )
);

export default router;
