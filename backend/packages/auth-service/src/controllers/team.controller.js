import { models } from '../index.js';
import { TeamService } from '../services/team.service.js';
import {
  ResponseHelpers,
  PlanValidationService,
} from '@minimeet/shared-models';

export class TeamController {
  constructor() {
    this.teamService = new TeamService();
  }

  // GET /organizations/:organizationId/teams - Get all teams for an organization
  async getTeams(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user._id;

      if (!organizationId) {
        return ResponseHelpers.badRequest(res, 'Organization ID is required');
      }

      const teams = await this.teamService.getTeamsByOrganization(
        organizationId,
        userId
      );

      return ResponseHelpers.ok(res, {
        teams: teams.map((team) => ({
          id: team._id,
          name: team.name,
          slug: team.slug,
          description: team.description,
          logo: team.logo,
          organizationId: team.organizationId,
          ownerId: team.ownerId._id || team.ownerId,
          ownerName: team.ownerId.name || team.ownerId.email,
          memberCount:
            team.memberCount ||
            team.members.filter((m) => m.status === 'active').length,
          settings: team.settings,
          status: team.status,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
        })),
      });
    } catch (error) {
      console.error('Get teams error:', error);
      return ResponseHelpers.serverError(res, 'Failed to retrieve teams');
    }
  }

  // GET /organizations/:organizationId/teams/:teamId - Get team by ID
  async getTeam(req, res) {
    try {
      const { organizationId, teamId } = req.params;

      if (!organizationId || !teamId) {
        return ResponseHelpers.badRequest(
          res,
          'Organization ID and Team ID are required'
        );
      }

      const team = await this.teamService.getTeamById(teamId, organizationId);

      return ResponseHelpers.ok(res, {
        team: {
          id: team._id,
          name: team.name,
          slug: team.slug,
          description: team.description,
          logo: team.logo,
          organizationId: team.organizationId,
          ownerId: team.ownerId._id || team.ownerId,
          ownerName: team.ownerId.name || team.ownerId.email,
          members: team.members
            .filter((m) => m.status === 'active')
            .map((m) => ({
              userId: m.userId._id || m.userId,
              userName: m.userId.name || m.userId.email,
              userEmail: m.userId.email,
              role: m.role,
              joinedAt: m.joinedAt,
            })),
          memberCount:
            team.memberCount ||
            team.members.filter((m) => m.status === 'active').length,
          settings: team.settings,
          stats: team.stats,
          status: team.status,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
        },
      });
    } catch (error) {
      console.error('Get team error:', error);
      if (error.message === 'Team not found') {
        return ResponseHelpers.notFound(res, error.message);
      }
      return ResponseHelpers.serverError(res, 'Failed to retrieve team');
    }
  }

  // POST /organizations/:organizationId/teams - Create a new team
  async createTeam(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user._id;
      const { name, description, logo, settings } = req.body;

      if (!organizationId || !name) {
        return ResponseHelpers.badRequest(
          res,
          'Organization ID and team name are required'
        );
      }

      if (!name.trim()) {
        return ResponseHelpers.badRequest(res, 'Team name cannot be empty');
      }

      // Check organization plan - teams feature requires pro/enterprise plan
      const organization = await models.Organization.findById(organizationId);
      if (!organization) {
        return ResponseHelpers.notFound(res, 'Organization not found');
      }

      const orgPlan = organization.plan?.type || 'free';
      if (orgPlan === 'free') {
        return ResponseHelpers.forbidden(res, {
          message:
            'Teams feature requires a Pro or Enterprise plan. Please upgrade to create teams.',
          upgradeRequired: true,
          currentPlan: orgPlan,
        });
      }

      const team = await this.teamService.createTeam(organizationId, userId, {
        name,
        description,
        logo,
        settings,
      });

      return ResponseHelpers.created(res, {
        team: {
          id: team._id,
          name: team.name,
          slug: team.slug,
          description: team.description,
          logo: team.logo,
          organizationId: team.organizationId,
          ownerId: team.ownerId,
          memberCount: team.memberCount || 1,
          settings: team.settings,
          status: team.status,
          createdAt: team.createdAt,
        },
        message: 'Team created successfully',
      });
    } catch (error) {
      console.error('Create team error:', error);
      if (
        error.message.includes('not found') ||
        error.message.includes('not the owner')
      ) {
        return ResponseHelpers.forbidden(res, error.message);
      }
      return ResponseHelpers.serverError(res, 'Failed to create team');
    }
  }

  // PUT /organizations/:organizationId/teams/:teamId - Update team
  async updateTeam(req, res) {
    try {
      const { organizationId, teamId } = req.params;
      const { name, description, logo, settings } = req.body;

      if (!organizationId || !teamId) {
        return ResponseHelpers.badRequest(
          res,
          'Organization ID and Team ID are required'
        );
      }

      if (name !== undefined && !name.trim()) {
        return ResponseHelpers.badRequest(res, 'Team name cannot be empty');
      }

      const team = await this.teamService.updateTeam(teamId, organizationId, {
        name,
        description,
        logo,
        settings,
      });

      return ResponseHelpers.ok(res, {
        team: {
          id: team._id,
          name: team.name,
          slug: team.slug,
          description: team.description,
          logo: team.logo,
          settings: team.settings,
          updatedAt: team.updatedAt,
        },
        message: 'Team updated successfully',
      });
    } catch (error) {
      console.error('Update team error:', error);
      if (error.message === 'Team not found') {
        return ResponseHelpers.notFound(res, error.message);
      }
      return ResponseHelpers.serverError(res, 'Failed to update team');
    }
  }

  // DELETE /organizations/:organizationId/teams/:teamId - Delete team
  async deleteTeam(req, res) {
    try {
      const { organizationId, teamId } = req.params;

      if (!organizationId || !teamId) {
        return ResponseHelpers.badRequest(
          res,
          'Organization ID and Team ID are required'
        );
      }

      await this.teamService.deleteTeam(teamId, organizationId);

      return ResponseHelpers.ok(res, {
        message: 'Team deleted successfully',
      });
    } catch (error) {
      console.error('Delete team error:', error);
      if (error.message === 'Team not found') {
        return ResponseHelpers.notFound(res, error.message);
      }
      return ResponseHelpers.serverError(res, 'Failed to delete team');
    }
  }

  // POST /organizations/:organizationId/teams/:teamId/members - Add member to team
  async addMember(req, res) {
    try {
      const { organizationId, teamId } = req.params;
      const { userId, role = 'member' } = req.body;

      if (!organizationId || !teamId || !userId) {
        return ResponseHelpers.badRequest(
          res,
          'Organization ID, Team ID, and User ID are required'
        );
      }

      if (!['member', 'owner'].includes(role)) {
        return ResponseHelpers.badRequest(
          res,
          'Invalid role. Must be member or owner'
        );
      }

      const team = await this.teamService.addMemberToTeam(
        teamId,
        organizationId,
        userId,
        role
      );

      return ResponseHelpers.ok(res, {
        message: 'Member added to team successfully',
        team: {
          id: team._id,
          name: team.name,
          memberCount:
            team.memberCount ||
            team.members.filter((m) => m.status === 'active').length,
        },
      });
    } catch (error) {
      console.error('Add member error:', error);
      if (
        error.message.includes('not found') ||
        error.message.includes('already a member') ||
        error.message.includes('not a member of this organization')
      ) {
        return ResponseHelpers.badRequest(res, error.message);
      }
      return ResponseHelpers.serverError(res, 'Failed to add member to team');
    }
  }

  // DELETE /organizations/:organizationId/teams/:teamId/members/:userId - Remove member from team
  async removeMember(req, res) {
    try {
      const { organizationId, teamId, userId } = req.params;

      if (!organizationId || !teamId || !userId) {
        return ResponseHelpers.badRequest(
          res,
          'Organization ID, Team ID, and User ID are required'
        );
      }

      const team = await this.teamService.removeMemberFromTeam(
        teamId,
        organizationId,
        userId
      );

      return ResponseHelpers.ok(res, {
        message: 'Member removed from team successfully',
        team: {
          id: team._id,
          name: team.name,
          memberCount:
            team.memberCount ||
            team.members.filter((m) => m.status === 'active').length,
        },
      });
    } catch (error) {
      console.error('Remove member error:', error);
      if (
        error.message.includes('not found') ||
        error.message.includes('not a member') ||
        error.message.includes('Cannot remove team owner')
      ) {
        return ResponseHelpers.badRequest(res, error.message);
      }
      return ResponseHelpers.serverError(
        res,
        'Failed to remove member from team'
      );
    }
  }
}
