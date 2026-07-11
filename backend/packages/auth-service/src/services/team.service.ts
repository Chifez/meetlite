import { prisma } from '@minimeet/shared';
import { WORKSPACE_ROLES } from '@minimeet/shared';


export class TeamService {
  /**
   * Create a new team
   */
  async createTeam(organizationId: string, ownerId: string, teamData: any) {
    const { name, description, logo, settings } = teamData;

    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        status: 'active',
      }
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    const user = await prisma.user.findUnique({
      where: { id: ownerId },
      include: { memberships: true }
    });
    
    if (!user) {
      throw new Error('User not found');
    }

    const isOwner = organization.ownerId === ownerId;

    const membership = user.memberships?.find(
      (m: any) =>
        m.organizationId === organizationId &&
        m.status === 'active'
    );

    if (
      !isOwner &&
      (!membership ||
        (membership.role !== WORKSPACE_ROLES.OWNER && membership.role !== WORKSPACE_ROLES.ADMIN))
    ) {
      throw new Error('Only organization owners and admins can create teams');
    }

    let slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const existingTeam = await prisma.team.findUnique({
      where: {
        organizationId_slug: {
          organizationId,
          slug
        }
      }
    });
    if (existingTeam) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    const team = await prisma.team.create({
      data: {
        organizationId,
        ownerId,
        name: name.trim(),
        slug,
        description: description?.trim(),
        logo,
        allowPublicMeetings: settings?.allowPublicMeetings ?? true,
        requireMeetingApproval: settings?.requireMeetingApproval ?? false,
        maxMeetingDuration: settings?.maxMeetingDuration ?? 480,
        allowExternalParticipants: settings?.allowExternalParticipants ?? true,
        defaultMeetingPrivacy: settings?.defaultMeetingPrivacy ?? 'public',
        members: {
          create: {
            userId: ownerId,
            role: 'owner',
            status: 'active',
          }
        }
      },
      include: {
        members: true
      }
    });

