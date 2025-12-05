import { v4 as uuidv4 } from 'uuid';
import { models } from '../index.js';
import { TeamService } from './team.service.js';

export class TeamInvitationService {
  constructor() {
    this.teamService = new TeamService();
  }

  /**
   * Invite an organization member to join a team
   */
  async inviteToTeam(
    teamId,
    organizationId,
    invitedUserId,
    invitedBy,
    role = 'member',
    message = ''
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

    // Verify invited user is an organization member
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
      await models.TeamInvitation.findPendingInvitation(teamId, invitedUserId);

    if (existingInvitation) {
      throw new Error('There is already a pending invitation for this user');
    }

    // Create invitation
    const inviteToken = uuidv4();
    const invitation = new models.TeamInvitation({
      teamId,
      organizationId,
      invitedUserId,
      invitedBy,
      role,
      inviteToken,
      message: message.trim(),
    });

    await invitation.save();

    // TODO: Send notification email to user
    // await sendTeamInvitationEmail(invitedUser.email, team.name, organizationId.name);

    return invitation;
  }

  /**
   * Accept team invitation
   */
  async acceptInvitation(inviteToken, userId) {
    // Find invitation by token
    const invitation = await models.TeamInvitation.findByToken(inviteToken);

    if (!invitation) {
      throw new Error('Invitation not found or expired');
    }

    // Verify the invitation is for this user
    if (invitation.invitedUserId.toString() !== userId.toString()) {
      throw new Error('This invitation is not for you');
    }

    // Check if invitation can be accepted
    if (!invitation.canBeAccepted()) {
      throw new Error(
        'Invitation cannot be accepted (expired or already processed)'
      );
    }

    // Accept invitation
    await invitation.accept(userId);

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

    // Verify the invitation is for this user
    if (invitation.invitedUserId.toString() !== userId.toString()) {
      throw new Error('This invitation is not for you');
    }

    // Decline invitation
    await invitation.decline();

    return invitation;
  }

  /**
   * Get pending invitations for a user
   */
  async getPendingInvitations(userId) {
    const invitations =
      await models.TeamInvitation.findPendingInvitationsByUser(userId);
    return invitations;
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
