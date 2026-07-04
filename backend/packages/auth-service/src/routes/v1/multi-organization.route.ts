import express from 'express';
// @ts-ignore
import { authenticateToken } from '../../middleware/authenticate-token.js';
// @ts-ignore
import { asyncHandler } from '../../middleware/error-handler.js';
import MultiOrganizationController from '../../controllers/multi-organization.controller.js';

const router = express.Router();
const multiOrganizationController = new MultiOrganizationController();

router.use(authenticateToken);

router.get(
  '/organizations',
  asyncHandler(
    multiOrganizationController.getUserOrganizations.bind(
      multiOrganizationController
    )
  )
);

router.post(
  '/switch',
  asyncHandler(
    multiOrganizationController.switchActiveOrganization.bind(
      multiOrganizationController
    )
  )
);

router.post(
  '/transfer-ownership',
  asyncHandler(
    multiOrganizationController.transferOwnership.bind(
      multiOrganizationController
    )
  )
);

router.put(
  '/update-role',
  asyncHandler(
    multiOrganizationController.updateUserRole.bind(multiOrganizationController)
  )
);

router.delete(
  '/leave',
  asyncHandler(
    multiOrganizationController.leaveOrganization.bind(
      multiOrganizationController
    )
  )
);

export default router;
