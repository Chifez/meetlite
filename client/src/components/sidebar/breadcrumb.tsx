import { useEffect, useState } from 'react';
import { NAVIGATION_ITEMS } from '@/lib/constants';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Menu } from 'lucide-react';
import { useTeamsStore } from '@/stores/teams-store';
import { useWorkspace } from '@/contexts/workspace-context';
import { NotificationBell } from '@/components/notifications/notification-bell';

interface BreadcrumbProps {
  currentPath: string;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isMobileMenuOpen: boolean) => void;
}

const Breadcrumb = ({
  currentPath,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}: BreadcrumbProps) => {
  const navigate = useNavigate();
  const { activeOrganization } = useWorkspace();
  const { fetchTeams } = useTeamsStore();
  const [teamName, setTeamName] = useState<string | null>(null);

  // Check if current path is a team route
  const teamRouteMatch = currentPath.match(/^\/teams\/([^/]+)\/(.+)$/);
  const teamId = teamRouteMatch ? teamRouteMatch[1] : null;
  const teamPage = teamRouteMatch ? teamRouteMatch[2] : null;

  // Fetch team name if on a team route
  useEffect(() => {
    if (teamId && activeOrganization?.id) {
      // Ensure teams are loaded, then find the team
      fetchTeams(activeOrganization.id).then(() => {
        // Read fresh teams from store after fetch
        const { teams: currentTeams } = useTeamsStore.getState();
        const team = currentTeams.find((t) => t.id === teamId);
        if (team) {
          setTeamName(team.name);
        } else {
          setTeamName(null);
        }
      });
    } else {
      setTeamName(null);
    }
  }, [teamId, activeOrganization?.id, fetchTeams]);

  // Get page label for team pages
  const getTeamPageLabel = (page: string | null): string => {
    if (!page) return '';
    switch (page) {
      case 'meetings':
        return 'Meetings';
      case 'settings':
        return 'Settings';
      case 'recordings':
        return 'Recordings';
      default:
        return page;
    }
  };

  // Simple derived values
  let currentItem = NAVIGATION_ITEMS.find((item) => item.path === currentPath);
  let childItem: any = null;

  if (!currentItem) {
    // Check if currentPath is a child of any NAVIGATION_ITEM
    for (const item of NAVIGATION_ITEMS) {
      if (item.children) {
        const foundChild = item.children.find((child) => child.path === currentPath);
        if (foundChild) {
          currentItem = item;
          childItem = foundChild;
          break;
        }
      }
    }
  }

  const isDashboard = currentPath === '/dashboard';
  const isTeamRoute = !!teamId;

  // Show breadcrumb for dashboard, navigation items, or team routes
  if (!currentItem && !isTeamRoute) return null;

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-2">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {isMobileMenuOpen && (
            <div
              className="fixed inset-0 z-40 lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}
        </div>

        <div className="flex items-center justify-center gap-2 py-1 text-lg text-foreground">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="hover:bg-transparent cursor-pointer flex items-center justify-center gap-2 h-auto font-medium text-xs uppercase"
          >
            {!isDashboard && (
              <>
                <ArrowLeft className="h-4 w-4" />
              </>
            )}
            <p>Dashboard</p>
            {isTeamRoute && teamName && (
              <>
                <span>/</span>
                <span>{teamName}</span>
                {teamPage && (
                  <>
                    <span>/</span>
                    <span>{getTeamPageLabel(teamPage)}</span>
                  </>
                )}
              </>
            )}
            {!isDashboard && !isTeamRoute && currentItem && (
              <>
                <span>/</span>
                <span>{currentItem.label}</span>
                {childItem && (
                  <>
                    <span>/</span>
                    <span>{childItem.label}</span>
                  </>
                )}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Notification Bell - Mobile only (desktop shows in sidebar) */}
      <div className="lg:hidden">
        <NotificationBell variant="breadcrumb" />
      </div>
    </div>
  );
};

export default Breadcrumb;
