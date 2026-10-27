import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/contexts/workspace-context';
import { useCalendarIntegration } from '@/hooks/use-calendar-integration';
import { useMeetingAssets } from '@/hooks/use-meeting-assets';
import { toast } from 'sonner';
import { extractError } from '@/lib/api-response';
import SEO from '@/components/seo';
import { useMeetingForm } from '@/hooks/use-meeting-forms';
import api from '@/lib/axios';
import { extractData } from '@/lib/api-response';
import WelcomeHeader from '@/components/dashboard/welcome-header';
import DashboardStatsStrip from '@/components/dashboard/dashboard-stats-strip';
import QuickActions from '@/components/dashboard/quick-action';
import UpcomingMeetingsSection from '@/components/dashboard/upcoming-meetings-section';
import RecentRecordingsWidget from '@/components/dashboard/recent-recordings-widget';
import RecentActivity from '@/components/dashboard/recent-activity';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import SmartSchedulingModal from '@/components/dashboard/smart-scheduling-modal';
import DeleteMeetingDialog from '@/components/ui/delete-meeting-dialog';
import { useMeetingsStore, useUIStore } from '@/stores';
import { isToday } from 'date-fns';

const Dashboard = () => {
  const { user } = useAuth();
  const { activeOrganization } = useWorkspace();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { meetings, loading, fetchMeetings } = useMeetingsStore();
  const { stats } = useMeetingAssets(activeOrganization?.id);
  const { setGlobalLoading } = useUIStore();
  const { scheduleMeetingOnCalendar } = useCalendarIntegration();
  const [searchQuery, setSearchQuery] = useState('');

  const showScheduleModal = searchParams.get('modal') === 'schedule';

  // Use the custom hook for form state management
  const {
    formData,
    loading: formLoading,
    handleInputChange,
    handleDateChange,
    handleTimeChange,
    handlePrivacyChange,
    handleRecurrenceChange,
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
      toast.error(extractError(error) || 'Failed to schedule meeting on Google Calendar');
    }
  };

  const handleQuickMeeting = async () => {
    try {
      setGlobalLoading(true);
      const response = await api.post('/api/rooms', {});
      const result = extractData<{ roomId: string }>(response);
      const { roomId } = result;
      navigate(`/lobby/${roomId}`);
    } catch (error) {
      toast.error('Error', {
        description: extractError(error) || 'Failed to create room. Please try again.',
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

  // Filter meetings by organization and search query
  const organizationMeetings = useMemo(() => {
    return meetings.filter((meeting) => !meeting.teamId);
  }, [meetings]);

  const filteredMeetings = useMemo(() => {
    if (!searchQuery.trim()) return organizationMeetings;
    const q = searchQuery.toLowerCase();
    return organizationMeetings.filter((m) =>
      (m.title || '').toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q)
    );
  }, [organizationMeetings, searchQuery]);

  // Count meetings today
  const todayMeetingsCount = useMemo(() => {
    return organizationMeetings.filter((m) => {
      const date = new Date(m.scheduledTime);
      return !isNaN(date.getTime()) && isToday(date);
    }).length;
  }, [organizationMeetings]);

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
        onRecurrenceChange={handleRecurrenceChange}
        onParticipantInput={handleParticipantInput}
        onRemoveParticipant={removeParticipant}
        onSubmit={submitForm}
        onCancel={closeScheduleModal}
        onScheduleOnCalendar={handleScheduleOnCalendar}
      />

      <DashboardLayout>
        {/* 1. Top Header Bar: Greeting, Search, Schedule, and Instant Meeting */}
        <WelcomeHeader
          user={user ?? undefined}
          todayMeetingsCount={todayMeetingsCount}
          onQuickMeeting={handleQuickMeeting}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* 2. Compact 4-Card Stats Strip */}
        <DashboardStatsStrip
          meetings={organizationMeetings}
          recordingsCount={stats?.totalRecordings || 0}
          recordingsTotalSize={stats?.totalSize || 0}
        />

        {/* 3. Main 2:1 Productivity Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Main Column (2/3 width) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Compact Action Row: Schedule Card + Join Input */}
            <QuickActions
              onSchedule={openScheduleModal}
              onJoin={joinRoom}
              onQuickMeeting={handleQuickMeeting}
            />

            {/* Upcoming Meetings Enclosed Card */}
            <UpcomingMeetingsSection
              meetings={filteredMeetings}
              loading={loading}
              onSchedule={openScheduleModal}
            />
          </div>

          {/* Side Rail (1/3 width) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Recent Recordings Widget */}
            <RecentRecordingsWidget />

            {/* Recent Activity Feed */}
            <RecentActivity />
          </div>
        </div>
      </DashboardLayout>

      <DeleteMeetingDialog />
    </>
  );
};

export default Dashboard;
