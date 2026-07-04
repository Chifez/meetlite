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
import { AlertCircle, Loader2, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SEO from '@/components/seo';
import ScheduleMeetingModal from '@/components/dashboard/schedule-meeting-modal';
import { useMeetingForm } from '@/hooks/use-meeting-forms';
import { useCanCreateMeetings } from '@/hooks/use-permissions';
import { useCalendarIntegration } from '@/hooks/use-calendar-integration';
import ImportModal from '@/components/meeting/import-modal';
import { TeamService } from '@/services/team-service';

export default function TeamMeetings() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { activeOrganization, isPersonalMode } = useWorkspace();
  const { fetchTeams } = useTeamsStore();
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const {
    showImportModal,
    setShowImportModal,
    importLoading,
    importedEvents,
    importError,
    isConnected,
    refreshConnectionStatus,
    disconnectCalendar,
    isPolling,
    importCalendarEvents,
    connectGoogleCalendar,
  } = useCalendarIntegration();
  
  const {
    meetings,
    loading: meetingsLoading,
    view,
    setView,
    setMeetings,
  } = useMeetingsStore();

  const canCreateMeetings = useCanCreateMeetings(teamId);

  const {
    formData,
    loading: formLoading,
    handleInputChange,
    handleDateChange,
    handleTimeChange,
    handlePrivacyChange,
    handleRecurrenceChange,
    handleAutoIncludeChange,
    handleParticipantInput,
    removeParticipant,
    handleSubmit: submitForm,
  } = useMeetingForm(
    async () => {
      setShowScheduleModal(false);
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
    teamId
  );

  useEffect(() => {
    if (isPersonalMode || !activeOrganization) {
      navigate('/dashboard', { replace: true });
      return;
    }

    if (!teamId || !activeOrganization?.id) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        setAccessDenied(false);

        // Fetch team details and check access
        await fetchTeams(activeOrganization.id);
        const teamData = await TeamService.getTeamById(activeOrganization.id, teamId);
        if (teamData) {
          setTeam(teamData);
        } else {
          setAccessDenied(true);
        }

        // Fetch meetings for this team
        const meetingsResponse = await api.get('/api/meetings', {
          params: { teamId },
        });
        const meetingsData = extractData<Meeting[]>(meetingsResponse);
        setMeetings(meetingsData || []);
      } catch (error: any) {
        console.error('Error loading team meetings data:', error);
        if (error.response?.status === 403 || error.response?.status === 404) {
          setAccessDenied(true);
        } else {
          toast.error('Failed to load team meetings');
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [teamId, activeOrganization?.id, isPersonalMode, navigate, fetchTeams, setMeetings]);

  // ── LOADING STATE ──────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout>
        <SEO title="Loading Team Meetings · MeetLite" />
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <p className="text-[0.875rem] text-muted-foreground">Loading team meetings…</p>
        </div>
      </DashboardLayout>
    );
  }

  // ── ACCESS DENIED STATE ────────────────────────────────────────
  if (accessDenied || !team) {
    return (
      <DashboardLayout>
        <SEO title="Access Denied · MeetLite" />
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4 border border-border rounded-2xl">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h2 className="text-[0.9375rem] font-semibold text-foreground tracking-[-0.01em] mb-1">
              Access denied
            </h2>
            <p className="text-[0.8125rem] text-muted-foreground max-w-xs">
              You don't have permission to access meetings for this team, or it does not exist.
            </p>
          </div>
          <Button onClick={() => navigate('/dashboard')} variant="outline" size="sm">
            Back to dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SEO title={`${team.name} Meetings · MeetLite`} />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[1.25rem] font-bold text-foreground tracking-[-0.025em]">
            Team Meetings
          </h1>
          <p className="text-[0.8125rem] text-muted-foreground mt-0.5">
            View, schedule, and join virtual calls for @{team.name}.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {canCreateMeetings && (
            <Button
              id="team-meetings-create-btn"
              size="sm"
              onClick={() => setShowScheduleModal(true)}
              className="gap-1.5 rounded-xl font-semibold"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Schedule meeting
            </Button>
          )}
          <MeetingViewToggle
            view={view}
            setView={setView}
            setShowImportModal={setShowImportModal}
          />
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
        onRecurrenceChange={handleRecurrenceChange}
        onParticipantInput={handleParticipantInput}
        onRemoveParticipant={removeParticipant}
        onSubmit={submitForm}
        onCancel={() => setShowScheduleModal(false)}
        teamId={teamId}
        teamName={team.name}
        onAutoIncludeChange={handleAutoIncludeChange}
      />

      <ImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        importLoading={importLoading}
        importError={importError}
        importedEvents={importedEvents}
        onImport={async (type) => {
          if (type === 'google') {
            if (!isConnected('google')) {
              await connectGoogleCalendar(async () => {
                const now = new Date();
                const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                await importCalendarEvents('google', now, in30);
                if (teamId && activeOrganization?.id) {
                  try {
                    const response = await api.get('/api/meetings', { params: { teamId } });
                    const meetingsData = extractData<Meeting[]>(response);
                    setMeetings(meetingsData || []);
                  } catch (error: any) {
                    console.error('Error reloading team meetings:', error);
                  }
                }
              });
            } else {
              const now = new Date();
              const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
              await importCalendarEvents('google', now, in30);
              if (teamId && activeOrganization?.id) {
                try {
                  const response = await api.get('/api/meetings', { params: { teamId } });
                  const meetingsData = extractData<Meeting[]>(response);
                  setMeetings(meetingsData || []);
                } catch (error: any) {
                  console.error('Error reloading team meetings:', error);
                }
              }
            }
          }
        }}
        isConnected={isConnected}
        refreshConnectionStatus={refreshConnectionStatus}
        disconnectCalendar={disconnectCalendar}
        isPolling={isPolling}
      />

      <div className="pt-2">
        {view === 'list' ? (
          <MeetingListSection meetings={meetings} loading={meetingsLoading} />
        ) : (
          <MeetingCalendarSection meetings={meetings} loading={meetingsLoading} />
        )}
      </div>
    </DashboardLayout>
  );
}
