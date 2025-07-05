import { useEffect } from 'react';
import { toast } from 'sonner';
import { useMeetingForm } from '@/hooks/useMeetingForm';
import SEO from '@/components/SEO';
import { useAuth } from '@/hooks/useAuth';
import { useSearchParams } from 'react-router-dom';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useMeetingsStore } from '@/stores';
import MeetingListSection from '@/components/meeting/MeetingListSection';
import MeetingCalendarSection from '@/components/meeting/MeetingCalendarSection';
import { useCalendarIntegration } from '@/hooks/useCalendarIntegration';
import ImportModal from '@/components/meeting/ImportModal';
import MeetingsLayout from '@/components/meetings/MeetingsLayout';
import SmartSchedulingModal from '@/components/dashboard/SmartSchedulingModal';
import DeleteMeetingDialog from '@/components/ui/delete-meeting-dialog';
import MeetingViewToggle from '@/components/meetings/MeetingViewToggle';
import MeetingsWelcomeHeader from '@/components/meetings/MeetingsWelcomeHeader';

const Meetings = () => {
  const { user } = useAuth();
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
  } = useCalendarIntegration();

  const {
    meetings,
    loading,
    view,
    setView,
    fetchMeetings: fetchMeetingsFromStore,
  } = useMeetingsStore();

  // URL-based modal state
  const showScheduleModal = searchParams.get('modal') === 'schedule';

  // Handle OAuth callback
  useEffect(() => {
    const oauthStatus = searchParams.get('oauth');
    const provider = searchParams.get('provider');

    if (oauthStatus === 'success' && provider === 'google') {
      toast.success('Google Calendar connected successfully!');
      // Refresh connection status
      refreshConnectionStatus();
      // Clear the OAuth params from URL
      setSearchParams({});
    } else if (oauthStatus === 'error' && provider === 'google') {
      toast.error('Failed to connect Google Calendar. Please try again.');
      // Clear the OAuth params from URL
      setSearchParams({});
    }
  }, [searchParams, refreshConnectionStatus, setSearchParams]);

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
    // Close modal and refresh meetings
    setSearchParams({});
    loadMeetings();
  });

  const openScheduleModal = () => {
    setSearchParams({ modal: 'schedule' });
  };

  const closeScheduleModal = () => {
    setSearchParams({});
  };

  const loadMeetings = async () => {
    try {
      await fetchMeetingsFromStore(user?.id);
    } catch (e) {
      toast.error('Failed to load meetings');
    }
  };

  useEffect(() => {
    loadMeetings();
    // eslint-disable-next-line
  }, []);

  const handleFormSubmit = async () => {
    await submitForm();
  };

  // Import handler
  const handleImport = async () => {
    if (!isConnected('google')) {
      // Start OAuth and polling, then auto-import when connected
      await connectGoogleCalendar(async () => {
        // Import events for the next 30 days after connection
        const now = new Date();
        const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        await importCalendarEvents('google', now, in30);
      });
    } else {
      // Already connected, import directly
      const now = new Date();
      const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await importCalendarEvents('google', now, in30);
    }
  };

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
      />
      <MeetingsLayout>
        <div className="min-h-screen bg-page md:px-4">
          <div className="max-w-4xl mx-auto space-y-10">
            {/* Hero Section */}
            <MeetingsWelcomeHeader onSchedule={openScheduleModal} />

            {/* View Toggle */}
            <MeetingViewToggle
              view={view}
              setView={setView}
              setShowImportModal={setShowImportModal}
            />

            {/* Meetings List or Calendar */}
            {view === 'list' ? (
              <MeetingListSection meetings={meetings} loading={loading} />
            ) : (
              <MeetingCalendarSection meetings={meetings} loading={loading} />
            )}

            {/* Delete Confirmation Dialog */}
            <DeleteMeetingDialog />
          </div>
        </div>
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
      </MeetingsLayout>
    </>
  );
};

export default Meetings;
