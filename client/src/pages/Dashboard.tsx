import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  PlusCircle,
  Users,
  CalendarDays,
  List,
  Zap,
  Calendar,
} from 'lucide-react';
import { env } from '@/config/env';
import SEO from '@/components/SEO';
import { useMeetings } from '@/hooks/useMeetings';
import { useMeetingForm } from '@/hooks/useMeetingForm';
import { Meeting } from '@/lib/types';
import MeetingCard from '@/components/meeting/MeetingCard';
import MeetingForm from '@/components/meeting/MeetingForm';
import api from '@/lib/axios';

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
            const isCreator = m.createdBy === user?.id;

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
  }, [user?.id]);

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

      {/* Schedule Meeting Modal */}
      <Dialog
        open={showScheduleModal}
        onOpenChange={(open) => !open && closeScheduleModal()}
      >
        <DialogContent showCloseButton className="max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Schedule Meeting</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <MeetingForm
              formData={formData}
              loading={formLoading}
              hideFooter
              onInputChange={handleInputChange}
              onDateChange={handleDateChange}
              onTimeChange={handleTimeChange}
              onPrivacyChange={handlePrivacyChange}
              onParticipantInput={handleParticipantInput}
              onRemoveParticipant={removeParticipant}
              onSubmit={submitForm}
              onCancel={closeScheduleModal}
            />
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button
              type="button"
              onClick={submitForm}
              className="min-w-[120px]"
              disabled={formLoading}
            >
              {formLoading ? 'Scheduling...' : 'Schedule'}
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen bg-page py-12 px-4">
        <div className="max-w-5xl mx-auto space-y-10">
          {/* Welcome */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold">
              <span className="text-gray-900 dark:text-gray-100">Welcome,</span>
              <span className="bg-primary bg-clip-text text-transparent">
                {user?.email?.split('@')[0] || 'User'}
              </span>
            </h1>
            {/* <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-purple-600 to-blue-600 text-transparent bg-clip-text mb-2">
              Welcome, {user?.email?.split('@')[0] || 'User'}
            </h1> */}
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Ready to connect and collaborate? Start a meeting, join your team,
              or schedule for later.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlusCircle className="h-5 w-5" />
                  Schedule Meeting
                </CardTitle>
                <CardDescription>
                  Plan a meeting for later and send invites
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Link to="/meetings">
                  <Button className="w-full">Go to Meetings</Button>
                </Link>
              </CardFooter>
            </Card>
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Join Meeting
                </CardTitle>
                <CardDescription>
                  Enter a code to join a meeting room
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="Enter meeting code"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                />
              </CardContent>
              <CardFooter>
                <Button onClick={joinRoom} className="w-full">
                  Join
                </Button>
              </CardFooter>
            </Card>
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Start Instant Meeting
                </CardTitle>
                <CardDescription>
                  Create a room and start collaborating now
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button
                  onClick={handleQuickMeeting}
                  className="w-full"
                  disabled={isCreatingRoom}
                >
                  Start Quick Meeting
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Upcoming Meetings */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <List className="h-6 w-6 text-blue-600" /> Upcoming Meetings
            </h2>
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground mt-2">
                    Loading meetings...
                  </p>
                </div>
              ) : meetings.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent className="space-y-4">
                    <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                      <Calendar className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-foreground">
                        No upcoming meetings
                      </h3>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        Schedule your first meeting to get started with your
                        team collaboration.
                      </p>
                    </div>
                    <Button onClick={openScheduleModal} className="mt-4">
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Schedule Meeting
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                meetings.map((meeting) => (
                  <MeetingCard
                    key={meeting.meetingId}
                    meeting={meeting}
                    userId={user?.id}
                    onStart={handleStartMeeting}
                    onDelete={handleDeleteMeeting}
                    onJoin={handleJoinMeeting}
                    onEnd={handleEndMeeting}
                    showJoinButton={true}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
