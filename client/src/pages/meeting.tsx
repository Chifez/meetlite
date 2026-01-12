import { useEffect } from 'react';
import { toast } from 'sonner';
import { useMeetingForm } from '@/hooks/use-meeting-forms';
import SEO from '@/components/seo';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/contexts/workspace-context';
import { useSearchParams } from 'react-router-dom';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useMeetingsStore } from '@/stores';
import MeetingListSection from '@/components/meeting/meeting-list-section';
import MeetingCalendarSection from '@/components/meeting/meeting-calendar-section';
import { useCalendarIntegration } from '@/hooks/use-calendar-integration';
import ImportModal from '@/components/meeting/import-modal';
import SmartSchedulingModal from '@/components/dashboard/smart-scheduling-modal';
import DeleteMeetingDialog from '@/components/ui/delete-meeting-dialog';
import MeetingViewToggle from '@/components/meetings/meeting-view-toggle';
import MeetingsWelcomeHeader from '@/components/meetings/meetings-welcome-header';
import DashboardLayout from '@/components/dashboard/dashboard-layout';

const Meetings = () => {
  const { user } = useAuth();
  const { activeOrganization } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    importCalendarEvents,
    showImportModal,
    setShowImportModal,
    importLoading,
    importedEvents,
    importError,
    isConnected,
    refreshConnectionStatus,
    connectGoogleCalendar,
    isPolling,
    disconnectCalendar,
    scheduleMeetingOnCalendar,
  } = useCalendarIntegration();

  const {
    meetings,
    loading,
    view,
    setView,
    fetchMeetings: fetchMeetingsFromStore,
  } = useMeetingsStore();

  const showScheduleModal = searchParams.get('modal') === 'schedule';
  const oauthStatus = searchParams.get('oauth');
  const provider = searchParams.get('provider');

  // Handle OAuth callback side effects
  useEffect(() => {
    if (oauthStatus === 'success' && provider === 'google') {
      toast.success('Google Calendar connected successfully!');
      refreshConnectionStatus();
      setSearchParams({});
    } else if (oauthStatus === 'error' && provider === 'google') {
      toast.error('Failed to connect Google Calendar. Please try again.');
      setSearchParams({});
    }
  }, [setSearchParams, refreshConnectionStatus, oauthStatus, provider]);

  const loadMeetings = async () => {
    try {
      await fetchMeetingsFromStore(user?.id);
    } catch (e) {
      toast.error('Failed to load meetings');
    }
  };

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
  } = useMeetingForm(() => {
    setSearchParams({});
    loadMeetings();
  });

  const openScheduleModal = () => {
    setSearchParams({ modal: 'schedule' });
  };

  const closeScheduleModal = () => {
    setSearchParams({});
  };

  const handleFormSubmit = async () => {
    await submitForm();
  };

  const handleScheduleOnCalendar = async (slot: any) => {
    try {
      const meetingData = {
        title: slot.title || 'Meeting',
        description: slot.description || '',
        startDate: slot.start,
        endDate: slot.end,
        participants: slot.participants || [],
      };

      const success = await scheduleMeetingOnCalendar(meetingData);

      if (success) {
        toast.success('Meeting scheduled on Google Calendar!');
        await loadMeetings();
      } else {
        toast.error('Failed to schedule meeting on Google Calendar');
      }
    } catch (error) {
      console.error('Error scheduling on calendar:', error);
      toast.error('Failed to schedule meeting on Google Calendar');
    }
  };

  const handleImport = async () => {
    if (!isConnected('google')) {
      await connectGoogleCalendar(async () => {
        const now = new Date();
        const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        await importCalendarEvents('google', now, in30);
      });
    } else {
      const now = new Date();
      const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await importCalendarEvents('google', now, in30);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadMeetings();
    }
  }, [user?.id, activeOrganization?.id]);

  return (
    <>
      <SEO title="Meetings" />
      <SmartSchedulingModal
        open={showScheduleModal}
        onOpenChange={(open) => !open && closeScheduleModal()}
        formData={formData}
        formLoading={formLoading}
        onInputChange={handleInputChange}
        onDateChange={handleDateChange}
        onTimeChange={handleTimeChange}
        onPrivacyChange={handlePrivacyChange}
        onParticipantInput={handleParticipantInput}
        onRemoveParticipant={removeParticipant}
        onSubmit={handleFormSubmit}
        onCancel={closeScheduleModal}
        onScheduleOnCalendar={handleScheduleOnCalendar}
      />
      <DashboardLayout>
        <MeetingsWelcomeHeader onSchedule={openScheduleModal} />

        <MeetingViewToggle
          view={view}
          setView={setView}
          setShowImportModal={setShowImportModal}
        />

        {view === 'list' ? (
          <MeetingListSection
            meetings={meetings.filter((meeting) => !meeting.teamId)}
            loading={loading}
          />
        ) : (
          <MeetingCalendarSection
            meetings={meetings.filter((meeting) => !meeting.teamId)}
            loading={loading}
          />
        )}

        <DeleteMeetingDialog />
      </DashboardLayout>

      <ImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        importLoading={importLoading}
        importError={importError}
        importedEvents={importedEvents}
        onImport={handleImport}
        isConnected={isConnected}
        refreshConnectionStatus={refreshConnectionStatus}
        disconnectCalendar={disconnectCalendar}
        isPolling={isPolling}
      />
    </>
  );
};

export default Meetings;
