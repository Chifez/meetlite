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
import ScheduleMeetingModal from '@/components/dashboard/ScheduleMeetingModal';
import DeleteMeetingDialog from '@/components/ui/delete-meeting-dialog';
import MeetingViewToggle from '@/components/meetings/MeetingViewToggle';
import MeetingsWelcomeHeader from '@/components/meetings/MeetingsWelcomeHeader';

const Meetings = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { importCalendarEvents } = useCalendarIntegration();

  const {
    meetings,
    loading,
    view,
    setView,
    showImportModal,
    importLoading,
    importedEvents,
    importError,
    fetchMeetings: fetchMeetingsFromStore,
    setShowImportModal,
    setImportLoading,
    setImportedEvents,
    setImportError,
    importCalendarEvents: importCalendarEventsFromStore,
  } = useMeetingsStore();

  // URL-based modal state
  const showScheduleModal = searchParams.get('modal') === 'schedule';

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
  const handleImport = async (calendarType: 'google' | 'outlook') => {
    setImportLoading(true);
    setImportError(null);
    setImportedEvents([]);
    try {
      // Import events for the next 30 days
      const now = new Date();
      const in30 = new Date();
      in30.setDate(now.getDate() + 30);
      const events = await importCalendarEvents(calendarType, now, in30);
      // Tag imported events with their source
      const taggedEvents = events.map((e) => ({ ...e, source: calendarType }));
      // Use store method to add imported events
      await importCalendarEventsFromStore(calendarType, now, in30);
      setImportedEvents(taggedEvents);
    } catch (err: any) {
      setImportError('Failed to import events.');
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <>
      <SEO title="Meetings" />
      <ScheduleMeetingModal
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
        <div className="min-h-screen bg-page py-12 px-4">
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
        />
      </MeetingsLayout>
    </>
  );
};

export default Meetings;
