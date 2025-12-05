import { models } from '../index.js';
import { TeamInvitationService } from '../services/team-invitation.service.js';
import { ResponseHelpers } from '@minimeet/shared-models';

export class TeamInvitationController {
  constructor() {
    this.invitationService = new TeamInvitationService();
  }

  // POST /organizations/:organizationId/teams/:teamId/invite - Invite member to team
  async inviteToTeam(req, res) {
    try {
      const { organizationId, teamId } = req.params;
      const userId = req.user._id;
      const { invitedUserId, role = 'member', message = '' } = req.body;

      if (!organizationId || !teamId || !invitedUserId) {
        return ResponseHelpers.badRequest(
          res,
          'Organization ID, Team ID, and User ID are required'
        );
      }

      if (!['member', 'admin', 'owner'].includes(role)) {
        return ResponseHelpers.badRequest(
          res,
          'Invalid role. Must be member, admin, or owner'
        );
      }

      const invitation = await this.invitationService.inviteToTeam(
        teamId,
        organizationId,
        invitedUserId,
        userId,
        role,
        message
      );

      return ResponseHelpers.created(res, {
        invitation: {
          id: invitation._id,
          teamId: invitation.teamId,
          organizationId: invitation.organizationId,
          invitedUserId: invitation.invitedUserId,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
        },
        message: 'Team invitation sent successfully',
      });
    } catch (error) {
      console.error('Invite to team error:', error);
      if (
        error.message.includes('not found') ||
        error.message.includes('already') ||
        error.message.includes('must be an organization member')
      ) {
        return ResponseHelpers.badRequest(res, error.message);
      }
      return ResponseHelpers.serverError(res, 'Failed to send team invitation');
    }
  }

  // GET /organizations/:organizationId/teams/:teamId/invitations - Get pending invitations for a team
  async getTeamInvitations(req, res) {
    try {
      const { organizationId, teamId } = req.params;

      if (!organizationId || !teamId) {
        return ResponseHelpers.badRequest(
          res,
          'Organization ID and Team ID are required'
        );
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
    } catch (error) {
      console.error('Get team invitations error:', error);
      if (error.message === 'Team not found') {
        return ResponseHelpers.notFound(res, error.message);
      }
      return ResponseHelpers.serverError(
        res,
        'Failed to retrieve team invitations'
      );
    }
  }

  // GET /teams/invitations - Get pending invitations for current user
  async getMyInvitations(req, res) {
    try {
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
    } catch (error) {
      console.error('Get my invitations error:', error);
      return ResponseHelpers.serverError(res, 'Failed to retrieve invitations');
    }
  }

  // POST /teams/invitations/:token/accept - Accept team invitation
  async acceptInvitation(req, res) {
    try {
      const { token } = req.params;
      const userId = req.user._id;

      if (!token) {
        return ResponseHelpers.badRequest(res, 'Invitation token is required');
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
    } catch (error) {
      console.error('Accept invitation error:', error);
      if (
        error.message.includes('not found') ||
        error.message.includes('expired') ||
        error.message.includes('not for you') ||
        error.message.includes('cannot be accepted')
      ) {
        return ResponseHelpers.badRequest(res, error.message);
      }
      return ResponseHelpers.serverError(res, 'Failed to accept invitation');
    }
  }

  // POST /teams/invitations/:token/decline - Decline team invitation
  async declineInvitation(req, res) {
    try {
      const { token } = req.params;
      const userId = req.user._id;

      if (!token) {
        return ResponseHelpers.badRequest(res, 'Invitation token is required');
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
    } catch (error) {
      console.error('Decline invitation error:', error);
      if (
        error.message.includes('not found') ||
        error.message.includes('expired') ||
        error.message.includes('not for you')
      ) {
        return ResponseHelpers.badRequest(res, error.message);
      }
      return ResponseHelpers.serverError(res, 'Failed to decline invitation');
    }
  }

  // DELETE /organizations/:organizationId/teams/:teamId/invitations/:invitationId - Cancel invitation
  async cancelInvitation(req, res) {
    try {
      const { organizationId, teamId, invitationId } = req.params;
      const userId = req.user._id;

      if (!organizationId || !teamId || !invitationId) {
        return ResponseHelpers.badRequest(
          res,
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
    } catch (error) {
      console.error('Cancel invitation error:', error);
      if (
        error.message.includes('not found') ||
        error.message.includes('do not have permission')
      ) {
        return ResponseHelpers.badRequest(res, error.message);
      }
      return ResponseHelpers.serverError(res, 'Failed to cancel invitation');
    }
  }
}
