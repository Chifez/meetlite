import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/contexts/workspace-context';
import { useCalendarIntegration } from '@/hooks/use-calendar-integration';
import { toast } from 'sonner';
import SEO from '@/components/seo';
import { useMeetingForm } from '@/hooks/use-meeting-forms';
import api from '@/lib/axios';
import WelcomeHeader from '@/components/dashboard/welcome-header';
import QuickActions from '@/components/dashboard/quick-action';
import UpcomingMeetingsSection from '@/components/dashboard/upcoming-meetings-section';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import SmartSchedulingModal from '@/components/dashboard/smart-scheduling-modal';
import DeleteMeetingDialog from '@/components/ui/delete-meeting-dialog';
import { useMeetingsStore, useUIStore } from '@/stores';

const Dashboard = () => {
  const { user } = useAuth();
  const { activeOrganization } = useWorkspace();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { meetings, loading, fetchMeetings } = useMeetingsStore();
  const { setGlobalLoading } = useUIStore();
  const { scheduleMeetingOnCalendar } = useCalendarIntegration();

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
    setSearchParams({});
    if (user?.id) {
      fetchMeetings(user.id);
    }
  });

  const openScheduleModal = () => {
    setSearchParams({ modal: 'schedule' });
  };

  const closeScheduleModal = () => {
    setSearchParams({});
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

  const handleQuickMeeting = async () => {
    try {
      setGlobalLoading(true);
      const response = await api.post('/api/rooms', {});
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

  // Fetch upcoming meetings on mount and when organization changes
  useEffect(() => {
    if (user?.id) {
      fetchMeetings(user.id);
    }
  }, [user?.id, activeOrganization?.id, fetchMeetings]);

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

      <DeleteMeetingDialog />
    </>
  );
};

export default Dashboard;
