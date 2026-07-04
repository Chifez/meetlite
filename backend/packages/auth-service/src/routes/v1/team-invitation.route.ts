import express from 'express';
import { TeamInvitationController } from '../../controllers/team-invitation.controller.js';
// @ts-ignore
import { authenticateToken } from '../../middleware/authenticate-token.js';
// @ts-ignore
import { requireTeamManagement } from '../../middleware/team-access.js';
// @ts-ignore
import { validateObjectId } from '../../middleware/validation.js';
// @ts-ignore
import { asyncHandler } from '../../middleware/error-handler.js';

const router = express.Router();
const invitationController = new TeamInvitationController();

router.use(authenticateToken);

router.post(
  '/organizations/:organizationId/teams/:teamId/invite',
  validateObjectId('organizationId'),
  validateObjectId('teamId'),
  requireTeamManagement,
  asyncHandler(invitationController.inviteToTeam.bind(invitationController))
);

router.get(
  '/organizations/:organizationId/teams/:teamId/invitations',
  validateObjectId('organizationId'),
  validateObjectId('teamId'),
  requireTeamManagement,
  asyncHandler(
    invitationController.getTeamInvitations.bind(invitationController)
  )
);

router.get(
  '/teams/invitations',
  asyncHandler(invitationController.getMyInvitations.bind(invitationController))
);

router.post(
  '/teams/invitations/:token/accept',
  asyncHandler(invitationController.acceptInvitation.bind(invitationController))
);

router.post(
  '/teams/invitations/:token/decline',
  asyncHandler(
    invitationController.declineInvitation.bind(invitationController)
  )
);

router.delete(
  '/organizations/:organizationId/teams/:teamId/invitations/:invitationId',
  validateObjectId('organizationId'),
  validateObjectId('teamId'),
  validateObjectId('invitationId'),
  requireTeamManagement,
  asyncHandler(invitationController.cancelInvitation.bind(invitationController))
);

export default router;
