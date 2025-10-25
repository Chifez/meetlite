import express from 'express';
import { OrganizationMemberController } from '../../controllers/organization-member.controller.js';
import { authenticateToken } from '../../middleware/authenticate-token.js';
import {
  validateMemberInvitation,
  validateObjectId,
} from '../../middleware/validation.js';
import { asyncHandler } from '../../middleware/error-handler.js';

const router = express.Router();
const memberController = new OrganizationMemberController();

// Apply authentication to all routes
router.use(authenticateToken);

// POST /members/invite - Invite a member to organization (with strict rate limiting)
router.post(
  '/invite',

  validateMemberInvitation,
  asyncHandler(memberController.inviteMember.bind(memberController))
);

// GET /members/:organizationId - List organization members and pending invitations
router.get(
  '/:organizationId',
  validateObjectId('organizationId'),
  asyncHandler(memberController.listMembers.bind(memberController))
);

// DELETE /members/:organizationId/:memberId - Remove member from organization
router.delete(
  '/:organizationId/:memberId',
  validateObjectId('organizationId'),
  validateObjectId('memberId'),
  asyncHandler(memberController.removeMember.bind(memberController))
);

// DELETE /invitations/:invitationId - Cancel pending invitation
router.delete(
  '/invitations/:invitationId',
  validateObjectId('invitationId'),
  asyncHandler(memberController.cancelInvitation.bind(memberController))
);

export default router;
