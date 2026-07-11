import { useState, useCallback } from 'react';
import { TeamService } from '@/services/team-service';
import { TeamInvitationService } from '@/services/team-invitation-service';
import { useToast } from '@/hooks/use-toast';
import { extractError } from '@/lib/api-response';
import type { Team, CreateTeamRequest, UpdateTeamRequest } from '@/types/team';
import type { CreateTeamInvitationRequest } from '@/types/team-invitation';

export const useTeams = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const { toast } = useToast();

  // Fetch teams for an organization
  const fetchTeams = useCallback(
    async (organizationId: string) => {
      if (!organizationId) {
        setTeams([]);
        return;
      }

      setLoading(true);
      try {
        const data = await TeamService.getTeams(organizationId);
        setTeams(data);
      } catch (error: any) {
        console.error('Error fetching teams:', error);
        toast({
          title: 'Error',
          description: extractError(error) || 'Failed to load teams',
          variant: 'destructive',
        });
        setTeams([]);
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // Fetch a single team by ID
  const fetchTeam = useCallback(
    async (organizationId: string, teamId: string) => {
      if (!organizationId || !teamId) return;

      setLoading(true);
      try {
        const team = await TeamService.getTeamById(organizationId, teamId);
        setCurrentTeam(team);
        return team;
      } catch (error: any) {
        console.error('Error fetching team:', error);
        toast({
          title: 'Error',
          description: extractError(error) || 'Failed to load team',
          variant: 'destructive',
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // Create a new team
  const createTeam = useCallback(
    async (organizationId: string, teamData: CreateTeamRequest) => {
      setCreating(true);
      try {
        const newTeam = await TeamService.createTeam(organizationId, teamData);
        setTeams((prev) => [...prev, newTeam]);
        toast({
          title: 'Team created!',
          description: `Team "${newTeam.name}" has been created successfully`,
        });
        return newTeam;
      } catch (error: any) {
        console.error('Error creating team:', error);
        toast({
          title: 'Failed to create team',
          description: extractError(error) || 'Please try again',
          variant: 'destructive',
        });
        return null;
      } finally {
        setCreating(false);
      }
    },
    [toast]
  );

  // Update a team
  const updateTeam = useCallback(
    async (
      organizationId: string,
      teamId: string,
      teamData: UpdateTeamRequest
    ) => {
      setUpdating(teamId);
      try {
        const updatedTeam = await TeamService.updateTeam(
          organizationId,
          teamId,
          teamData
        );
        setTeams((prev) =>
          prev.map((team) => (team.id === teamId ? updatedTeam : team))
        );
        if (currentTeam?.id === teamId) {
          setCurrentTeam(updatedTeam);
        }
        toast({
          title: 'Team updated!',
          description: `Team "${updatedTeam.name}" has been updated successfully`,
        });
        return updatedTeam;
      } catch (error: any) {
        console.error('Error updating team:', error);
        toast({
          title: 'Failed to update team',
          description: extractError(error) || 'Please try again',
          variant: 'destructive',
        });
        return null;
      } finally {
        setUpdating(null);
      }
    },
    [toast, currentTeam]
  );

  // Delete a team
  const deleteTeam = useCallback(
    async (organizationId: string, teamId: string, teamName: string) => {
      setDeleting(teamId);
      try {
        await TeamService.deleteTeam(organizationId, teamId);
        setTeams((prev) => prev.filter((team) => team.id !== teamId));
        if (currentTeam?.id === teamId) {
          setCurrentTeam(null);
        }
        toast({
          title: 'Team deleted',
          description: `Team "${teamName}" has been deleted`,
        });
        return true;
      } catch (error: any) {
        console.error('Error deleting team:', error);
        toast({
          title: 'Failed to delete team',
          description: extractError(error) || 'Please try again',
          variant: 'destructive',
        });
        return false;
      } finally {
        setDeleting(null);
      }
    },
    [toast, currentTeam]
  );

  // Add a member to a team
  const addMemberToTeam = useCallback(
    async (
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
        setTeams((prev) =>
          prev.map((team) => (team.id === teamId ? updatedTeam : team))
        );
        if (currentTeam?.id === teamId) {
          setCurrentTeam(updatedTeam);
        }
        toast({
          title: 'Member added',
          description: 'Member has been added to the team',
        });
        return updatedTeam;
      } catch (error: any) {
        console.error('Error adding member to team:', error);
        toast({
          title: 'Failed to add member',
          description: extractError(error) || 'Please try again',
          variant: 'destructive',
        });
        return null;
      }
    },
    [toast, currentTeam]
  );

  // Remove a member from a team
  const removeMemberFromTeam = useCallback(
    async (organizationId: string, teamId: string, userId: string) => {
      try {
        const updatedTeam = await TeamService.removeMemberFromTeam(
          organizationId,
          teamId,
          userId
        );
        setTeams((prev) =>
          prev.map((team) => (team.id === teamId ? updatedTeam : team))
        );
        if (currentTeam?.id === teamId) {
          setCurrentTeam(updatedTeam);
        }
        toast({
          title: 'Member removed',
          description: 'Member has been removed from the team',
        });
        return updatedTeam;
      } catch (error: any) {
        console.error('Error removing member from team:', error);
        toast({
          title: 'Failed to remove member',
          description: extractError(error) || 'Please try again',
          variant: 'destructive',
        });
        return null;
      }
    },
    [toast, currentTeam]
  );

  // Invite a member to a team
  const inviteToTeam = useCallback(
    async (
      organizationId: string,
      teamId: string,
      invitationData: CreateTeamInvitationRequest
    ) => {
      setInviting(true);
      try {
        await TeamInvitationService.inviteToTeam(
          organizationId,
          teamId,
          invitationData
        );
        toast({
          title: 'Invitation sent!',
          description: 'Team invitation has been sent successfully',
        });
        // Refresh team data to get updated member count
        await fetchTeam(organizationId, teamId);
        return true;
      } catch (error: any) {
        console.error('Error inviting to team:', error);
        toast({
          title: 'Failed to send invitation',
          description: extractError(error) || 'Please try again',
          variant: 'destructive',
        });
        return false;
      } finally {
        setInviting(false);
      }
    },
    [toast, fetchTeam]
  );

  return {
    teams,
    currentTeam,
    loading,
    creating,
    updating,
    deleting,
    inviting,
    fetchTeams,
    fetchTeam,
    createTeam,
    updateTeam,
    deleteTeam,
    addMemberToTeam,
    removeMemberFromTeam,
    inviteToTeam,
    setCurrentTeam,
  };
};

