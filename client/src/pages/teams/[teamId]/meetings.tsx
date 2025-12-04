import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/workspace-context';
import { useTeams } from '@/hooks/use-teams';
import { useMeetingsStore } from '@/stores';
import api from '@/lib/axios';
import { extractData } from '@/lib/api-response';
import type { Meeting } from '@/lib/types';
import MeetingListSection from '@/components/meeting/meeting-list-section';
import MeetingCalendarSection from '@/components/meeting/meeting-calendar-section';
import MeetingViewToggle from '@/components/meetings/meeting-view-toggle';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SEO from '@/components/seo';

export default function TeamMeetings() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { activeOrganization } = useWorkspace();
  const { fetchTeam } = useTeams();
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const {
    meetings,
    loading: meetingsLoading,
    view,
    setView,
    setMeetings,
  } = useMeetingsStore();

  // Fetch team data and verify access
  useEffect(() => {
    const loadTeamData = async () => {
      if (!teamId || !activeOrganization?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setAccessDenied(false);

      try {
        // Fetch team details
        const teamData = await fetchTeam(activeOrganization.id, teamId);
        if (teamData) {
          setTeam(teamData);
        } else {
          setAccessDenied(true);
        }
      } catch (error: any) {
        console.error('Error loading team:', error);
        if (error.response?.status === 403 || error.response?.status === 404) {
          setAccessDenied(true);
        } else {
          toast.error('Failed to load team data');
        }
      } finally {
        setLoading(false);
      }
    };

    loadTeamData();
  }, [teamId, activeOrganization?.id, fetchTeam]);

  // Fetch team meetings
  useEffect(() => {
    const loadMeetings = async () => {
      if (!teamId || !activeOrganization?.id || accessDenied) return;

      try {
        // Fetch meetings with teamId filter
        const response = await api.get('/api/meetings', {
          params: { teamId },
        });
        const meetingsData = extractData<Meeting[]>(response);
        // Update the store with team meetings
        setMeetings(meetingsData || []);
      } catch (error: any) {
        console.error('Error loading team meetings:', error);
        if (error.response?.status === 403) {
          setAccessDenied(true);
        } else {
          toast.error('Failed to load team meetings');
        }
      }
    };

    loadMeetings();
  }, [teamId, activeOrganization?.id, accessDenied]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (accessDenied) {
    return (
      <DashboardLayout>
        <SEO title="Access Denied" />
        <div className="container mx-auto py-8 px-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You don't have permission to access this team's meetings. You must
              be a team member or organization owner to view team meetings.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button variant="outline" onClick={() => navigate('/meetings')}>
              Go to All Meetings
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SEO title={`${team?.name || 'Team'} Meetings`} />
      <div className="container mx-auto py-6 px-4">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                @{team?.name || 'Team'} Meetings
              </h1>
              <p className="text-muted-foreground mt-1">
                View and manage meetings for this team
              </p>
            </div>
            <MeetingViewToggle
              view={view}
              setView={setView}
              setShowImportModal={setShowImportModal}
            />
          </div>
        </div>

        {view === 'list' ? (
          <MeetingListSection meetings={meetings} loading={meetingsLoading} />
        ) : (
          <MeetingCalendarSection
            meetings={meetings}
            loading={meetingsLoading}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
