import { useEffect, useState } from 'react';
import { useMeetings } from '@/hooks/useMeetings';

import { toast } from 'sonner';

import { useMeetingForm } from '@/hooks/useMeetingForm';
import SEO from '@/components/SEO';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Meeting } from '@/lib/types';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

import MeetingListSection from '@/components/meeting/MeetingListSection';
import MeetingCalendarSection from '@/components/meeting/MeetingCalendarSection';
import { useCalendarIntegration } from '@/hooks/useCalendarIntegration';
import ImportModal from '@/components/meeting/ImportModal';
import MeetingsLayout from '@/components/meetings/MeetingsLayout';
import ScheduleMeetingModal from '@/components/dashboard/ScheduleMeetingModal';

import MeetingViewToggle from '@/components/meetings/MeetingViewToggle';
import MeetingsWelcomeHeader from '@/components/meetings/MeetingsWelcomeHeader';

const Meetings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { fetchMeetings, deleteMeeting, startMeeting, completeMeeting } =
    useMeetings();
  const { importCalendarEvents } = useCalendarIntegration();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    meetingId?: string;
  }>({ open: false });

  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importedEvents, setImportedEvents] = useState<any[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

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
    setLoading(true);
    try {
      const data = await fetchMeetings();
      // Show active meetings + completed meetings only for creators
      const now = new Date();
      const activeMeetings = data.filter((meeting) => {
        const meetingEnd = new Date(
          new Date(meeting.scheduledTime).getTime() +
            (meeting.duration || 0) * 60000
        );
        const isCreator = meeting.createdBy === user?.id;

        // Show if:
        // 1. Not cancelled AND
        // 2. Either not completed OR (completed but user is creator) AND
        // 3. Meeting hasn't ended yet OR (ended but user is creator)
        return (
          meeting.status !== 'cancelled' &&
          (meeting.status !== 'completed' || isCreator) &&
          (meetingEnd > now || isCreator)
        );
      });
      setMeetings(activeMeetings);
    } catch (e) {
      toast.error('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
    // eslint-disable-next-line
  }, []);

  const handleDeleteClick = (meetingId: string) => {
    setDeleteDialog({ open: true, meetingId });
  };

  const handleDelete = async () => {
    if (!deleteDialog.meetingId) return;
    try {
      await deleteMeeting(deleteDialog.meetingId);
      toast.success('Meeting deleted');
      // Update local state immediately
      setMeetings((prevMeetings) =>
        prevMeetings.filter(
          (meeting) => meeting.meetingId !== deleteDialog.meetingId
        )
      );
    } catch (e) {
      toast.error('Failed to delete meeting');
    } finally {
      setDeleteDialog({ open: false });
    }
  };

  const handleStartMeeting = async (meetingId: string) => {
    try {
      const roomId = await startMeeting(meetingId);
      toast.success('Meeting started');
      navigate(`/lobby/${roomId}`);
    } catch (e: any) {
      if (e?.response?.data?.roomId) {
        // Meeting already started, redirect
        navigate(`/lobby/${e.response.data.roomId}`);
      } else {
        toast.error('Failed to start meeting');
      }
    }
  };

  const handleEndMeeting = async (meetingId: string) => {
    try {
      await completeMeeting(meetingId);
      toast.success('Meeting completed successfully');
      // Update local state immediately
      setMeetings((prevMeetings) =>
        prevMeetings.map((meeting) =>
          meeting.meetingId === meetingId
            ? { ...meeting, status: 'completed' }
            : meeting
        )
      );
    } catch (error) {
      console.error('Failed to complete meeting:', error);
      toast.error('Failed to complete meeting. Please try again.');
    }
  };

  const handleJoinMeeting = async (meetingId: string) => {
    try {
      // Try to start the meeting (this will work if you're the host)
      const roomId = await startMeeting(meetingId);
      navigate(`/lobby/${roomId}`);
    } catch (error: any) {
      // If you're not the host or meeting isn't started, navigate to join page
      navigate(`/meeting/${meetingId}/join`);
    }
  };

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
      // Avoid duplicates: filter out imported events that match local meetings by title+start time
      setMeetings((prev) => {
        const all = [...prev];
        taggedEvents.forEach((ev) => {
          if (
            !all.some(
              (m) => m.title === ev.title && m.scheduledTime === ev.start
            )
          ) {
            all.push({
              ...ev,
              scheduledTime: ev.start,
              duration:
                (new Date(ev.end).getTime() - new Date(ev.start).getTime()) /
                60000,
              meetingId: ev.id || `${ev.source}-${ev.id}`,
              participants: ev.attendees || [],
              privacy: 'public', // fallback
              status: 'scheduled', // fallback
            });
          }
        });
        return all;
      });
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
              <MeetingListSection
                meetings={meetings}
                loading={loading}
                onStartMeeting={handleStartMeeting}
                onDeleteMeeting={handleDeleteClick}
                onJoinMeeting={handleJoinMeeting}
                onEndMeeting={handleEndMeeting}
                userId={user?.id}
              />
            ) : (
              <MeetingCalendarSection
                meetings={meetings}
                loading={loading}
                userId={user?.id}
              />
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog
              open={deleteDialog.open}
              onOpenChange={(open) => setDeleteDialog((d) => ({ ...d, open }))}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this meeting? This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
