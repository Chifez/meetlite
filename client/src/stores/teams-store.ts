import { create } from 'zustand';
import { TeamService } from '@/services/team-service';
import type { Team, CreateTeamRequest, UpdateTeamRequest } from '@/types/team';

interface TeamsState {
  teams: Team[];
  currentTeam: Team | null;
  loading: boolean;
  error: string | null;
  lastFetchedOrgId: string | null;

  // Actions
  fetchTeams: (organizationId: string, force?: boolean) => Promise<void>;
  setCurrentTeam: (team: Team | null) => void;
  createTeam: (
    organizationId: string,
    teamData: CreateTeamRequest
  ) => Promise<Team | null>;
  updateTeam: (
    organizationId: string,
    teamId: string,
    teamData: UpdateTeamRequest
  ) => Promise<Team | null>;
  deleteTeam: (organizationId: string, teamId: string) => Promise<boolean>;
  addMemberToTeam: (
    organizationId: string,
    teamId: string,
    userId: string,
    role?: 'member' | 'owner'
  ) => Promise<Team | null>;
  removeMemberFromTeam: (
    organizationId: string,
    teamId: string,
    userId: string
  ) => Promise<Team | null>;
  clearTeams: () => void;
}

export const useTeamsStore = create<TeamsState>((set, get) => ({
  teams: [],
  currentTeam: null,
  loading: false,
  error: null,
  lastFetchedOrgId: null,

  // Fetch teams for an organization (only if not already fetched or forced)
  fetchTeams: async (organizationId: string, force = false) => {
    const { lastFetchedOrgId, teams, loading } = get();

    // Skip if already loaded for this org (unless forced)
    if (!force && lastFetchedOrgId === organizationId && teams.length > 0) {
      return;
    }

    // Skip if already loading
    if (loading) return;

    set({ loading: true, error: null });

    try {
      const data = await TeamService.getTeams(organizationId);
      set({
        teams: data,
        loading: false,
        lastFetchedOrgId: organizationId,
      });
    } catch (error: any) {
      console.error('Error fetching teams:', error);
      set({
        error: error.message || 'Failed to load teams',
        loading: false,
        teams: [],
      });
    }
  },

  // Set current team
  setCurrentTeam: (team: Team | null) => {
    set({ currentTeam: team });
  },

  // Create a new team
  createTeam: async (organizationId: string, teamData: CreateTeamRequest) => {
    try {
      const newTeam = await TeamService.createTeam(organizationId, teamData);

      // Update state with new team
      set((state) => ({
        teams: [...state.teams, newTeam],
      }));

      return newTeam;
    } catch (error: any) {
      console.error('Error creating team:', error);
      set({ error: error.message || 'Failed to create team' });
      return null;
    }
  },

  // Update a team
  updateTeam: async (
    organizationId: string,
    teamId: string,
    teamData: UpdateTeamRequest
  ) => {
    try {
      const updatedTeam = await TeamService.updateTeam(
        organizationId,
        teamId,
        teamData
      );

      // Update state
      set((state) => ({
        teams: state.teams.map((team) =>
          team.id === teamId ? updatedTeam : team
        ),
        currentTeam:
          state.currentTeam?.id === teamId ? updatedTeam : state.currentTeam,
      }));

      return updatedTeam;
    } catch (error: any) {
      console.error('Error updating team:', error);
      set({ error: error.message || 'Failed to update team' });
      return null;
    }
  },

  // Delete a team
  deleteTeam: async (organizationId: string, teamId: string) => {
    try {
      await TeamService.deleteTeam(organizationId, teamId);

      // Update state
      set((state) => ({
        teams: state.teams.filter((team) => team.id !== teamId),
        currentTeam:
          state.currentTeam?.id === teamId ? null : state.currentTeam,
      }));

      return true;
    } catch (error: any) {
      console.error('Error deleting team:', error);
      set({ error: error.message || 'Failed to delete team' });
      return false;
    }
  },

  // Add a member to a team
  addMemberToTeam: async (
    organizationId: string,
    teamId: string,
    userId: string,
    role: 'member' | 'owner' = 'member'
  ) => {
    try {
      const updatedTeam = await TeamService.addMemberToTeam(
        organizationId,
        teamId,
        userId,
        role
      );

      // Update state
      set((state) => ({
        teams: state.teams.map((team) =>
          team.id === teamId ? updatedTeam : team
        ),
        currentTeam:
          state.currentTeam?.id === teamId ? updatedTeam : state.currentTeam,
      }));

      return updatedTeam;
    } catch (error: any) {
      console.error('Error adding member to team:', error);
      set({ error: error.message || 'Failed to add member' });
      return null;
    }
  },

  // Remove a member from a team
  removeMemberFromTeam: async (
    organizationId: string,
    teamId: string,
    userId: string
  ) => {
    try {
      const updatedTeam = await TeamService.removeMemberFromTeam(
        organizationId,
        teamId,
        userId
      );

      // Update state
      set((state) => ({
        teams: state.teams.map((team) =>
          team.id === teamId ? updatedTeam : team
        ),
        currentTeam:
          state.currentTeam?.id === teamId ? updatedTeam : state.currentTeam,
      }));

      return updatedTeam;
    } catch (error: any) {
      console.error('Error removing member from team:', error);
      set({ error: error.message || 'Failed to remove member' });
      return null;
    }
  },

  // Clear teams (when switching organizations or logging out)
  clearTeams: () => {
    set({
      teams: [],
      currentTeam: null,
      loading: false,
      error: null,
      lastFetchedOrgId: null,
    });
  },
}));
