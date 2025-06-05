import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { PlusCircle, Users } from 'lucide-react';
import { env } from '@/config/env';
import SEO from '@/components/SEO';

const Dashboard = () => {
  const { user, getAuthHeaders } = useAuth();
  const navigate = useNavigate();

  const [joinRoomId, setJoinRoomId] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

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
      console.error('Error creating room:', error);
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
      <SEO />

      <div className="container max-w-4xl mx-auto py-16 px-4 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Welcome, {user?.email}</h1>
          <p className="text-muted-foreground">
            Create a new meeting or join an existing one
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle className="h-5 w-5" />
                Create Meeting
              </CardTitle>
              <CardDescription>
                Start a new meeting and invite others
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4">
                Create a new meeting room and share the link or code with
                participants. All participants will enter a lobby before
                joining.
              </p>
            </CardContent>
            <CardFooter>
              <Button
                onClick={createRoom}
                className="w-full"
                disabled={isCreatingRoom}
              >
                {isCreatingRoom ? 'Creating...' : 'Create New Meeting'}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Join Meeting
              </CardTitle>
              <CardDescription>
                Join an existing meeting with a code
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm">
                  Enter the meeting code provided by the meeting organizer.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter meeting code"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={joinRoom} className="w-full">
                Join Meeting
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
