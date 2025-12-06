import { useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/contexts/workspace-context';
import { useTeamsStore } from '@/stores/teams-store';

/**
 * Hook to check if user can invite members to organization
 * Owners and admins can invite members
 */
export const useCanInviteMembers = (
  maxMembers?: number,
  memberCount?: number
) => {
  const { activeOrganization, currentWorkspaceRole } = useWorkspace();

  return useMemo(() => {
    if (!activeOrganization || !currentWorkspaceRole) return false;

    // Owners and admins can invite
    const hasPermission =
      currentWorkspaceRole === 'owner' || currentWorkspaceRole === 'admin';

    // Check member limit if provided
    if (maxMembers !== undefined && memberCount !== undefined) {
      if (maxMembers === -1) return hasPermission; // Unlimited
      return hasPermission && memberCount < maxMembers;
    }

    return hasPermission;
  }, [activeOrganization, currentWorkspaceRole, maxMembers, memberCount]);
};

/**
 * Hook to check if user can create meetings
 * All organization members can create meetings, but team meetings require team membership
 */
export const useCanCreateMeetings = (teamId?: string) => {
  const { user } = useAuth();
  const { activeOrganization, currentWorkspaceRole } = useWorkspace();
  const { teams } = useTeamsStore();

  return useMemo(() => {
    // Must be in an organization
    if (!activeOrganization) return false;

    // For organization-level meetings, all members can create
    if (!teamId) {
      return currentWorkspaceRole !== null;
    }

    // For team meetings, check if user is a team member
    const team = teams.find((t) => t.id === teamId);
    if (!team || !user?.id) return false;

    // Check if user is a team member (owner/admin/member)
    // Note: TeamMember type doesn't include status, so we assume all members in array are active
    const isTeamMember =
      team.members?.some((m) => m.userId === user.id) ?? false;

    // Organization owners/admins can create team meetings even if not direct members
    const isOrgOwnerOrAdmin =
      currentWorkspaceRole === 'owner' || currentWorkspaceRole === 'admin';

    return isTeamMember || isOrgOwnerOrAdmin;
  }, [activeOrganization, currentWorkspaceRole, teamId, teams, user?.id]);
};

/**
 * Hook to check if user can upload recordings
 * All organization members can upload recordings, but team recordings require team membership
 */
export const useCanUploadRecordings = (teamId?: string) => {
  const { user } = useAuth();
  const { activeOrganization, currentWorkspaceRole } = useWorkspace();
  const { teams } = useTeamsStore();

  return useMemo(() => {
    // Must be in an organization
    if (!activeOrganization) return false;

    // For organization-level recordings, all members can upload
    if (!teamId) {
      return currentWorkspaceRole !== null;
    }

    // For team recordings, check if user is a team member
    const team = teams.find((t) => t.id === teamId);
    if (!team || !user?.id) return false;

    // Check if user is a team member (owner/admin/member)
    // Note: TeamMember type doesn't include status, so we assume all members in array are active
    const isTeamMember =
      team.members?.some((m) => m.userId === user.id) ?? false;

    // Organization owners/admins can upload team recordings even if not direct members
    const isOrgOwnerOrAdmin =
      currentWorkspaceRole === 'owner' || currentWorkspaceRole === 'admin';

    return isTeamMember || isOrgOwnerOrAdmin;
  }, [activeOrganization, currentWorkspaceRole, teamId, teams, user?.id]);
};

/**
 * Hook to check if user is organization owner or admin
 */
export const useIsOwnerOrAdmin = () => {
  const { currentWorkspaceRole } = useWorkspace();

  return useMemo(() => {
    return currentWorkspaceRole === 'owner' || currentWorkspaceRole === 'admin';
  }, [currentWorkspaceRole]);
};

/**
 * Hook to check if user is organization owner
 */
export const useIsOwner = () => {
  const { currentWorkspaceRole } = useWorkspace();

  return useMemo(() => {
    return currentWorkspaceRole === 'owner';
  }, [currentWorkspaceRole]);
};
