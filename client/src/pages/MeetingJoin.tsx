import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useMeetings } from '@/hooks/useMeetings';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import SEO from '@/components/SEO';
import { Meeting } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, AlertCircle } from 'lucide-react';

const POLL_INTERVAL = 5000;

const MeetingJoin = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const [searchParams] = useSearchParams();
  const { getMeeting, validateInviteToken } = useMeetings();
  const { isAuthenticated, setRedirectTo } = useAuth();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [tokenValidated, setTokenValidated] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const fetchMeeting = async () => {
      setLoading(true);
      console.log('Fetching meeting:', meetingId);
      try {
        if (!meetingId) return;

        const token = searchParams.get('token');
        console.log('Token from URL:', token);

        // For private meetings, validate token first
        if (token) {
          try {
            console.log('Validating token for private meeting...');
            const validationResult = await validateInviteToken(
              meetingId,
              token
            );
            console.log('Token validation result:', validationResult);
            setMeeting(validationResult.meeting);
            setTokenValidated(true);

            // Check if meeting has roomId after setting it
            if (validationResult.meeting?.roomId) {
              console.log(
                'Meeting has roomId, navigating to lobby:',
                validationResult.meeting.roomId
              );
              navigate(`/lobby/${validationResult.meeting.roomId}`);
              return;
            }
          } catch (error: any) {
            console.error('Token validation error:', error);
            if (error.response?.status === 403) {
              setAccessDenied(true);
              toast.error('Invalid or expired invite link');
            } else {
              toast.error('Failed to validate invite');
            }
            return;
          }
        } else {
          // Try to get meeting directly (for public meetings or authenticated users)
          try {
            console.log('Getting meeting directly...');
            const data = await getMeeting(meetingId);
            console.log('Meeting data:', data);
            setMeeting(data);

            // Check if meeting has roomId after setting it
            if (data?.roomId) {
              console.log(
                'Meeting has roomId, navigating to lobby:',
                data.roomId
              );
              navigate(`/lobby/${data.roomId}`);
              return;
            }
          } catch (error: any) {
            console.error('Get meeting error:', error);
            if (error.response?.status === 403) {
              // This is a private meeting and user is not authenticated
              if (!isAuthenticated) {
                // Set redirect URL and navigate to login
                const currentUrl =
                  window.location.pathname + window.location.search;
                setRedirectTo(currentUrl);
                navigate('/login');
                return;
              } else {
                setAccessDenied(true);
                toast.error(
                  'This is a private meeting. You need an invite to join.'
                );
              }
            } else {
              toast.error('Meeting not found');
            }
            return;
          }
        }

        // If we get here, the meeting doesn't have a roomId yet, so poll
        if (meeting) {
          console.log('Meeting found but no roomId, polling...');
          interval = setTimeout(fetchMeeting, POLL_INTERVAL);
        }
      } catch (e) {
        console.error('General error in fetchMeeting:', e);
        toast.error('Failed to load meeting');
      } finally {
        setLoading(false);
      }
    };
    fetchMeeting();
    return () => {
      if (interval) clearTimeout(interval);
    };
    // eslint-disable-next-line
  }, [meetingId, searchParams, isAuthenticated, setRedirectTo, navigate]);

  if (loading) return <div className="p-8 text-center">Loading meeting...</div>;

  if (accessDenied) {
    return (
      <div className="container max-w-xl mx-auto py-16 px-4 text-center">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center justify-center gap-2 text-red-600 mb-2">
              <Lock className="h-6 w-6" />
              <CardTitle className="text-red-800">Access Denied</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-2 text-red-600 mb-4">
              <AlertCircle className="h-5 w-5" />
              <p className="text-red-700">
                This is a private meeting. You need a valid invite link to join.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard')}
              className="mt-4"
            >
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!meeting)
    return <div className="p-8 text-center">Meeting not found.</div>;

  return (
    <>
      <SEO title={meeting.title} />
      <div className="container max-w-xl mx-auto py-16 px-4 text-center">
        <h1 className="text-2xl font-bold mb-2">{meeting.title}</h1>
        <p className="mb-4">{meeting.description}</p>
        <p className="mb-4">
          <strong>Scheduled:</strong>{' '}
          {new Date(meeting.scheduledTime).toLocaleString()}
          <br />
          <strong>Duration:</strong> {meeting.duration} min
        </p>
        {meeting.privacy === 'private' && (
          <div className="mb-4 flex items-center justify-center gap-2 text-blue-600">
            <Lock className="h-4 w-4" />
            <span className="text-sm">Private Meeting</span>
          </div>
        )}
        <div className="mt-8 text-lg font-semibold text-blue-600">
          Waiting for the host to start the meeting...
        </div>
      </div>
    </>
  );
};

export default MeetingJoin;
