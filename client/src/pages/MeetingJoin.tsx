import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMeetings, Meeting } from '@/hooks/useMeetings';
import { toast } from 'sonner';
import SEO from '@/components/SEO';

const POLL_INTERVAL = 5000;

const MeetingJoin = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const { getMeeting } = useMeetings();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const fetchMeeting = async () => {
      setLoading(true);
      try {
        if (!meetingId) return;
        const data = await getMeeting(meetingId);
        setMeeting(data);
        if (data.roomId) {
          navigate(`/lobby/${data.roomId}`);
        } else {
          // Poll until roomId is available
          interval = setTimeout(fetchMeeting, POLL_INTERVAL);
        }
      } catch (e) {
        toast.error('Meeting not found');
      } finally {
        setLoading(false);
      }
    };
    fetchMeeting();
    return () => {
      if (interval) clearTimeout(interval);
    };
    // eslint-disable-next-line
  }, [meetingId]);

  if (loading) return <div className="p-8 text-center">Loading meeting...</div>;
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
        <div className="mt-8 text-lg font-semibold text-blue-600">
          Waiting for the host to start the meeting...
        </div>
      </div>
    </>
  );
};

export default MeetingJoin;
