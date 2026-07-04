import express from 'express';
import { OrganizationMemberController } from '../../controllers/organization-member.controller.js';
// @ts-ignore
import { authenticateToken } from '../../middleware/authenticate-token.js';
import {
  validateMemberInvitation,
  validateObjectId,
// @ts-ignore
} from '../../middleware/validation.js';
// @ts-ignore
import { asyncHandler } from '../../middleware/error-handler.js';

const router = express.Router();
const memberController = new OrganizationMemberController();

router.use(authenticateToken);

router.post(
  '/invite',
  validateMemberInvitation,
  asyncHandler(memberController.inviteMember.bind(memberController))
);

router.get(
  '/:organizationId',
  validateObjectId('organizationId'),
  asyncHandler(memberController.listMembers.bind(memberController))
);

router.delete(
  '/:organizationId/:memberId',
  validateObjectId('organizationId'),
  validateObjectId('memberId'),
  asyncHandler(memberController.removeMember.bind(memberController))
);

router.delete(
  '/invitations/:invitationId',
  validateObjectId('invitationId'),
  asyncHandler(memberController.cancelInvitation.bind(memberController))
);

export default router;
