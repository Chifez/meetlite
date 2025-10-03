import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SEO from '@/components/seo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, AlertCircle } from 'lucide-react';
import { useMeetingJoin } from '@/hooks/use-meeting-join';

const MeetingJoin = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const { loading, meeting, accessDenied, startPolling, cleanup } =
    useMeetingJoin(meetingId);

  useEffect(() => {
    startPolling();
    return cleanup;
  }, [startPolling, cleanup]);

  if (loading)
    return (
      <div className="min-h-screen bg-background pt-20 md:pt-24 flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm text-muted-foreground">
            Loading meeting...
          </div>
        </div>
      </div>
    );

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-background pt-20 md:pt-24">
        <div className="container mx-auto px-4 py-6 max-w-xl">
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <div className="flex items-center justify-center gap-2 text-red-600 mb-2">
                <Lock className="h-5 w-5" />
                <CardTitle className="text-lg font-semibold text-red-800">
                  Access Denied
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-2 text-red-600 mb-4">
                <AlertCircle className="h-4 w-4" />
                <p className="text-sm text-red-700">
                  This is a private meeting. You need a valid invite link to
                  join.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="mt-4"
              >
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!meeting)
    return (
      <div className="min-h-screen bg-background pt-20 md:pt-24 flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm text-muted-foreground">
            Meeting not found.
          </div>
        </div>
      </div>
    );

  return (
    <>
      <SEO title={meeting.title} />
      <div className="min-h-screen bg-background pt-20 md:pt-24">
        <div className="container mx-auto px-4 py-6 max-w-xl text-center">
          <h1 className="text-xl font-semibold text-foreground mb-2">
            {meeting.title}
          </h1>
          <p className="text-sm text-muted-foreground mb-4">
            {meeting.description}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            <strong>Scheduled:</strong>{' '}
            {new Date(meeting.scheduledTime).toLocaleString()}
            <br />
            <strong>Duration:</strong> {meeting.duration} min
          </p>
          {meeting.privacy === 'private' && (
            <div className="mb-4 flex items-center justify-center gap-2 text-blue-600">
              <Lock className="h-4 w-4" />
              <span className="text-xs">Private Meeting</span>
            </div>
          )}
          <div className="mt-8 text-sm font-semibold text-blue-600">
            Waiting for the host to start the meeting...
          </div>
        </div>
      </div>
    </>
  );
};

export default MeetingJoin;
