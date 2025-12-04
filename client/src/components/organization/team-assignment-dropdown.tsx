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
import { useTeams } from '@/hooks/use-teams';
import { useWorkspace } from '@/contexts/workspace-context';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TeamAssignmentDropdownProps {
  memberId: string;
  memberName: string;
  currentTeams?: string[]; // Array of team IDs the member is currently in
  onTeamChange?: () => void; // Callback when team assignment changes
}

export const TeamAssignmentDropdown: React.FC<TeamAssignmentDropdownProps> = ({
  memberId,
  memberName,
  currentTeams = [],
  onTeamChange,
}) => {
  const { activeOrganization } = useWorkspace();
  const { teams, loading, fetchTeams, addMemberToTeam, removeMemberFromTeam } =
    useTeams();
  const [processingTeamId, setProcessingTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (activeOrganization?.id) {
      fetchTeams(activeOrganization.id);
    }
  }, [activeOrganization?.id, fetchTeams]);

  const handleToggleTeam = async (teamId: string) => {
    if (!activeOrganization?.id) return;

    const isInTeam = currentTeams.includes(teamId);
    setProcessingTeamId(teamId);

    try {
      if (isInTeam) {
        await removeMemberFromTeam(activeOrganization.id, teamId, memberId);
        toast.success(`${memberName} removed from team`);
      } else {
        await addMemberToTeam(
          activeOrganization.id,
          teamId,
          memberId,
          'member'
        );
        toast.success(`${memberName} added to team`);
      }
      onTeamChange?.();
    } catch (error: any) {
      console.error('Error updating team membership:', error);
      toast.error(
        error.message || `Failed to ${isInTeam ? 'remove from' : 'add to'} team`
      );
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

