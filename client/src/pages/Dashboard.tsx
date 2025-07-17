import { useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCalendarIntegration } from '@/hooks/useCalendarIntegration';
import { toast } from 'sonner';
import { env } from '@/config/env';
import SEO from '@/components/SEO';
import { useMeetingForm } from '@/hooks/useMeetingForm';
import api from '@/lib/axios';
import WelcomeHeader from '@/components/dashboard/WelcomeHeader';
import QuickActions from '@/components/dashboard/QuickActions';
import UpcomingMeetingsSection from '@/components/dashboard/UpcomingMeetingsSection';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import SmartSchedulingModal from '@/components/dashboard/SmartSchedulingModal';
import SettingsModal from '@/components/dashboard/SettingsModal';
import DeleteMeetingDialog from '@/components/ui/delete-meeting-dialog';
import { useMeetingsStore, useUIStore } from '@/stores';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Use stores instead of local state
  const { meetings, loading, fetchMeetings } = useMeetingsStore();

  const { setGlobalLoading } = useUIStore();

  // Calendar integration
  const { scheduleMeetingOnCalendar } = useCalendarIntegration();

  // URL-based modal state
  const showScheduleModal = searchParams.get('modal') === 'schedule';
  const showSettingsModal = searchParams.get('settings') === 'true';

  // Handle OAuth callback
  // useEffect(() => {
  //   const oauthStatus = searchParams.get('oauth');
  //   const provider = searchParams.get('provider');

  //   if (oauthStatus === 'success' && provider === 'google') {
  //     toast.success('Google Calendar connected successfully!');
  //     // Refresh connection status
  //     refreshConnectionStatus();
  //     // Clear the OAuth params from URL
  //     setSearchParams({});
  //   } else if (oauthStatus === 'error' && provider === 'google') {
  //     toast.error('Failed to connect Google Calendar. Please try again.');
  //     // Clear the OAuth params from URL
  //     setSearchParams({});
  //   }
  // }, [searchParams, refreshConnectionStatus, setSearchParams]);

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
  });

  const openScheduleModal = () => {
    setSearchParams({ modal: 'schedule' });
  };

  const closeScheduleModal = () => {
    setSearchParams({});
  };

  const closeSettingsModal = () => {
    setSearchParams({});
  };

  // Handle direct scheduling on Google Calendar
  const handleScheduleOnCalendar = async (slot: any) => {
    try {
      // Get the original meeting data from the conflict resolution
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
        // Refresh meetings to show the new meeting
        if (user?.id) {
          await fetchMeetings(user.id);
        }
      } else {
        toast.error('Failed to schedule meeting on Google Calendar');
      }
    } catch (error) {
      console.error('Error scheduling on calendar:', error);
      toast.error('Failed to schedule meeting on Google Calendar');
    }
  };

  // Fetch upcoming meetings
  const initializeDashboard = useCallback(async () => {
    if (user?.id) {
      // Only fetch if we don't have meetings or if user ID changed
      await fetchMeetings(user.id);
    }
  }, [user?.id, fetchMeetings]);

  useEffect(() => {
    initializeDashboard();
  }, [initializeDashboard]);

  // Handlers
  const handleQuickMeeting = async () => {
    try {
      setGlobalLoading(true);
      const response = await api.post(`${env.ROOM_API_URL}/rooms`, {});
      const { roomId } = response.data;
      navigate(`/lobby/${roomId}`);
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to create room. Please try again.',
      });
    } finally {
      setGlobalLoading(false);
    }
  };

  const joinRoom = (joinRoomId: string) => {
    if (!joinRoomId.trim()) {
      toast.info('Error', {
        description: 'Please enter a room code',
      });
      return;
    }
    navigate(`/lobby/${joinRoomId.trim()}`);
  };

  // Get upcoming meetings (first 3)
  const upcomingMeetings = meetings
    .sort(
      (a, b) =>
        new Date(a.scheduledTime).getTime() -
        new Date(b.scheduledTime).getTime()
    )
    .slice(0, 3);

  return (
    <>
      <SEO title="Dashboard" />
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
        onSubmit={submitForm}
        onCancel={closeScheduleModal}
        onScheduleOnCalendar={handleScheduleOnCalendar}
      />
      <SettingsModal
        key={showSettingsModal ? 'open' : 'close'}
        open={showSettingsModal}
        onOpenChange={(open) => !open && closeSettingsModal()}
      />
      <DashboardLayout>
        <WelcomeHeader user={user ?? undefined} />
        <QuickActions
          onSchedule={openScheduleModal}
          onJoin={joinRoom}
          onQuickMeeting={handleQuickMeeting}
        />
        <UpcomingMeetingsSection
          meetings={upcomingMeetings}
          loading={loading}
          onSchedule={openScheduleModal}
        />
      </DashboardLayout>

      {/* Delete Confirmation Dialog */}
      <DeleteMeetingDialog />
    </>
  );
};

export default Dashboard;
