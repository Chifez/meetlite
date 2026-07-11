import { v4 as uuidv4 } from 'uuid';
import { TeamService } from './team.service.js';
import { MultiOrganizationService } from './multi-organization.service.js';
import { EmailQueue, prisma } from '@minimeet/shared';
import { WORKSPACE_ROLES } from '@minimeet/shared';


export class TeamInvitationService {
  private teamService: TeamService;

  constructor() {
    this.teamService = new TeamService();
  }

  /**
   * Invite someone to join a team
   */
  async inviteToTeam(
    teamId: string,
    organizationId: string,
    invitedUserId: string | null,
    invitedBy: string,
    role = 'member',
    message = '',
    email: string | null = null
  ) {
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId,
        status: { not: 'deleted' },
      },
      include: { members: { where: { status: 'active' } } }
    });

    if (!team) {
      throw new Error('Team not found');
    }

    const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) {
      throw new Error('Organization not found');
    }

    let invitationData: any = {
      teamId,
      organizationId,
      invitedBy,
      role,
      inviteToken: uuidv4(),
      message: message.trim(),
    };

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();

      if (!normalizedEmail.includes('@')) {
        throw new Error('Invalid email address');
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: { memberships: true }
      });

      if (existingUser) {
        const isAlreadyMember = team.members.some(
          (m: any) => m.userId === existingUser.id
        );

        if (isAlreadyMember) {
          throw new Error('User is already a member of this team');
        }

        const existingInvitation = await prisma.teamInvitation.findFirst({
          where: {
            teamId,
            status: 'pending',
            OR: [
              { invitedUserId: existingUser.id },
              { email: normalizedEmail }
            ]
          }
        });

        if (existingInvitation) {
          throw new Error('There is already a pending invitation for this user');
        }

        const orgMembership = existingUser.memberships?.find(
          (m: any) => m.organizationId === organizationId && m.status === 'active'
        );

        if (orgMembership) {
          invitationData.invitedUserId = existingUser.id;
        } else {
          invitationData.email = normalizedEmail;
        }
      } else {
        const existingInvitation = await prisma.teamInvitation.findFirst({
          where: {
            teamId,
            email: normalizedEmail,
            status: 'pending'
          }
        });

        if (existingInvitation) {
          throw new Error('There is already a pending invitation for this email');
        }

        invitationData.email = normalizedEmail;
      }
    } else if (invitedUserId) {
      const invitedUser = await prisma.user.findUnique({
        where: { id: invitedUserId },
        include: { memberships: true }
      });
      if (!invitedUser) {
        throw new Error('Invited user not found');
      }

      const orgMembership = invitedUser.memberships?.find(
        (m: any) => m.organizationId === organizationId && m.status === 'active'
      );

      if (!orgMembership) {
        throw new Error('User must be an organization member to be invited to a team');
      }

      const isAlreadyMember = team.members.some(
        (m: any) => m.userId === invitedUserId
      );

      if (isAlreadyMember) {
        throw new Error('User is already a member of this team');
      }

      const existingInvitation = await prisma.teamInvitation.findFirst({
        where: {
          teamId,
          invitedUserId,
          status: 'pending'
        }
      });

      if (existingInvitation) {
        throw new Error('There is already a pending invitation for this user');
      }

      invitationData.invitedUserId = invitedUserId;
    } else {
      throw new Error('Either invitedUserId or email must be provided');
    }

    const invitation = await prisma.teamInvitation.create({ data: invitationData });

    try {
      const inviter = await prisma.user.findUnique({ where: { id: invitedBy } });
      const inviteUrl = `${process.env.CLIENT_URL}/teams/invite/${invitation.inviteToken}`;

      let recipientEmail = invitationData.email;
      if (!recipientEmail && invitationData.invitedUserId) {
        const invitedUser = await prisma.user.findUnique({ where: { id: invitationData.invitedUserId } });
        recipientEmail = invitedUser?.email;
      }

      if (!recipientEmail) {
        throw new Error('Cannot determine recipient email address');
      }

      const emailQueue = new EmailQueue();
      await emailQueue.addEmailJob(
        'team_invite',
        {
          userEmail: recipientEmail,
          teamName: team.name,
          organizationName: organization.name,
          inviterName: inviter?.name || inviter?.email || 'Someone',
          inviterEmail: inviter?.email || '',
          inviteUrl,
          inviteToken: invitation.inviteToken,
          message: message.trim(),
          role,
        },
        {
          priority: 1,
          jobId: `team-invite-${invitation.id}`,
        }
      );
    } catch (emailError) {
      await prisma.teamInvitation.delete({ where: { id: invitation.id } });
      console.error('Failed to queue team invitation email:', emailError);
      throw new Error('Failed to send invitation email');
    }

    return invitation;
  }

  /**
   * Accept team invitation
   */
  async acceptInvitation(inviteToken: string, userId: string) {
    const invitation = await prisma.teamInvitation.findUnique({
      where: { inviteToken },
      include: {
        organization: true,
        team: true
      }
    } as any); // Ignoring strict typing on findUnique if index is missing in prisma

    let actualInvitation = invitation;
    if (!actualInvitation) {
      actualInvitation = await prisma.teamInvitation.findFirst({
        where: { inviteToken },
        include: { team: true }
      });
      if (!actualInvitation) {
        throw new Error('Invitation not found or expired');
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: true }
    });
    if (!user) {
      throw new Error('User not found');
    }

    if (actualInvitation.email) {
      if (user.email.toLowerCase() !== actualInvitation.email.toLowerCase()) {
        throw new Error('This invitation is not for you');
      }
    } else if (actualInvitation.invitedUserId) {
      if (actualInvitation.invitedUserId !== userId) {
        throw new Error('This invitation is not for you');
      }
    } else {
      throw new Error('Invalid invitation format');
    }

    if (actualInvitation.status !== 'pending' || actualInvitation.expiresAt < new Date()) {
      throw new Error('Invitation cannot be accepted (expired or already processed)');
    }

    if (actualInvitation.email) {
      const orgMembership = user.memberships?.find(
        (m: any) =>
          m.organizationId === actualInvitation.organizationId && m.status === 'active'
      );

      if (!orgMembership) {
        await MultiOrganizationService.addUserToOrganization(
          userId,
          actualInvitation.organizationId,
          'member',
          actualInvitation.invitedBy
        );

        await prisma.organization.update({
          where: { id: actualInvitation.organizationId },
          data: {
            statsTotalMembers: { increment: 1 }
          }
        });
      }
    }

    const updatedInvitation = await prisma.teamInvitation.update({
      where: { id: actualInvitation.id },
      data: {
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedBy: userId,
        invitedUserId: actualInvitation.email && !actualInvitation.invitedUserId ? userId : actualInvitation.invitedUserId
      }
    });

    await this.teamService.addMemberToTeam(
      actualInvitation.teamId,
      actualInvitation.organizationId,
      userId,
      actualInvitation.role
    );

    return updatedInvitation;
  }

  /**
   * Decline team invitation
   */
  async declineInvitation(inviteToken: string, userId: string) {
    const invitation = await prisma.teamInvitation.findFirst({
      where: { inviteToken }
    });

    if (!invitation) {
      throw new Error('Invitation not found or expired');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    if (invitation.email) {
      if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        throw new Error('This invitation is not for you');
      }
    } else if (invitation.invitedUserId) {
      if (invitation.invitedUserId !== userId) {
        throw new Error('This invitation is not for you');
      }
    } else {
      throw new Error('Invalid invitation format');
    }

    const updatedInvitation = await prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: { status: 'rejected' }
    });

    return updatedInvitation;
  }

  /**
   * Get pending invitations for a user
   */
  async getPendingInvitations(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return [];
    }

    const invitations = await prisma.teamInvitation.findMany({
      where: {
        status: 'pending',
        expiresAt: { gt: new Date() },
        OR: [
          { invitedUserId: userId },
          { email: user.email }
        ]
      },
      include: {
        team: { select: { id: true, name: true, logo: true } },
        inviter: { select: { id: true, name: true, email: true } },
        organization: { select: { id: true, name: true, logo: true } }
      }
    } as any); // Ignoring strict typing for organization if not explicitly defined in relation

    // Deduplicate by ID
    const uniqueInvitations = Array.from(new Map(invitations.map(item => [item.id, item])).values());

    return uniqueInvitations;
  }

  /**
   * Get pending invitations for a team
   */
  async getPendingInvitationsByTeam(teamId: string, organizationId: string) {
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

    const invitations = await prisma.teamInvitation.findMany({
      where: {
        teamId,
        status: 'pending',
        expiresAt: { gt: new Date() }
      },
      include: {
        inviter: { select: { id: true, name: true, email: true } }
      }
    });
    return invitations;
  }

  /**
   * Cancel a team invitation (by inviter or team owner)
   */
  async cancelInvitation(invitationId: string, userId: string, organizationId: string) {
    const invitation = await prisma.teamInvitation.findUnique({ where: { id: invitationId } });

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.organizationId !== organizationId) {
      throw new Error('Invitation does not belong to this organization');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: true }
    });
    
    const orgMembership = user?.memberships?.find(
      (m: any) => m.organizationId === organizationId && m.status === 'active'
    );

    const isOrgOwnerOrAdmin =
      orgMembership &&
      (orgMembership.role === WORKSPACE_ROLES.OWNER || orgMembership.role === WORKSPACE_ROLES.ADMIN);
    const isInviter = invitation.invitedBy === userId;

    const team = await prisma.team.findUnique({
      where: { id: invitation.teamId },
      include: { members: { where: { status: 'active' } } }
    });
    const isTeamOwner = team && team.ownerId === userId;
    const isTeamAdmin =
      team &&
      team.members.some(
        (m: any) => m.userId === userId && m.role === WORKSPACE_ROLES.ADMIN
      );

    if (!isOrgOwnerOrAdmin && !isInviter && !isTeamOwner && !isTeamAdmin) {
      throw new Error('You do not have permission to cancel this invitation');
    }

    await prisma.teamInvitation.delete({ where: { id: invitationId } });

    return { success: true };
  }
}
