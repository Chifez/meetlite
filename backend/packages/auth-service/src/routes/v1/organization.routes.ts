import express from 'express';
import { OrganizationController } from '../../controllers/organization.controller.js';
// @ts-ignore
import { authenticateToken } from '../../middleware/authenticate-token.js';
import {
  validateCreateOrganization,
  validateObjectId,
// @ts-ignore
} from '../../middleware/validation.js';
// @ts-ignore
import { asyncHandler } from '../../middleware/error-handler.js';

const router = express.Router();
const organizationController = new OrganizationController();

router.use(authenticateToken);

router.get(
  '/',
  asyncHandler(
    organizationController.listOrganizations.bind(organizationController)
  )
);

router.post(
  '/',
  validateCreateOrganization,
  asyncHandler(
    organizationController.createOrganization.bind(organizationController)
  )
);

router.get(
  '/:orgId',
  validateObjectId('orgId'),
  asyncHandler(
    organizationController.getOrganization.bind(organizationController)
  )
);

router.get(
  '/:orgId/upload-url',
  validateObjectId('orgId'),
  asyncHandler(
    organizationController.getUploadUrl.bind(organizationController)
  )
);


router.put(
  '/:orgId',
  validateObjectId('orgId'),
  validateCreateOrganization,
  asyncHandler(
    organizationController.updateOrganization.bind(organizationController)
  )
);

router.post(
  '/:orgId/leave',
  validateObjectId('orgId'),
  asyncHandler(
    organizationController.leaveOrganization.bind(organizationController)
  )
);

router.delete(
  '/:orgId',
  validateObjectId('orgId'),
  asyncHandler(
    organizationController.deleteOrganization.bind(organizationController)
  )
);

export default router;
