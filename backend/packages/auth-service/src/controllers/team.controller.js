import { models } from '../index.js';
import { TeamService } from '../services/team.service.js';
import {
  ResponseHelpers,
  PlanValidationService,
  AppError,
} from '@minimeet/shared';

export class TeamController {
  constructor() {
    this.teamService = new TeamService();
  }

  // GET /organizations/:organizationId/teams - Get all teams for an organization
  async getTeams(req, res) {
    const { organizationId } = req.params;
    const userId = req.user._id;

    if (!organizationId) {
      throw AppError.validation('Organization ID is required');
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
  }

  // GET /organizations/:organizationId/teams/:teamId - Get team by ID
  async getTeam(req, res) {
    const { organizationId, teamId } = req.params;

    if (!organizationId || !teamId) {
      throw AppError.validation('Organization ID and Team ID are required');
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
  }

  // POST /organizations/:organizationId/teams - Create a new team
  async createTeam(req, res) {
    const { organizationId } = req.params;
    const userId = req.user._id;
    const { name, description, logo, settings } = req.body;

    if (!organizationId || !name) {
      throw AppError.validation('Organization ID and team name are required');
    }

    if (!name.trim()) {
      throw AppError.validation('Team name cannot be empty');
    }

    // Check organization plan - teams feature requires pro/enterprise plan
    const organization = await models.Organization.findById(organizationId);
    if (!organization) {
      throw AppError.notFound('Organization');
    }

    const orgPlan = organization.plan?.type || 'free';
    if (orgPlan === 'free') {
      const forbiddenError = AppError.forbidden(
        'Teams feature requires a Pro or Enterprise plan. Please upgrade to create teams.'
      );
      forbiddenError.upgradeRequired = true;
      forbiddenError.currentPlan = orgPlan;
      throw forbiddenError;
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
  }

  // PUT /organizations/:organizationId/teams/:teamId - Update team
  async updateTeam(req, res) {
    const { organizationId, teamId } = req.params;
    const { name, description, logo, settings } = req.body;

    if (!organizationId || !teamId) {
      throw AppError.validation('Organization ID and Team ID are required');
    }

    if (name !== undefined && !name.trim()) {
      throw AppError.validation('Team name cannot be empty');
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
  }

  // DELETE /organizations/:organizationId/teams/:teamId - Delete team
  async deleteTeam(req, res) {
    const { organizationId, teamId } = req.params;

    if (!organizationId || !teamId) {
      throw AppError.validation('Organization ID and Team ID are required');
    }

    await this.teamService.deleteTeam(teamId, organizationId);

    return ResponseHelpers.ok(res, {
      message: 'Team deleted successfully',
    });
  }

  // POST /organizations/:organizationId/teams/:teamId/members - Add member to team
  async addMember(req, res) {
    const { organizationId, teamId } = req.params;
    const { userId, role = 'member' } = req.body;

    if (!organizationId || !teamId || !userId) {
      throw AppError.validation(
        'Organization ID, Team ID, and User ID are required'
      );
    }

    if (!['member', 'admin', 'owner'].includes(role)) {
      throw AppError.validation('Invalid role. Must be member, admin, or owner');
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
  }

  // DELETE /organizations/:organizationId/teams/:teamId/members/:userId - Remove member from team
  async removeMember(req, res) {
    const { organizationId, teamId, userId } = req.params;

    if (!organizationId || !teamId || !userId) {
      throw AppError.validation(
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
  }
}
