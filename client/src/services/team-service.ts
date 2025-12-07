import api from '@/lib/axios';
import { extractData } from '@/lib/api-response';
import type { Team, CreateTeamRequest, UpdateTeamRequest } from '@/types/team';

export class TeamService {
  /**
   * Get all teams for an organization
   */
  static async getTeams(organizationId: string): Promise<Team[]> {
    const response = await api.get(
      `/api/organizations/${organizationId}/teams`
    );
    const data = extractData<{ teams: Team[] }>(response);
    return data.teams || [];
  }

  /**
   * Get a single team by ID
   */
  static async getTeamById(
    organizationId: string,
    teamId: string
  ): Promise<Team> {
    const response = await api.get(
      `/api/organizations/${organizationId}/teams/${teamId}`
    );
    const data = extractData<{ team: Team }>(response);
    return data.team;
  }

  /**
   * Create a new team
   */
  static async createTeam(
    organizationId: string,
    teamData: CreateTeamRequest
  ): Promise<Team> {
    const response = await api.post(
      `/api/organizations/${organizationId}/teams`,
      teamData
    );
    const data = extractData<{ team: Team }>(response);
    return data.team;
  }

  /**
   * Update an existing team
   */
  static async updateTeam(
    organizationId: string,
    teamId: string,
    teamData: UpdateTeamRequest
  ): Promise<Team> {
    const response = await api.put(
      `/api/organizations/${organizationId}/teams/${teamId}`,
      teamData
    );
    const data = extractData<{ team: Team }>(response);
    return data.team;
  }

  /**
   * Delete a team
   */
  static async deleteTeam(
    organizationId: string,
    teamId: string
  ): Promise<void> {
    await api.delete(`/api/organizations/${organizationId}/teams/${teamId}`);
  }

  /**
   * Add a member to a team
   */
  static async addMemberToTeam(
    organizationId: string,
    teamId: string,
    userId: string,
    role: 'member' | 'owner' = 'member'
  ): Promise<Team> {
    console.log('[FRONTEND] team-service addMemberToTeam API call');
    await api.post(
      `/api/organizations/${organizationId}/teams/${teamId}/members`,
      { userId, role }
    );

    // Backend returns partial team, so fetch full team to get updated members list
    return this.getTeamById(organizationId, teamId);
  }

  /**
   * Remove a member from a team
   */
  static async removeMemberFromTeam(
    organizationId: string,
    teamId: string,
    userId: string
  ): Promise<Team> {
    await api.delete(
      `/api/organizations/${organizationId}/teams/${teamId}/members/${userId}`
    );

    // Backend returns partial team, so fetch full team to get updated members list
    return this.getTeamById(organizationId, teamId);
  }
}
