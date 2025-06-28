import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import { PlusCircle, Users, CalendarDays, List } from 'lucide-react';
import { env } from '@/config/env';
import SEO from '@/components/SEO';
import { useMeetings } from '@/hooks/useMeetings';
import { Meeting } from '@/lib/types';
import MeetingCard from '@/components/meeting/MeetingCard';
import api from '@/lib/axios';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { fetchMeetings, startMeeting, completeMeeting, deleteMeeting } =
    useMeetings();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // State for join room
  const [joinRoomId, setJoinRoomId] = useState('');

  // Fetch upcoming meetings
  useEffect(() => {
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
      <div className="min-h-screen bg-page py-12 px-4">
        <div className="max-w-5xl mx-auto space-y-10">
          {/* Welcome */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-700 to-blue-400 text-transparent bg-clip-text mb-2">
              Welcome, {user?.email?.split('@')[0] || 'User'}
            </h1>
            <p className="text-lg text-gray-600">
              Effortlessly schedule, join, and manage your meetings.
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
                <div>Loading meetings...</div>
              ) : meetings.length === 0 ? (
                <div className="text-gray-500">No upcoming meetings.</div>
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
