import { v4 as uuidv4 } from 'uuid';
import { models } from '../index.js';
// @ts-ignore
import { TeamService } from './team.service.js';
// @ts-ignore
import { MultiOrganizationService } from './multi-organization.service.js';
import { EmailQueue } from '@minimeet/shared';

export class TeamInvitationService {
  private teamService: TeamService;

  constructor() {
    this.teamService = new TeamService();
  }

  /**
   * Invite someone to join a team
   */
  async inviteToTeam(
    teamId: any,
    organizationId: any,
    invitedUserId: any,
    invitedBy: any,
    role = 'member',
    message = '',
    email: string | null = null
  ) {
    const team = await models.Team.findOne({
      _id: teamId,
      organizationId,
      status: { $ne: 'deleted' },
    });

    if (!team) {
      throw new Error('Team not found');
    }

    const organization = await models.Organization.findById(organizationId);
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

      const existingUser = await models.User.findOne({
        email: normalizedEmail,
      });

      if (existingUser) {
        const isAlreadyMember = team.members.some(
          (m: any) =>
            m.userId.toString() === existingUser._id.toString() &&
            m.status === 'active'
        );

        if (isAlreadyMember) {
          throw new Error('User is already a member of this team');
        }

        const existingInvitation =
          (await models.TeamInvitation.findPendingInvitation(
            teamId,
            existingUser._id
          )) ||
          (await models.TeamInvitation.findPendingInvitationByEmail(
            teamId,
            normalizedEmail
          ));

        if (existingInvitation) {
          throw new Error(
            'There is already a pending invitation for this user'
          );
        }

        const orgMembership = existingUser.memberships?.find(
          (m: any) =>
            m.organizationId.toString() === organizationId.toString() &&
            m.status === 'active'
        );

        if (orgMembership) {
          invitationData.invitedUserId = existingUser._id;
        } else {
          invitationData.email = normalizedEmail;
        }
      } else {
        const existingInvitation =
          await models.TeamInvitation.findPendingInvitationByEmail(
            teamId,
            normalizedEmail
          );

        if (existingInvitation) {
          throw new Error(
            'There is already a pending invitation for this email'
          );
        }

        invitationData.email = normalizedEmail;
      }
    } else if (invitedUserId) {
      const invitedUser = await models.User.findById(invitedUserId);
      if (!invitedUser) {
        throw new Error('Invited user not found');
      }

      const orgMembership = invitedUser.memberships?.find(
        (m: any) =>
          m.organizationId.toString() === organizationId.toString() &&
          m.status === 'active'
      );

      if (!orgMembership) {
        throw new Error(
          'User must be an organization member to be invited to a team'
        );
      }

      const isAlreadyMember = team.members.some(
        (m: any) =>
          m.userId.toString() === invitedUserId.toString() &&
          m.status === 'active'
      );

      if (isAlreadyMember) {
        throw new Error('User is already a member of this team');
      }

      const existingInvitation =
        await models.TeamInvitation.findPendingInvitation(
          teamId,
          invitedUserId
        );

      if (existingInvitation) {
        throw new Error('There is already a pending invitation for this user');
      }

      invitationData.invitedUserId = invitedUserId;
    } else {
      throw new Error('Either invitedUserId or email must be provided');
    }

    const invitation = new models.TeamInvitation(invitationData);
    await invitation.save();

