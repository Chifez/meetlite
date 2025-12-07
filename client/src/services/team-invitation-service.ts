import api from '@/lib/axios';
import { extractData } from '@/lib/api-response';
import type {
  TeamInvitation,
  CreateTeamInvitationRequest,
} from '@/types/team-invitation';

export class TeamInvitationService {
  /**
   * Invite an organization member to a team
   */
  static async inviteToTeam(
    organizationId: string,
    teamId: string,
    invitationData: CreateTeamInvitationRequest
  ): Promise<TeamInvitation> {
    const response = await api.post(
      `/api/organizations/${organizationId}/teams/${teamId}/invite`,
      invitationData
    );
    const data = extractData<{ invitation: TeamInvitation }>(response);
    return data.invitation;
  }

  /**
   * Accept a team invitation
   */
  static async acceptInvitation(token: string): Promise<{
    user: any;
    token?: string;
  }> {
    const response = await api.post(`/api/teams/invitations/${token}/accept`);
    const data = extractData<{ user: any; token?: string }>(response);
    return data;
  }

  /**
   * Decline a team invitation
   */
  static async declineInvitation(token: string): Promise<TeamInvitation> {
    const response = await api.post(`/api/teams/invitations/${token}/decline`);
    const data = extractData<{ invitation: TeamInvitation }>(response);
    return data.invitation;
  }

  /**
   * Cancel a team invitation (by team owner/admin)
   */
  static async cancelInvitation(
    organizationId: string,
    teamId: string,
    invitationId: string
  ): Promise<void> {
    await api.delete(
      `/api/organizations/${organizationId}/teams/${teamId}/invitations/${invitationId}`
    );
  }

  /**
   * Get invitation details by token (public route)
   */
  static async getInvitationDetails(token: string): Promise<{
    invitation: Partial<TeamInvitation>;
    isValid: boolean;
  }> {
    const response = await api.get(`/api/teams/invitations/${token}`);
    const data = extractData<{
      invitation: Partial<TeamInvitation>;
      isValid: boolean;
    }>(response);
    return data;
  }

  /**
   * Get pending invitations for a specific team
   */
  static async getPendingInvitationsByTeam(
    organizationId: string,
    teamId: string
  ): Promise<TeamInvitation[]> {
    try {
      const response = await api.get(
        `/api/organizations/${organizationId}/teams/${teamId}/invitations`
      );
      const data = extractData<{ invitations: TeamInvitation[] }>(response);
      return data.invitations || [];
    } catch (error) {
      console.error('Error fetching team invitations:', error);
      return [];
    }
  }

  /**
   * Get pending invitations for current user in an organization
   * Note: This endpoint may need to be added to the backend
   */
  static async getPendingInvitations(
    organizationId: string
  ): Promise<TeamInvitation[]> {
    // This endpoint might need to be implemented in the backend
    // For now, returning empty array
    try {
      const response = await api.get(
        `/api/organizations/${organizationId}/teams/invitations/pending`
      );
      const data = extractData<{ invitations: TeamInvitation[] }>(response);
      return data.invitations || [];
    } catch (error) {
      // Endpoint might not exist yet
      return [];
    }
  }
}
