import express from 'express';
import { TeamController } from '../../controllers/team.controller.js';
// @ts-ignore
import { authenticateToken } from '../../middleware/authenticate-token.js';
// @ts-ignore
import { requireTeamManagement, requireTeamAccess } from '../../middleware/team-access.js';
// @ts-ignore
import { validateObjectId } from '../../middleware/validation.js';
// @ts-ignore
import { asyncHandler } from '../../middleware/error-handler.js';

const router = express.Router();
const teamController = new TeamController();

router.use(authenticateToken);

router.get(
  '/organizations/:organizationId/teams',
  validateObjectId('organizationId'),
  asyncHandler(teamController.getTeams.bind(teamController))
);

router.get(
  '/organizations/:organizationId/teams/:teamId',
  validateObjectId('organizationId'),
  validateObjectId('teamId'),
  requireTeamAccess,
  asyncHandler(teamController.getTeam.bind(teamController))
);

router.post(
  '/organizations/:organizationId/teams',
  validateObjectId('organizationId'),
  requireTeamManagement,
  asyncHandler(teamController.createTeam.bind(teamController))
);

router.put(
  '/organizations/:organizationId/teams/:teamId',
  validateObjectId('organizationId'),
  validateObjectId('teamId'),
  requireTeamManagement,
  asyncHandler(teamController.updateTeam.bind(teamController))
);

router.delete(
  '/organizations/:organizationId/teams/:teamId',
  validateObjectId('organizationId'),
  validateObjectId('teamId'),
  requireTeamManagement,
  asyncHandler(teamController.deleteTeam.bind(teamController))
);

router.post(
  '/organizations/:organizationId/teams/:teamId/members',
  validateObjectId('organizationId'),
  validateObjectId('teamId'),
  requireTeamManagement,
  asyncHandler(teamController.addMember.bind(teamController))
);

router.delete(
  '/organizations/:organizationId/teams/:teamId/members/:userId',
  validateObjectId('organizationId'),
  validateObjectId('teamId'),
  validateObjectId('userId'),
  requireTeamManagement,
  asyncHandler(teamController.removeMember.bind(teamController))
);

export default router;
