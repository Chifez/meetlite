import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SEO from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, AlertCircle } from 'lucide-react';
import { useMeetingJoin } from '@/hooks/useMeetingJoin';

const MeetingJoin = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const { loading, meeting, accessDenied, startPolling, cleanup } =
    useMeetingJoin(meetingId);

  useEffect(() => {
    startPolling();
    return cleanup;
  }, [startPolling, cleanup]);

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
