import { models } from '../index.js';

export class TeamService {
  /**
   * Create a new team
   */
  async createTeam(organizationId, ownerId, teamData) {
    const { name, description, logo, settings } = teamData;

    // Verify organization exists
    const organization = await models.Organization.findOne({
      _id: organizationId,
      status: 'active',
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    // Check if user is organization owner or admin
    const user = await models.User.findById(ownerId);
    if (!user) {
      throw new Error('User not found');
    }

    const membership = user.memberships?.find(
      (m) =>
        m.organizationId.toString() === organizationId.toString() &&
        m.status === 'active'
    );

    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'admin')
    ) {
      throw new Error('Only organization owners and admins can create teams');
    }

    // Create team
    const team = new models.Team({
      organizationId,
      ownerId,
      name: name.trim(),
      description: description?.trim(),
      logo,
      settings: settings || {},
      members: [
        {
          userId: ownerId,
          role: 'owner',
          joinedAt: new Date(),
          status: 'active',
        },
      ],
    });

    await team.save();

    // Add team membership to user
    await models.User.findByIdAndUpdate(ownerId, {
      $push: {
        teamMemberships: {
          teamId: team._id,
          organizationId: organizationId,
          role: 'owner',
          joinedAt: new Date(),
          status: 'active',
        },
      },
    });

    return team;
  }

  /**
   * Get all teams for an organization
   */
  async getTeamsByOrganization(organizationId, userId = null) {
    const query = {
      organizationId,
      status: { $ne: 'deleted' },
    };

    // If userId provided, filter to only teams user is a member of (unless org owner)
    if (userId) {
      const user = await models.User.findById(userId);
      const orgMembership = user?.memberships?.find(
        (m) =>
          m.organizationId.toString() === organizationId.toString() &&
          m.status === 'active'
      );

      // If not org owner, filter to only teams user is member of
      if (!orgMembership || orgMembership.role !== 'owner') {
        const userTeamIds =
          user?.teamMemberships
            ?.filter(
              (m) =>
                m.organizationId.toString() === organizationId.toString() &&
                m.status === 'active'
            )
            .map((m) => m.teamId) || [];

        query._id = { $in: userTeamIds };
      }
    }

    const teams = await models.Team.find(query)
      .populate('ownerId', 'name email')
      .sort({ createdAt: -1 });

    return teams;
  }

  /**
   * Get team by ID
   */
  async getTeamById(teamId, organizationId) {
    const team = await models.Team.findOne({
      _id: teamId,
      organizationId,
      status: { $ne: 'deleted' },
    })
      .populate('ownerId', 'name email')
      .populate('members.userId', 'name email');

    if (!team) {
      throw new Error('Team not found');
    }

    return team;
  }

  /**
   * Update team
   */
  async updateTeam(teamId, organizationId, updateData) {
    const { name, description, logo, settings } = updateData;

    const team = await models.Team.findOne({
      _id: teamId,
      organizationId,
      status: { $ne: 'deleted' },
    });

    if (!team) {
      throw new Error('Team not found');
    }

    if (name !== undefined) team.name = name.trim();
    if (description !== undefined) team.description = description?.trim();
    if (logo !== undefined) team.logo = logo;
    if (settings !== undefined) {
      team.settings = { ...team.settings, ...settings };
    }

    await team.save();
    return team;
  }

  /**
   * Delete team (soft delete)
   */
  async deleteTeam(teamId, organizationId) {
    const team = await models.Team.findOne({
      _id: teamId,
      organizationId,
      status: { $ne: 'deleted' },
    });

    if (!team) {
      throw new Error('Team not found');
    }

    // Soft delete
    team.status = 'deleted';
    await team.save();

    // Remove team memberships from all users
    const memberUserIds = team.members
      .filter((m) => m.status === 'active')
      .map((m) => m.userId);

    await models.User.updateMany(
      { _id: { $in: memberUserIds } },
      {
        $pull: {
          teamMemberships: {
            teamId: teamId,
            organizationId: organizationId,
          },
        },
      }
    );

    return team;
  }

  /**
   * Add member to team
   */
  async addMemberToTeam(teamId, organizationId, userId, role = 'member') {
    // Verify user is organization member
    const user = await models.User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const orgMembership = user.memberships?.find(
      (m) =>
        m.organizationId.toString() === organizationId.toString() &&
        m.status === 'active'
    );

    if (!orgMembership) {
      throw new Error('User is not a member of this organization');
    }

    // Get team
    const team = await models.Team.findOne({
      _id: teamId,
      organizationId,
      status: { $ne: 'deleted' },
    });

    if (!team) {
      throw new Error('Team not found');
    }

    // Check if user is already a member
    const existingMember = team.members.find(
      (m) => m.userId.toString() === userId.toString() && m.status === 'active'
    );

    if (existingMember) {
      throw new Error('User is already a member of this team');
    }

    // Add to team members array
    team.members.push({
      userId,
      role,
      joinedAt: new Date(),
      status: 'active',
    });

    await team.save();

    // Add to user's teamMemberships
    const existingMembership = user.teamMemberships?.find(
      (m) =>
        m.teamId.toString() === teamId.toString() &&
        m.organizationId.toString() === organizationId.toString()
    );

    if (!existingMembership) {
      await models.User.findByIdAndUpdate(userId, {
        $push: {
          teamMemberships: {
            teamId: teamId,
            organizationId: organizationId,
            role,
            joinedAt: new Date(),
            status: 'active',
          },
        },
      });
    } else if (existingMembership.status === 'inactive') {
      // Reactivate membership
      await models.User.updateOne(
        {
          _id: userId,
          'teamMemberships.teamId': teamId,
          'teamMemberships.organizationId': organizationId,
        },
        {
          $set: {
            'teamMemberships.$.status': 'active',
            'teamMemberships.$.role': role,
            'teamMemberships.$.joinedAt': new Date(),
          },
        }
      );
    }

    return team;
  }

  /**
   * Remove member from team
   */
  async removeMemberFromTeam(teamId, organizationId, userId) {
    // Get team
    const team = await models.Team.findOne({
      _id: teamId,
      organizationId,
      status: { $ne: 'deleted' },
    });

    if (!team) {
      throw new Error('Team not found');
    }

    // Check if user is team owner
    if (team.ownerId.toString() === userId.toString()) {
      throw new Error('Cannot remove team owner from team');
    }

    // Remove from team members array
    const memberIndex = team.members.findIndex(
      (m) => m.userId.toString() === userId.toString() && m.status === 'active'
    );

    if (memberIndex === -1) {
      throw new Error('User is not a member of this team');
    }

    team.members[memberIndex].status = 'inactive';
    await team.save();

    // Remove from user's teamMemberships
    await models.User.updateOne(
      {
        _id: userId,
        'teamMemberships.teamId': teamId,
        'teamMemberships.organizationId': organizationId,
      },
      {
        $set: {
          'teamMemberships.$.status': 'inactive',
        },
      }
    );

    return team;
  }
}
