import express from 'express';
import { TeamInvitationController } from '../../controllers/team-invitation.controller.js';
import { authenticateToken } from '../../middleware/authenticate-token.js';
import { requireTeamManagement } from '../../middleware/team-access.js';
import { validateObjectId } from '../../middleware/validation.js';
import { asyncHandler } from '../../middleware/error-handler.js';

const router = express.Router();
const invitationController = new TeamInvitationController();

// Apply authentication to all routes
router.use(authenticateToken);

// POST /organizations/:organizationId/teams/:teamId/invite - Invite member to team
router.post(
  '/organizations/:organizationId/teams/:teamId/invite',
  validateObjectId('organizationId'),
  validateObjectId('teamId'),
  requireTeamManagement,
  asyncHandler(invitationController.inviteToTeam.bind(invitationController))
);

// GET /organizations/:organizationId/teams/:teamId/invitations - Get pending invitations for a team
router.get(
  '/organizations/:organizationId/teams/:teamId/invitations',
  validateObjectId('organizationId'),
  validateObjectId('teamId'),
  requireTeamManagement,
  asyncHandler(
    invitationController.getTeamInvitations.bind(invitationController)
  )
);

// GET /teams/invitations - Get pending invitations for current user
router.get(
  '/teams/invitations',
  asyncHandler(invitationController.getMyInvitations.bind(invitationController))
);

// POST /teams/invitations/:token/accept - Accept team invitation
router.post(
  '/teams/invitations/:token/accept',
  asyncHandler(invitationController.acceptInvitation.bind(invitationController))
);

// POST /teams/invitations/:token/decline - Decline team invitation
router.post(
  '/teams/invitations/:token/decline',
  asyncHandler(
    invitationController.declineInvitation.bind(invitationController)
  )
);

// DELETE /organizations/:organizationId/teams/:teamId/invitations/:invitationId - Cancel invitation
router.delete(
  '/organizations/:organizationId/teams/:teamId/invitations/:invitationId',
  validateObjectId('organizationId'),
  validateObjectId('teamId'),
  validateObjectId('invitationId'),
  requireTeamManagement,
  asyncHandler(invitationController.cancelInvitation.bind(invitationController))
);

export default router;
