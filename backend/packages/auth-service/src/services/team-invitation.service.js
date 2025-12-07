import { v4 as uuidv4 } from 'uuid';
import { models } from '../index.js';
import { TeamService } from './team.service.js';
import { MultiOrganizationService } from './multi-organization.service.js';

export class TeamInvitationService {
  constructor() {
    this.teamService = new TeamService();
  }

  /**
   * Invite someone to join a team
   * Can accept either invitedUserId (for existing org members) or email (for new invites)
   */
  async inviteToTeam(
    teamId,
    organizationId,
    invitedUserId,
    invitedBy,
    role = 'member',
    message = '',
    email = null
  ) {
    // Verify team exists and belongs to organization
    const team = await models.Team.findOne({
      _id: teamId,
      organizationId,
      status: { $ne: 'deleted' },
    });

    if (!team) {
      throw new Error('Team not found');
    }

    // Get organization details
    const organization = await models.Organization.findById(organizationId);
    if (!organization) {
      throw new Error('Organization not found');
    }

    let invitationData = {
      teamId,
      organizationId,
      invitedBy,
      role,
      inviteToken: uuidv4(),
      message: message.trim(),
    };

    // Handle email-based invitation (for non-org members)
    if (email) {
      const normalizedEmail = email.toLowerCase().trim();

      // Validate email format
      if (!normalizedEmail.includes('@')) {
        throw new Error('Invalid email address');
      }

      // Check if user exists with this email
      const existingUser = await models.User.findOne({
        email: normalizedEmail,
      });

      if (existingUser) {
        // User exists - check if they're already a team member
        const isAlreadyMember = team.members.some(
          (m) =>
            m.userId.toString() === existingUser._id.toString() &&
            m.status === 'active'
        );

        if (isAlreadyMember) {
          throw new Error('User is already a member of this team');
        }

        // Check if there's already a pending invitation
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

        // Check if user is org member - if yes, use userId; if no, use email
        const orgMembership = existingUser.memberships?.find(
          (m) =>
            m.organizationId.toString() === organizationId.toString() &&
            m.status === 'active'
        );

        if (orgMembership) {
          // User is org member, use userId
          invitationData.invitedUserId = existingUser._id;
        } else {
          // User exists but not org member, use email (will add to org on accept)
          invitationData.email = normalizedEmail;
        }
      } else {
        // User doesn't exist, use email
        // Check if there's already a pending invitation for this email
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
      // Handle userId-based invitation (for existing org members)
      const invitedUser = await models.User.findById(invitedUserId);
      if (!invitedUser) {
        throw new Error('Invited user not found');
      }

      const orgMembership = invitedUser.memberships?.find(
        (m) =>
          m.organizationId.toString() === organizationId.toString() &&
          m.status === 'active'
      );

      if (!orgMembership) {
        throw new Error(
          'User must be an organization member to be invited to a team'
        );
      }

      // Check if user is already a team member
      const isAlreadyMember = team.members.some(
        (m) =>
          m.userId.toString() === invitedUserId.toString() &&
          m.status === 'active'
      );

      if (isAlreadyMember) {
        throw new Error('User is already a member of this team');
      }

      // Check if there's already a pending invitation
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

    // Create invitation
    const invitation = new models.TeamInvitation(invitationData);
    await invitation.save();

    // Send invitation email
    try {
      const { sendTeamInvitationEmail } = await import('./email-service.js');
      const inviter = await models.User.findById(invitedBy);
      const inviteUrl = `${process.env.CLIENT_URL}/teams/invite/${invitation.inviteToken}`;

      // Get email address
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

      await sendTeamInvitationEmail({
        email: recipientEmail,
        teamName: team.name,
        organizationName: organization.name,
        inviterName: inviter?.name || inviter?.email || 'Someone',
        inviterEmail: inviter?.email || '',
        inviteUrl,
        message: message.trim(),
        role,
      });
    } catch (emailError) {
      // If email fails, remove the invitation
      await models.TeamInvitation.findByIdAndDelete(invitation._id);
      console.error('Failed to send team invitation email:', emailError);
      throw new Error('Failed to send invitation email');
    }

    return invitation;
  }

  /**
   * Accept team invitation
   * Handles both userId-based and email-based invitations
   */
  async acceptInvitation(inviteToken, userId) {
    // Find invitation by token
    const invitation = await models.TeamInvitation.findByToken(inviteToken);

    if (!invitation) {
      throw new Error('Invitation not found or expired');
    }

    const user = await models.User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify the invitation is for this user
    // For email-based invitations, check if email matches
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

    // Check if invitation can be accepted
    if (!invitation.canBeAccepted()) {
      throw new Error(
        'Invitation cannot be accepted (expired or already processed)'
      );
    }

    // If invitation is email-based, ensure user is added to organization first
    if (invitation.email) {
      const orgMembership = user.memberships?.find(
        (m) =>
          m.organizationId.toString() ===
            invitation.organizationId._id.toString() && m.status === 'active'
      );

      if (!orgMembership) {
        // Add user to organization first (as member role)
        await MultiOrganizationService.addUserToOrganization(
          userId,
          invitation.organizationId._id,
          'member', // Default to member role for org
          invitation.invitedBy
        );

        // Update organization member count
        await models.Organization.findByIdAndUpdate(
          invitation.organizationId._id,
          {
            $inc: { 'stats.totalMembers': 1 },
          }
        );
      }
    }

    // Accept invitation
    await invitation.accept(userId);

    // Update invitation with userId if it was email-based
    if (invitation.email && !invitation.invitedUserId) {
      invitation.invitedUserId = userId;
      await invitation.save();
    }

    // Add user to team using TeamService
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
  async declineInvitation(inviteToken, userId) {
    // Find invitation by token
    const invitation = await models.TeamInvitation.findByToken(inviteToken);

    if (!invitation) {
      throw new Error('Invitation not found or expired');
    }

    const user = await models.User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify the invitation is for this user
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

    // Decline invitation
    await invitation.decline();

    return invitation;
  }

  /**
   * Get pending invitations for a user
   */
  async getPendingInvitations(userId) {
    const user = await models.User.findById(userId);
    if (!user) {
      return [];
    }

    // Get invitations by userId
    const invitationsByUserId =
      await models.TeamInvitation.findPendingInvitationsByUser(userId);

    // Get invitations by email
    const invitationsByEmail =
      await models.TeamInvitation.findPendingInvitationsByEmail(user.email);

    // Combine and deduplicate
    const allInvitations = [...invitationsByUserId, ...invitationsByEmail];
    const uniqueInvitations = allInvitations.filter(
      (inv, index, self) =>
        index === self.findIndex((i) => i._id.toString() === inv._id.toString())
    );

    return uniqueInvitations;
  }

  /**
   * Get pending invitations for a team
   */
  async getPendingInvitationsByTeam(teamId, organizationId) {
    // Verify team exists
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
  async cancelInvitation(invitationId, userId, organizationId) {
    const invitation = await models.TeamInvitation.findById(invitationId);

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    // Verify invitation belongs to organization
    if (invitation.organizationId.toString() !== organizationId.toString()) {
      throw new Error('Invitation does not belong to this organization');
    }

    // Verify user has permission (inviter, team owner, or org owner)
    const user = await models.User.findById(userId);
    const orgMembership = user.memberships?.find(
      (m) =>
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
        (m) =>
          m.userId.toString() === userId.toString() &&
          m.role === 'admin' &&
          m.status === 'active'
      );

    if (!isOrgOwnerOrAdmin && !isInviter && !isTeamOwner && !isTeamAdmin) {
      throw new Error('You do not have permission to cancel this invitation');
    }

    // Delete invitation
    await models.TeamInvitation.findByIdAndDelete(invitationId);

    return { success: true };
  }
}
