import express from 'express';
import { TeamController } from '../../controllers/team.controller.js';
import { authenticateToken } from '../../middleware/authenticate-token.js';
import { requireTeamManagement } from '../../middleware/team-access.js';
import { validateObjectId } from '../../middleware/validation.js';
import { asyncHandler } from '../../middleware/error-handler.js';

const router = express.Router();
const teamController = new TeamController();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /organizations/:organizationId/teams - Get all teams for an organization
router.get(
  '/organizations/:organizationId/teams',
  validateObjectId('organizationId'),
  asyncHandler(teamController.getTeams.bind(teamController))
);

// GET /organizations/:organizationId/teams/:teamId - Get team by ID
router.get(
  '/organizations/:organizationId/teams/:teamId',
  validateObjectId('organizationId'),
  validateObjectId('teamId'),
  asyncHandler(teamController.getTeam.bind(teamController))
);

// POST /organizations/:organizationId/teams - Create a new team
router.post(
  '/organizations/:organizationId/teams',
  validateObjectId('organizationId'),
  requireTeamManagement,
  asyncHandler(teamController.createTeam.bind(teamController))
);

// PUT /organizations/:organizationId/teams/:teamId - Update team
router.put(
  '/organizations/:organizationId/teams/:teamId',
  validateObjectId('organizationId'),
  validateObjectId('teamId'),
  requireTeamManagement,
  asyncHandler(teamController.updateTeam.bind(teamController))
);

// DELETE /organizations/:organizationId/teams/:teamId - Delete team
router.delete(
  '/organizations/:organizationId/teams/:teamId',
  validateObjectId('organizationId'),
  validateObjectId('teamId'),
  requireTeamManagement,
  asyncHandler(teamController.deleteTeam.bind(teamController))
);

// POST /organizations/:organizationId/teams/:teamId/members - Add member to team
router.post(
  '/organizations/:organizationId/teams/:teamId/members',
  validateObjectId('organizationId'),
  validateObjectId('teamId'),
  requireTeamManagement,
  asyncHandler(teamController.addMember.bind(teamController))
);

// DELETE /organizations/:organizationId/teams/:teamId/members/:userId - Remove member from team
router.delete(
  '/organizations/:organizationId/teams/:teamId/members/:userId',
  validateObjectId('organizationId'),
  validateObjectId('teamId'),
  validateObjectId('userId'),
  requireTeamManagement,
  asyncHandler(teamController.removeMember.bind(teamController))
);

export default router;
