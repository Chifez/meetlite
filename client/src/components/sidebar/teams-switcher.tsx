import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ChevronRight,
  ChevronDown,
  Users,
  Video,
  FileVideo,
  Settings,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/contexts/workspace-context';
import { useTeamsStore } from '@/stores/teams-store';

interface TeamsSwitcherProps {}

export function TeamsSwitcher({}: TeamsSwitcherProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeOrganization } = useWorkspace();
  const { teams, loading, fetchTeams } = useTeamsStore();
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  // Fetch teams once when organization is set (Zustand handles caching)
  useEffect(() => {
    if (activeOrganization?.id) {
      fetchTeams(activeOrganization.id);
    }
  }, [activeOrganization?.id, fetchTeams]);

  // Compute route-based team expansion
  const pathMatch = location.pathname.match(/^\/teams\/([^/]+)/);
  const routeTeamId = pathMatch ? pathMatch[1] : null;

  const toggleTeam = (teamId: string) => {
    setExpandedTeams((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(teamId)) {
        newSet.delete(teamId);
      } else {
        newSet.add(teamId);
      }
      return newSet;
    });
  };

  const handleTeamMeetingClick = (teamId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/teams/${teamId}/meetings`);
  };

  const handleTeamRecordingClick = (teamId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/teams/${teamId}/recordings`);
  };

  const handleTeamSettingsClick = (teamId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/teams/${teamId}/settings`);
  };

  const isTeamExpanded = (teamId: string) =>
    expandedTeams.has(teamId) || routeTeamId === teamId;
  const isTeamMeetingActive = (teamId: string) =>
    location.pathname === `/teams/${teamId}/meetings`;
  const isTeamRecordingActive = (teamId: string) =>
    location.pathname === `/teams/${teamId}/recordings`;
  const isTeamSettingsActive = (teamId: string) =>
    location.pathname === `/teams/${teamId}/settings`;

  if (loading && teams.length === 0) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-sidebar-foreground/60" />
      </div>
    );
  }

  if (!teams || teams.length === 0) {
    return (
      <div className="px-2 py-1">
        <div className="text-xs text-sidebar-foreground/60 text-center py-2">
          No teams yet
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {teams.map((team) => {
        const isExpanded = isTeamExpanded(team.id);
        const isMeetingActive = isTeamMeetingActive(team.id);
        const isRecordingActive = isTeamRecordingActive(team.id);
        const isSettingsActive = isTeamSettingsActive(team.id);

        return (
          <div key={team.id} className="space-y-0.5">
            {/* Team Header */}
            <div
              className={cn(
                'flex items-center w-full h-auto p-2 rounded-md',
                'hover:bg-sidebar-accent text-sidebar-foreground'
              )}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Chevron - clickable for toggle */}
                <button
                  type="button"
                  onClick={() => toggleTeam(team.id)}
                  className="p-0.5 rounded hover:bg-sidebar-foreground/10 transition-colors"
                  aria-label={isExpanded ? 'Collapse team' : 'Expand team'}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 text-sidebar-foreground/60 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-sidebar-foreground/60 flex-shrink-0" />
                  )}
                </button>
                <Users className="h-3.5 w-3.5 text-sidebar-foreground/80 flex-shrink-0" />
                {/* Team name - clickable for toggle */}
                <button
                  type="button"
                  onClick={() => toggleTeam(team.id)}
                  className="text-xs font-medium text-sidebar-foreground truncate text-left flex-1 hover:text-sidebar-foreground/80 transition-colors"
                >
                  @{team.name}
                </button>
              </div>
            </div>

            {/* Team Submenu */}
            {isExpanded && (
              <div className="ml-4 space-y-0.5">
                {/* Meetings */}
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start h-auto p-2 hover:bg-sidebar-accent',
                    'text-sidebar-foreground',
                    isMeetingActive &&
                      'bg-sidebar-accent text-sidebar-accent-foreground'
                  )}
                  onClick={(e) => handleTeamMeetingClick(team.id, e)}
                >
                  <Video className="h-3.5 w-3.5 text-sidebar-foreground/80 mr-2 flex-shrink-0" />
                  <span className="text-xs text-sidebar-foreground">
                    Meetings
                  </span>
                </Button>

                {/* Recordings */}
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start h-auto p-2 hover:bg-sidebar-accent',
                    'text-sidebar-foreground',
                    isRecordingActive &&
                      'bg-sidebar-accent text-sidebar-accent-foreground'
                  )}
                  onClick={(e) => handleTeamRecordingClick(team.id, e)}
                >
                  <FileVideo className="h-3.5 w-3.5 text-sidebar-foreground/80 mr-2 flex-shrink-0" />
                  <span className="text-xs text-sidebar-foreground">
                    Recordings
                  </span>
                </Button>

                {/* Settings */}
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start h-auto p-2 hover:bg-sidebar-accent',
                    'text-sidebar-foreground',
                    isSettingsActive &&
                      'bg-sidebar-accent text-sidebar-accent-foreground'
                  )}
                  onClick={(e) => handleTeamSettingsClick(team.id, e)}
                >
                  <Settings className="h-3.5 w-3.5 text-sidebar-foreground/80 mr-2 flex-shrink-0" />
                  <span className="text-xs text-sidebar-foreground">
                    Settings
                  </span>
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
