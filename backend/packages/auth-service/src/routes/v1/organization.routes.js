import express from 'express';
import { OrganizationController } from '../../controllers/organization.controller.js';
import { authenticateToken } from '../../middleware/authenticate-token.js';
import {
  validateCreateOrganization,
  validateObjectId,
} from '../../middleware/validation.js';

import { asyncHandler } from '../../middleware/error-handler.js';

const router = express.Router();
const organizationController = new OrganizationController();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /organizations - List user's organizations (owned + member)
router.get(
  '/',
  asyncHandler(
    organizationController.listOrganizations.bind(organizationController)
  )
);

// POST /organizations - Create new organization (with strict rate limiting)
router.post(
  '/',

  validateCreateOrganization,
  asyncHandler(
    organizationController.createOrganization.bind(organizationController)
  )
);

// GET /organizations/:orgId - Get organization details
router.get(
  '/:orgId',
  validateObjectId('orgId'),
  asyncHandler(
    organizationController.getOrganization.bind(organizationController)
  )
);

// PUT /organizations/:orgId - Update organization (owner only)
router.put(
  '/:orgId',
  validateObjectId('orgId'),
  validateCreateOrganization,
  asyncHandler(
    organizationController.updateOrganization.bind(organizationController)
  )
);

// POST /organizations/:orgId/leave - Leave organization (members only)
router.post(
  '/:orgId/leave',
  validateObjectId('orgId'),
  asyncHandler(
    organizationController.leaveOrganization.bind(organizationController)
  )
);

// DELETE /organizations/:orgId - Delete organization (owner only)
router.delete(
  '/:orgId',
  validateObjectId('orgId'),
  asyncHandler(
    organizationController.deleteOrganization.bind(organizationController)
  )
);

export default router;
