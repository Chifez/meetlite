import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Users, Check, Loader2, Plus } from 'lucide-react';
import { useTeamsStore } from '@/stores/teams-store';
import { useWorkspace } from '@/contexts/workspace-context';
import { useMembers } from '@/hooks/use-members';
import { toast } from 'sonner';

interface TeamAssignmentDropdownProps {
  memberId: string;
  memberName: string;
  currentTeams?: string[]; // Array of team IDs the member is currently in
  onTeamChange?: () => void; // Callback when team assignment changes
  children?: React.ReactNode;
}

export const TeamAssignmentDropdown: React.FC<TeamAssignmentDropdownProps> = ({
  memberId,
  memberName,
  currentTeams = [],
  onTeamChange,
  children,
}) => {
  const { activeOrganization } = useWorkspace();
  const { teams, loading, fetchTeams, addMemberToTeam, removeMemberFromTeam } =
    useTeamsStore();
  const { updateMemberTeams } = useMembers();
  const [processingTeamId, setProcessingTeamId] = useState<string | null>(null);

  // Debug: Log props
  useEffect(() => {
    console.log('[FRONTEND] TeamAssignmentDropdown props:', {
      memberId,
      currentTeams,
      teamsCount: teams.length,
    });
  }, [memberId, currentTeams, teams]);

  useEffect(() => {
    if (activeOrganization?.id) {
      fetchTeams(activeOrganization.id);
    }
  }, [activeOrganization?.id, fetchTeams]);

  const handleToggleTeam = async (teamId: string) => {
    if (!activeOrganization?.id) return;

    const isInTeam = currentTeams.includes(teamId);
    const team = teams.find((t) => t.id === teamId);
    const teamName = team?.name || 'team';

    console.log('[FRONTEND] handleToggleTeam:', {
      memberId,
      teamId,
      isInTeam,
      action: isInTeam ? 'remove' : 'add',
    });

    setProcessingTeamId(teamId);

    try {
      if (isInTeam) {
        const result = await removeMemberFromTeam(
          activeOrganization.id,
          teamId,
          memberId
        );
        if (result) {
          // Update local state immediately
          updateMemberTeams(memberId, teamId, 'remove', teamName);
          toast.success(`${memberName} removed from team`);
          onTeamChange?.();
        } else {
          toast.error(`Failed to remove ${memberName} from team`);
        }
      } else {
        // Check if user is already in team (handle race condition)
        if (currentTeams.includes(teamId)) {
          toast.info(`${memberName} is already in this team`);
          return;
        }

        const result = await addMemberToTeam(
          activeOrganization.id,
          teamId,
          memberId,
          'member'
        );
        console.log('[FRONTEND] addMemberToTeam result:', !!result);
        if (result) {
          // Update local state immediately
          updateMemberTeams(memberId, teamId, 'add', teamName);
          console.log(
            '🟠 [TeamAssignmentDropdown] Updated local state, calling onTeamChange'
          );
          toast.success(`${memberName} added to team`);
          onTeamChange?.();
        } else {
          console.error(
            '🟠 [TeamAssignmentDropdown] addMemberToTeam returned null/false'
          );
          toast.error(`Failed to add ${memberName} to team`);
        }
      }
    } catch (error: any) {
      console.error('Error updating team membership:', error);
      const errorMessage = error.response?.data?.message || error.message;

      // Handle "already a member" error gracefully
      if (errorMessage?.includes('already a member')) {
        console.warn('[FRONTEND] Already a member error');
        updateMemberTeams(memberId, teamId, 'add', teamName);
        onTeamChange?.();
        toast.info(`${memberName} is already in this team`);
      } else {
        console.error('[FRONTEND] Team membership error:', errorMessage);
        toast.error(
          errorMessage ||
            `Failed to ${isInTeam ? 'remove from' : 'add to'} team`
        );
      }
    } finally {
      setProcessingTeamId(null);
    }
  };

  if (!activeOrganization?.id || teams.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children ? children : (
          <Button variant="outline" size="sm" className="h-8 gap-2">
            <Users className="h-3.5 w-3.5" />
            <span className="text-xs">
              {currentTeams.length > 0
                ? `${currentTeams.length} team${
                    currentTeams.length === 1 ? '' : 's'
                  }`
                : 'Teams'}
            </span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Assign to Teams</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : teams.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No teams available
          </div>
        ) : (
          teams.map((team) => {
            const isInTeam = currentTeams.includes(team.id);
            const isProcessing = processingTeamId === team.id;

            return (
              <DropdownMenuItem
                key={team.id}
                onClick={() => handleToggleTeam(team.id)}
                disabled={isProcessing}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs truncate">@{team.name}</span>
                  {isInTeam && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0"
                    >
                      Member
                    </Badge>
                  )}
                </div>
                {isProcessing ? (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-2 flex-shrink-0" />
                ) : isInTeam ? (
                  <Check className="h-3 w-3 text-primary ml-2 flex-shrink-0" />
                ) : (
                  <Plus className="h-3 w-3 text-muted-foreground ml-2 flex-shrink-0" />
                )}
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
