import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/workspace-context';
import { useTeamsStore } from '@/stores/teams-store';
import { useMeetingsStore } from '@/stores';
import api from '@/lib/axios';
import { extractData } from '@/lib/api-response';
import type { Meeting } from '@/lib/types';
import MeetingListSection from '@/components/meeting/meeting-list-section';
import MeetingCalendarSection from '@/components/meeting/meeting-calendar-section';
import MeetingViewToggle from '@/components/meetings/meeting-view-toggle';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SEO from '@/components/seo';
import ScheduleMeetingModal from '@/components/dashboard/schedule-meeting-modal';
import { useMeetingForm } from '@/hooks/use-meeting-forms';
import { useCanCreateMeetings } from '@/hooks/use-permissions';

export default function TeamMeetings() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { activeOrganization, isPersonalMode } = useWorkspace();
  const { teams, fetchTeams } = useTeamsStore();
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const {
    meetings,
    loading: meetingsLoading,
    view,
    setView,
    setMeetings,
  } = useMeetingsStore();

  const canCreateMeetings = useCanCreateMeetings(teamId);

  // Use the custom hook for form state management
  const {
    formData,
    loading: formLoading,
    handleInputChange,
    handleDateChange,
    handleTimeChange,
    handlePrivacyChange,
    handleParticipantInput,
    removeParticipant,
    handleSubmit: submitForm,
  } = useMeetingForm(
    async () => {
      setShowScheduleModal(false);
      // Reload team meetings after successful creation
      if (teamId && activeOrganization?.id) {
        try {
          const response = await api.get('/api/meetings', {
            params: { teamId },
          });
          const meetingsData = extractData<Meeting[]>(response);
          setMeetings(meetingsData || []);
        } catch (error: any) {
          console.error('Error reloading team meetings:', error);
        }
      }
    },
    teamId // Pass teamId to the hook
  );

  // Redirect if not in organization mode
  useEffect(() => {
    if (isPersonalMode || !activeOrganization) {
      navigate('/dashboard', { replace: true });
    }
  }, [isPersonalMode, activeOrganization, navigate]);

  // Fetch team data and verify access
  useEffect(() => {
    const loadTeamData = async () => {
      if (!teamId || !activeOrganization?.id || isPersonalMode) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setAccessDenied(false);

      try {
        // Fetch teams if not already loaded
        await fetchTeams(activeOrganization.id);

        // Find the current team from store
        const teamData = teams.find((t) => t.id === teamId);
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
  }, [teamId, activeOrganization?.id, fetchTeams, teams, isPersonalMode]);

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

  if (isPersonalMode || !activeOrganization) {
    return null; // Will redirect via useEffect
  }

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
            <div className="flex items-start gap-3">
              {canCreateMeetings && (
                <Button
                  size="sm"
                  onClick={() => setShowScheduleModal(true)}
                  className="gap-2"
                >
                  <CalendarPlus className="h-4 w-4" />
                  Create Meeting
                </Button>
              )}
              <MeetingViewToggle
                view={view}
                setView={setView}
                setShowImportModal={setShowImportModal}
              />
            </div>
          </div>
        </div>

        <ScheduleMeetingModal
          open={showScheduleModal}
          onOpenChange={setShowScheduleModal}
          formData={formData}
          formLoading={formLoading}
          onInputChange={handleInputChange}
          onDateChange={handleDateChange}
          onTimeChange={handleTimeChange}
          onPrivacyChange={handlePrivacyChange}
          onParticipantInput={handleParticipantInput}
          onRemoveParticipant={removeParticipant}
          onSubmit={submitForm}
          onCancel={() => setShowScheduleModal(false)}
          teamId={teamId}
          teamName={team?.name}
        />

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
