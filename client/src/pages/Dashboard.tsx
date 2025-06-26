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

const Dashboard = () => {
  const { user, getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const { fetchMeetings } = useMeetings();

  // State for join room
  const [joinRoomId, setJoinRoomId] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  // State for upcoming meetings
  const [upcoming, setUpcoming] = useState<Meeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(true);

  // Fetch upcoming meetings
  useEffect(() => {
    const loadMeetings = async () => {
      setLoadingMeetings(true);
      try {
        const meetings = await fetchMeetings();
        // Show only meetings scheduled for the future, sorted by time
        const now = new Date();
        setUpcoming(
          meetings
            .filter((m) => new Date(m.scheduledTime) > now)
            .sort(
              (a, b) =>
                new Date(a.scheduledTime).getTime() -
                new Date(b.scheduledTime).getTime()
            )
            .slice(0, 3)
        );
      } catch {
        setUpcoming([]);
      } finally {
        setLoadingMeetings(false);
      }
    };
    loadMeetings();
    // eslint-disable-next-line
  }, []);

  // Handlers
  const createRoom = async () => {
    try {
      setIsCreatingRoom(true);
      const response = await axios.post(
        `${env.ROOM_API_URL}/rooms`,
        {},
        { headers: getAuthHeaders() }
      );
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
                  onClick={createRoom}
                  className="w-full"
                  disabled={isCreatingRoom}
                >
                  {isCreatingRoom ? 'Creating...' : 'Start Now'}
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
              {loadingMeetings ? (
                <div>Loading meetings...</div>
              ) : upcoming.length === 0 ? (
                <div className="text-gray-500">No upcoming meetings.</div>
              ) : (
                upcoming.map((meeting) => (
                  <MeetingCard
                    key={meeting.meetingId}
                    meeting={meeting}
                    userId={user?.id}
                    onStart={() => {}}
                    onDelete={() => {}}
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
