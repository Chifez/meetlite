import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

import { env } from '@/config/env';
import SEO from '@/components/SEO';
import { useMeetings } from '@/hooks/useMeetings';
import { useMeetingForm } from '@/hooks/useMeetingForm';
import { Meeting } from '@/lib/types';
import api from '@/lib/axios';
import WelcomeHeader from '@/components/dashboard/WelcomeHeader';
import QuickActions from '@/components/dashboard/QuickActions';
import UpcomingMeetingsSection from '@/components/dashboard/UpcomingMeetingsSection';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ScheduleMeetingModal from '@/components/dashboard/ScheduleMeetingModal';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { fetchMeetings, startMeeting, completeMeeting, deleteMeeting } =
    useMeetings();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // State for join room
  const [joinRoomId, setJoinRoomId] = useState('');

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

  // Fetch upcoming meetings
  const loadMeetings = async () => {
    setLoading(true);
    try {
      const meetings = await fetchMeetings();
      // Show active meetings + completed meetings only for creators
      const now = new Date();
      setMeetings(
        meetings
          .filter((m) => {
            const meetingEnd = new Date(
              new Date(m.scheduledTime).getTime() + (m.duration || 0) * 60000
            );

            // Show if:
            // 1. Not cancelled AND
            // 2. Either not completed OR (completed but user is creator) AND
            // 3. Meeting hasn't ended yet OR (ended but user is creator)
            return (
              m.status !== 'cancelled' &&
              m.status !== 'completed' &&
              meetingEnd > now
            );
          })
          .sort(
            (a, b) =>
              new Date(a.scheduledTime).getTime() -
              new Date(b.scheduledTime).getTime()
          )
          .slice(0, 3)
      );
    } catch {
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
    // eslint-disable-next-line
  }, []);

  // Handlers
  const handleQuickMeeting = async () => {
    try {
      setIsCreatingRoom(true);
      const response = await api.post(`${env.ROOM_API_URL}/rooms`, {});
      const { roomId } = response.data;
      navigate(`/lobby/${roomId}`);
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to create room. Please try again.',
      });
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const joinRoom = () => {
    if (!joinRoomId.trim()) {
      toast.info('Error', {
        description: 'Please enter a room code',
      });
      return;
    }
    navigate(`/lobby/${joinRoomId.trim()}`);
  };

  const handleJoinMeeting = async (meetingId: string) => {
    console.log('Joining meeting:', meetingId);
    try {
      // Try to start the meeting (this will work if you're the host)
      console.log('Attempting to start meeting...');
      const roomId = await startMeeting(meetingId);
      console.log('Meeting started, roomId:', roomId);
      navigate(`/lobby/${roomId}`);
    } catch (error: any) {
      console.log('Failed to start meeting, navigating to join page:', error);
      // If you're not the host or meeting isn't started, navigate to join page
      navigate(`/meeting/${meetingId}/join`);
    }
  };

  const handleStartMeeting = async (meetingId: string) => {
    try {
      const roomId = await startMeeting(meetingId);
      navigate(`/room/${roomId}`);
    } catch (error) {
      console.error('Failed to start meeting:', error);
      toast.error('Error', {
        description: 'Failed to start meeting. Please try again.',
      });
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

  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      await deleteMeeting(meetingId);
      toast.success('Meeting deleted successfully');
      // Update local state immediately
      setMeetings((prevMeetings) =>
        prevMeetings.filter((meeting) => meeting.meetingId !== meetingId)
      );
    } catch (error) {
      console.error('Failed to delete meeting:', error);
      toast.error('Failed to delete meeting. Please try again.');
    }
  };

  return (
    <>
      <SEO title="Dashboard" />
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
        onSubmit={submitForm}
        onCancel={closeScheduleModal}
      />
      <DashboardLayout>
        <WelcomeHeader user={user ?? undefined} />
        <QuickActions
          onSchedule={openScheduleModal}
          onJoin={joinRoom}
          onQuickMeeting={handleQuickMeeting}
          joinRoomId={joinRoomId}
          setJoinRoomId={setJoinRoomId}
          isCreatingRoom={isCreatingRoom}
        />
        <UpcomingMeetingsSection
          meetings={meetings}
          loading={loading}
          onStartMeeting={handleStartMeeting}
          onDeleteMeeting={handleDeleteMeeting}
          onJoinMeeting={handleJoinMeeting}
          onEndMeeting={handleEndMeeting}
          userId={user?.id}
          onSchedule={openScheduleModal}
        />
      </DashboardLayout>
    </>
  );
};

export default Dashboard;
