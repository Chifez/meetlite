import { models } from '../index.js';
import { TeamInvitationService } from '../services/team-invitation.service.js';
import { ResponseHelpers, AppError } from '@minimeet/shared';

export class TeamInvitationController {
  constructor() {
    this.invitationService = new TeamInvitationService();
  }

  // POST /organizations/:organizationId/teams/:teamId/invite - Invite member to team
  async inviteToTeam(req, res) {
    const { organizationId, teamId } = req.params;
    const userId = req.user._id;
    const { invitedUserId, email, role = 'member', message = '' } = req.body;

    if (!organizationId || !teamId) {
      throw AppError.validation('Organization ID and Team ID are required');
    }

    if (!invitedUserId && !email) {
      throw AppError.validation('Either invitedUserId or email must be provided');
    }

    if (invitedUserId && email) {
      throw AppError.validation('Cannot provide both invitedUserId and email');
    }

    if (!['member', 'admin', 'owner'].includes(role)) {
      throw AppError.validation('Invalid role. Must be member, admin, or owner');
    }

    const invitation = await this.invitationService.inviteToTeam(
      teamId,
      organizationId,
      invitedUserId || null,
      userId,
      role,
      message,
      email || null
    );

    return ResponseHelpers.created(res, {
      invitation: {
        id: invitation._id,
        teamId: invitation.teamId,
        organizationId: invitation.organizationId,
        invitedUserId: invitation.invitedUserId,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      },
      message: 'Team invitation sent successfully',
    });
  }

  // GET /organizations/:organizationId/teams/:teamId/invitations - Get pending invitations for a team
  async getTeamInvitations(req, res) {
    const { organizationId, teamId } = req.params;

    if (!organizationId || !teamId) {
      throw AppError.validation('Organization ID and Team ID are required');
    }

    const invitations =
      await this.invitationService.getPendingInvitationsByTeam(
        teamId,
        organizationId
      );

    return ResponseHelpers.ok(res, {
      invitations: invitations.map((inv) => ({
        id: inv._id,
        teamId: inv.teamId,
        organizationId: inv.organizationId,
        invitedUserId: inv.invitedUserId._id || inv.invitedUserId,
        invitedUserName: inv.invitedUserId.name || inv.invitedUserId.email,
        invitedUserEmail: inv.invitedUserId.email,
        invitedBy: inv.invitedBy._id || inv.invitedBy,
        invitedByName: inv.invitedBy.name || inv.invitedBy.email,
        role: inv.role,
        message: inv.message,
        status: inv.status,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      })),
    });
  }

  // GET /teams/invitations - Get pending invitations for current user
  async getMyInvitations(req, res) {
    const userId = req.user._id;

    const invitations = await this.invitationService.getPendingInvitations(
      userId
    );

    return ResponseHelpers.ok(res, {
      invitations: invitations.map((inv) => ({
        id: inv._id,
        teamId: inv.teamId._id || inv.teamId,
        teamName: inv.teamId.name,
        teamSlug: inv.teamId.slug,
        organizationId: inv.organizationId._id || inv.organizationId,
        organizationName: inv.organizationId.name,
        invitedBy: inv.invitedBy._id || inv.invitedBy,
        invitedByName: inv.invitedBy.name || inv.invitedBy.email,
        role: inv.role,
        message: inv.message,
        status: inv.status,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        inviteToken: inv.inviteToken,
      })),
    });
  }

  // POST /teams/invitations/:token/accept - Accept team invitation
  async acceptInvitation(req, res) {
    const { token } = req.params;
    const userId = req.user._id;

    if (!token) {
      throw AppError.validation('Invitation token is required');
    }

    const invitation = await this.invitationService.acceptInvitation(
      token,
      userId
    );

    return ResponseHelpers.ok(res, {
      invitation: {
        id: invitation._id,
        teamId: invitation.teamId._id || invitation.teamId,
        teamName: invitation.teamId.name,
        organizationId:
          invitation.organizationId._id || invitation.organizationId,
        status: invitation.status,
        acceptedAt: invitation.acceptedAt,
      },
      message: 'Team invitation accepted successfully',
    });
  }

  // POST /teams/invitations/:token/decline - Decline team invitation
  async declineInvitation(req, res) {
    const { token } = req.params;
    const userId = req.user._id;

    if (!token) {
      throw AppError.validation('Invitation token is required');
    }

    const invitation = await this.invitationService.declineInvitation(
      token,
      userId
    );

    return ResponseHelpers.ok(res, {
      invitation: {
        id: invitation._id,
        teamId: invitation.teamId._id || invitation.teamId,
        status: invitation.status,
      },
      message: 'Team invitation declined',
    });
  }

  // DELETE /organizations/:organizationId/teams/:teamId/invitations/:invitationId - Cancel invitation
  async cancelInvitation(req, res) {
    const { organizationId, teamId, invitationId } = req.params;
    const userId = req.user._id;

    if (!organizationId || !teamId || !invitationId) {
      throw AppError.validation(
        'Organization ID, Team ID, and Invitation ID are required'
      );
    }

    await this.invitationService.cancelInvitation(
      invitationId,
      userId,
      organizationId
    );

    return ResponseHelpers.ok(res, {
      message: 'Invitation cancelled successfully',
    });
  }
}
