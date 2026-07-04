import { models } from '../index.js';

export class TeamService {
  /**
   * Create a new team
   */
  async createTeam(organizationId: any, ownerId: any, teamData: any) {
    const { name, description, logo, settings } = teamData;

    const organization = await models.Organization.findOne({
      _id: organizationId,
      status: 'active',
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    const user = await models.User.findById(ownerId);
    if (!user) {
      throw new Error('User not found');
    }

    const isOwner = organization.ownerId.toString() === ownerId.toString();

    const membership = user.memberships?.find(
      (m: any) =>
        m.organizationId.toString() === organizationId.toString() &&
        m.status === 'active'
    );

    if (
      !isOwner &&
      (!membership ||
        (membership.role !== 'owner' && membership.role !== 'admin'))
    ) {
      throw new Error('Only organization owners and admins can create teams');
    }

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
  async getTeamsByOrganization(organizationId: any, userId: any = null) {
    const query: any = {
      organizationId,
      status: { $ne: 'deleted' },
    };

    if (userId) {
      const user = await models.User.findById(userId);
      const orgMembership = user?.memberships?.find(
        (m: any) =>
          m.organizationId.toString() === organizationId.toString() &&
          m.status === 'active'
      );

      if (!orgMembership || orgMembership.role !== 'owner') {
        const userTeamIds =
          user?.teamMemberships
            ?.filter(
              (m: any) =>
                m.organizationId.toString() === organizationId.toString() &&
                m.status === 'active'
            )
            .map((m: any) => m.teamId) || [];

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
  async getTeamById(teamId: any, organizationId: any) {
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
  async updateTeam(teamId: any, organizationId: any, updateData: any) {
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
  async deleteTeam(teamId: any, organizationId: any) {
    const team = await models.Team.findOne({
      _id: teamId,
      organizationId,
      status: { $ne: 'deleted' },
    });

    if (!team) {
      throw new Error('Team not found');
    }

    team.status = 'deleted';
    await team.save();

    const memberUserIds = team.members
      .filter((m: any) => m.status === 'active')
      .map((m: any) => m.userId);

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
  async addMemberToTeam(teamId: any, organizationId: any, userId: any, role = 'member') {
    const user = await models.User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const orgMembership = user.memberships?.find(
      (m: any) =>
        m.organizationId.toString() === organizationId.toString() &&
        m.status === 'active'
    );

    if (!orgMembership) {
      throw new Error('User is not a member of this organization');
    }

    const team = await models.Team.findOne({
      _id: teamId,
      organizationId,
      status: { $ne: 'deleted' },
    });

    if (!team) {
      throw new Error('Team not found');
    }

    const existingMember = team.members.find(
      (m: any) => m.userId.toString() === userId.toString() && m.status === 'active'
    );

    if (existingMember) {
      throw new Error('User is already a member of this team');
    }

    team.members.push({
      userId,
      role,
      joinedAt: new Date(),
      status: 'active',
    });

    await team.save();

    const existingMembership = user.teamMemberships?.find(
      (m: any) =>
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
  async removeMemberFromTeam(teamId: any, organizationId: any, userId: any) {
    const team = await models.Team.findOne({
      _id: teamId,
      organizationId,
      status: { $ne: 'deleted' },
    });

    if (!team) {
      throw new Error('Team not found');
    }

    if (team.ownerId.toString() === userId.toString()) {
      throw new Error('Cannot remove team owner from team');
    }

    const memberIndex = team.members.findIndex(
      (m: any) => m.userId.toString() === userId.toString() && m.status === 'active'
    );

    if (memberIndex === -1) {
      throw new Error('User is not a member of this team');
    }

    team.members[memberIndex].status = 'inactive';
    await team.save();

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