    return {
      ...team,
      settings: {
        allowPublicMeetings: team.allowPublicMeetings,
        requireMeetingApproval: team.requireMeetingApproval,
        maxMeetingDuration: team.maxMeetingDuration,
        allowExternalParticipants: team.allowExternalParticipants,
        defaultMeetingPrivacy: team.defaultMeetingPrivacy
      }
    };
  }

  /**
   * Get all teams for an organization
   */
  async getTeamsByOrganization(organizationId: string, userId: string | null = null) {
    const whereClause: any = {
      organizationId,
      status: { not: 'deleted' },
    };

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { memberships: true, teamMemberships: true }
      });
      const orgMembership = user?.memberships?.find(
        (m: any) =>
          m.organizationId === organizationId &&
          m.status === 'active'
      );

      if (!orgMembership || orgMembership.role !== WORKSPACE_ROLES.OWNER) {
        const userTeamIds =
          user?.teamMemberships
            ?.filter(
              (m: any) => m.status === 'active'
            )
            .map((m: any) => m.teamId) || [];

        whereClause.id = { in: userTeamIds };
      }
    }

    const teams = await prisma.team.findMany({
      where: whereClause,
      include: {
        owner: {
          select: { id: true, name: true, email: true }
        },
        members: {
          where: { status: 'active' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return teams.map(team => ({
      ...team,
      ownerId: team.owner,
      settings: {
        allowPublicMeetings: team.allowPublicMeetings,
        requireMeetingApproval: team.requireMeetingApproval,
        maxMeetingDuration: team.maxMeetingDuration,
        allowExternalParticipants: team.allowExternalParticipants,
        defaultMeetingPrivacy: team.defaultMeetingPrivacy
      }
    }));
  }

  /**
   * Get team by ID
   */
  async getTeamById(teamId: string, organizationId: string) {
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId,
        status: { not: 'deleted' },
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    if (!team) {
      throw new Error('Team not found');
    }

    return {
      ...team,
      ownerId: team.owner,
      settings: {
        allowPublicMeetings: team.allowPublicMeetings,
        requireMeetingApproval: team.requireMeetingApproval,
        maxMeetingDuration: team.maxMeetingDuration,
        allowExternalParticipants: team.allowExternalParticipants,
        defaultMeetingPrivacy: team.defaultMeetingPrivacy
      }
    };
  }

  /**
   * Update team
   */
  async updateTeam(teamId: string, organizationId: string, updateData: any) {
    const { name, description, logo, settings } = updateData;

    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId,
        status: { not: 'deleted' },
      }
    });

    if (!team) {
      throw new Error('Team not found');
    }

    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description?.trim();
    if (logo !== undefined) data.logo = logo;
    if (settings !== undefined) {
      if (settings.allowPublicMeetings !== undefined) data.allowPublicMeetings = settings.allowPublicMeetings;
      if (settings.requireMeetingApproval !== undefined) data.requireMeetingApproval = settings.requireMeetingApproval;
      if (settings.maxMeetingDuration !== undefined) data.maxMeetingDuration = settings.maxMeetingDuration;
      if (settings.allowExternalParticipants !== undefined) data.allowExternalParticipants = settings.allowExternalParticipants;
      if (settings.defaultMeetingPrivacy !== undefined) data.defaultMeetingPrivacy = settings.defaultMeetingPrivacy;
    }

    const updatedTeam = await prisma.team.update({
      where: { id: teamId },
      data
    });

    return {
      ...updatedTeam,
      settings: {
        allowPublicMeetings: updatedTeam.allowPublicMeetings,
        requireMeetingApproval: updatedTeam.requireMeetingApproval,
        maxMeetingDuration: updatedTeam.maxMeetingDuration,
        allowExternalParticipants: updatedTeam.allowExternalParticipants,
        defaultMeetingPrivacy: updatedTeam.defaultMeetingPrivacy
      }
    };
  }

  /**
   * Delete team (soft delete)
   */
  async deleteTeam(teamId: string, organizationId: string) {
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId,
        status: { not: 'deleted' },
      }
    });

    if (!team) {
      throw new Error('Team not found');
    }

    await prisma.$transaction(async (tx) => {
      await tx.team.update({
        where: { id: teamId },
        data: { status: 'deleted' }
      });

      await tx.teamMember.updateMany({
        where: { teamId },
        data: { status: 'deleted' }
      });
    });

    return team;
  }

  /**
   * Add member to team
   */
  async addMemberToTeam(teamId: string, organizationId: string, userId: string, role = 'member') {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { memberships: true }
      });
      if (!user) {
        throw new Error('User not found');
      }

      const orgMembership = user.memberships?.find(
        (m: any) =>
          m.organizationId === organizationId &&
          m.status === 'active'
      );

      if (!orgMembership) {
        throw new Error('User is not a member of this organization');
      }

      const team = await tx.team.findFirst({
        where: {
          id: teamId,
          organizationId,
          status: { not: 'deleted' },
        },
        include: { members: true }
      });

      if (!team) {
        throw new Error('Team not found');
      }

      const existingMember = team.members.find(
        (m: any) => m.userId === userId
      );

      if (existingMember && existingMember.status === 'active') {
        throw new Error('User is already a member of this team');
      }

      if (existingMember) {
        await tx.teamMember.update({
          where: { id: existingMember.id },
          data: {
            role,
            status: 'active',
            joinedAt: new Date(),
          }
        });
      } else {
        await tx.teamMember.create({
          data: {
            teamId,
            userId,
            role,
            status: 'active',
          }
        });
      }

      const updatedTeam = await tx.team.findUnique({
        where: { id: teamId },
        include: { members: { where: { status: 'active' } } }
      });

      return updatedTeam;
    });
  }

  /**
   * Remove member from team
   */
  async removeMemberFromTeam(teamId: string, organizationId: string, userId: string) {
    return await prisma.$transaction(async (tx) => {
      const team = await tx.team.findFirst({
        where: {
          id: teamId,
          organizationId,
          status: { not: 'deleted' },
        },
        include: { members: true }
      });

      if (!team) {
        throw new Error('Team not found');
      }

      if (team.ownerId === userId) {
        throw new Error('Cannot remove team owner from team');
      }

      const member = team.members.find(
        (m: any) => m.userId === userId && m.status === 'active'
      );

      if (!member) {
        throw new Error('User is not a member of this team');
      }

      await tx.teamMember.update({
        where: { id: member.id },
        data: { status: 'inactive' }
      });

      const updatedTeam = await tx.team.findUnique({
        where: { id: teamId },
        include: { members: { where: { status: 'active' } } }
      });

      return updatedTeam;
    });
  }
}
