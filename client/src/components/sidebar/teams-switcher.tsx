'use client';

import type React from 'react';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Users, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import api from '@/lib/axios';
import { extractData } from '@/lib/api-response';
import { Team } from '@/types/team';
import { toast } from 'sonner';

interface TeamsSwitcherProps {}

export function TeamsSwitcher({}: TeamsSwitcherProps) {
  const { user, isAuthenticated } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);

  // Load teams when user authenticates
  useEffect(() => {
    if (isAuthenticated && user) {
      loadTeams();
    } else {
      setTeams([]);
      setActiveTeamId(null);
    }
  }, [isAuthenticated, user?.id]);

  const loadTeams = async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    try {
      // TODO: Replace with actual teams API endpoint when available
      const response = await api.get('/api/teams');
      const responseData = extractData<{ teams: any[] }>(response);
      const teamsData: Team[] = (responseData.teams || []).map((team: any) => ({
        id: team.id,
        name: team.name,
        slug: team.slug,
        logo: team.logo,
        members: [],
        memberCount: team.memberCount,
        role: team.role,
        createdAt: team.createdAt,
      }));

      setTeams(teamsData);
    } catch (error: any) {
      // If endpoint doesn't exist yet, just log and continue with empty teams
      if (error.response?.status === 404) {
        console.log('Teams endpoint not available yet');
        setTeams([]);
      } else {
        console.error('Failed to load teams:', error);
        toast.error('Failed to load teams');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToTeam = (teamId: string) => {
    if (loading) return;
    // TODO: Implement team switching logic when backend is ready
    setActiveTeamId(teamId);
    toast.info('Team switching functionality coming soon');
  };

  const getCurrentDisplayName = (): string => {
    if (activeTeamId) {
      const team = teams.find((t) => t.id === activeTeamId);
      return team ? `@${team.name}` : 'Select Team';
    }
    return teams.length > 0 ? 'Select Team' : 'No Teams';
  };

  const getCurrentDisplayDescription = (): string => {
    if (activeTeamId) {
      const team = teams.find((t) => t.id === activeTeamId);
      if (team) {
        return `${team.memberCount || 0} member${
          team.memberCount === 1 ? '' : 's'
        }`;
      }
    }
    return teams.length > 0
      ? `${teams.length} team${teams.length === 1 ? '' : 's'} available`
      : 'Create or join a team';
  };

  const getCurrentInitials = () => {
    if (activeTeamId) {
      const team = teams.find((t) => t.id === activeTeamId);
      if (team) {
        return team.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
      }
    }
    return 'TM'; // Team
  };

  if (teams.length === 0 && !loading) {
    return (
      <div className="space-y-2">
        <Button
          variant="ghost"
          className="w-full justify-between h-auto p-3 hover:bg-sidebar-accent opacity-60"
          disabled
        >
          <div className="flex items-center gap-3 flex-1">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                TM
              </AvatarFallback>
            </Avatar>
            <div className="text-left flex-1 min-w-0">
              <div className="text-xs font-medium text-sidebar-foreground truncate uppercase">
                No Teams
              </div>
              <div className="text-xs text-sidebar-foreground/60 truncate">
                Create or join a team
              </div>
            </div>
          </div>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Current Team Display - Clickable Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between h-auto p-3 hover:bg-sidebar-accent"
            disabled={loading}
          >
            <div className="flex items-center gap-3 flex-1">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {getCurrentInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="text-left flex-1 min-w-0">
                <div className="text-xs font-medium text-sidebar-foreground truncate uppercase">
                  {getCurrentDisplayName()}
                </div>
                <div className="text-xs text-sidebar-foreground/60 truncate">
                  {getCurrentDisplayDescription()}
                </div>
              </div>
            </div>
            {loading ? (
              <Loader2 className="h-4 w-4 text-sidebar-foreground/60 flex-shrink-0 animate-spin" />
            ) : (
              <ChevronsUpDown className="h-4 w-4 text-sidebar-foreground/60 flex-shrink-0" />
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-full">
          {/* Teams List */}
          {teams.map((team) => (
            <DropdownMenuItem
              key={team.id}
              onClick={() => handleSwitchToTeam(team.id)}
              className="flex items-center gap-3 p-3 cursor-pointer"
              disabled={loading}
            >
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-medium">@{team.name}</div>
                <div className="text-xs text-muted-foreground">
                  {team.memberCount || 0} members
                </div>
              </div>
            </DropdownMenuItem>
          ))}

          {teams.length > 0 && <DropdownMenuSeparator />}

          {/* Create/Join Team - Placeholder */}
          <DropdownMenuItem
            className="flex items-center gap-3 p-3 cursor-pointer border-2 border-dashed border-border rounded-lg m-2 opacity-60"
            disabled
          >
            <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-left">
              <div className="font-medium text-muted-foreground">
                Create or Join Team
              </div>
              <div className="text-xs text-muted-foreground">Coming soon</div>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