    try {
      const inviter = await models.User.findById(invitedBy);
      const inviteUrl = `${process.env.CLIENT_URL}/teams/invite/${invitation.inviteToken}`;

      let recipientEmail = invitationData.email;
      if (!recipientEmail && invitationData.invitedUserId) {
        const invitedUser = await models.User.findById(
          invitationData.invitedUserId
        );
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
          jobId: `team-invite-${invitation._id}`,
        }
      );
    } catch (emailError) {
      await models.TeamInvitation.findByIdAndDelete(invitation._id);
      console.error('Failed to queue team invitation email:', emailError);
      throw new Error('Failed to send invitation email');
    }

    return invitation;
  }

  /**
   * Accept team invitation
   */
  async acceptInvitation(inviteToken: string, userId: any) {
    const invitation = await models.TeamInvitation.findByToken(inviteToken);

    if (!invitation) {
      throw new Error('Invitation not found or expired');
    }

    const user = await models.User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (invitation.email) {
      if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        throw new Error('This invitation is not for you');
      }
    } else if (invitation.invitedUserId) {
      if (invitation.invitedUserId.toString() !== userId.toString()) {
        throw new Error('This invitation is not for you');
      }
    } else {
      throw new Error('Invalid invitation format');
    }

    if (!invitation.canBeAccepted()) {
      throw new Error(
        'Invitation cannot be accepted (expired or already processed)'
      );
    }

    if (invitation.email) {
      const orgMembership = user.memberships?.find(
        (m: any) =>
          m.organizationId.toString() ===
            invitation.organizationId._id.toString() && m.status === 'active'
      );

      if (!orgMembership) {
        await MultiOrganizationService.addUserToOrganization(
          userId,
          invitation.organizationId._id,
          'member',
          invitation.invitedBy
        );

        await models.Organization.findByIdAndUpdate(
          invitation.organizationId._id,
          {
            $inc: { 'stats.totalMembers': 1 },
          }
        );
      }
    }

    await invitation.accept(userId);

    if (invitation.email && !invitation.invitedUserId) {
      invitation.invitedUserId = userId;
      await invitation.save();
    }

    await this.teamService.addMemberToTeam(
      invitation.teamId._id,
      invitation.organizationId._id,
      userId,
      invitation.role
    );

    return invitation;
  }

  /**
   * Decline team invitation
   */
  async declineInvitation(inviteToken: string, userId: any) {
    const invitation = await models.TeamInvitation.findByToken(inviteToken);

    if (!invitation) {
      throw new Error('Invitation not found or expired');
    }

    const user = await models.User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (invitation.email) {
      if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        throw new Error('This invitation is not for you');
      }
    } else if (invitation.invitedUserId) {
      if (invitation.invitedUserId.toString() !== userId.toString()) {
        throw new Error('This invitation is not for you');
      }
    } else {
      throw new Error('Invalid invitation format');
    }

    await invitation.decline();

    return invitation;
  }

  /**
   * Get pending invitations for a user
   */
  async getPendingInvitations(userId: any) {
    const user = await models.User.findById(userId);
    if (!user) {
      return [];
    }

    const invitationsByUserId =
      await models.TeamInvitation.findPendingInvitationsByUser(userId);

    const invitationsByEmail =
      await models.TeamInvitation.findPendingInvitationsByEmail(user.email);

    const allInvitations = [...invitationsByUserId, ...invitationsByEmail];
    const uniqueInvitations = allInvitations.filter(
      (inv: any, index, self) =>
        index === self.findIndex((i: any) => i._id.toString() === inv._id.toString())
    );

    return uniqueInvitations;
  }

  /**
   * Get pending invitations for a team
   */
  async getPendingInvitationsByTeam(teamId: any, organizationId: any) {
    const team = await models.Team.findOne({
      _id: teamId,
      organizationId,
      status: { $ne: 'deleted' },
    });

    if (!team) {
      throw new Error('Team not found');
    }

    const invitations =
      await models.TeamInvitation.findPendingInvitationsByTeam(teamId);
    return invitations;
  }

  /**
   * Cancel a team invitation (by inviter or team owner)
   */
  async cancelInvitation(invitationId: any, userId: any, organizationId: any) {
    const invitation = await models.TeamInvitation.findById(invitationId);

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.organizationId.toString() !== organizationId.toString()) {
      throw new Error('Invitation does not belong to this organization');
    }

    const user = await models.User.findById(userId);
    const orgMembership = user.memberships?.find(
      (m: any) =>
        m.organizationId.toString() === organizationId.toString() &&
        m.status === 'active'
    );

    const isOrgOwnerOrAdmin =
      orgMembership &&
      (orgMembership.role === 'owner' || orgMembership.role === 'admin');
    const isInviter = invitation.invitedBy.toString() === userId.toString();

    const team = await models.Team.findById(invitation.teamId);
    const isTeamOwner = team && team.ownerId.toString() === userId.toString();
    const isTeamAdmin =
      team &&
      team.members.some(
        (m: any) =>
          m.userId.toString() === userId.toString() &&
          m.role === 'admin' &&
          m.status === 'active'
      );

    if (!isOrgOwnerOrAdmin && !isInviter && !isTeamOwner && !isTeamAdmin) {
      throw new Error('You do not have permission to cancel this invitation');
    }

    await models.TeamInvitation.findByIdAndDelete(invitationId);

    return { success: true };
  }
}
