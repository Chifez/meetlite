import { useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMeetings } from '@/hooks/useMeetings';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Meeting } from '@/lib/types';

const POLL_INTERVAL = 5000;

export const useMeetingJoin = (meetingId: string | undefined) => {
  const [searchParams] = useSearchParams();
  const { getMeeting, validateInviteToken } = useMeetings();
  const { isAuthenticated, setRedirectTo } = useAuth();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout>();

  const fetchMeeting = useCallback(async () => {
    if (!meetingId) return;

    setLoading(true);
    const token = searchParams.get('token');

    try {
      // Handle private meetings with token
      if (token) {
        const validationResult = await validateInviteToken(meetingId, token);
        setMeeting(validationResult.meeting);

        if (validationResult.meeting?.roomId) {
          navigate(`/lobby/${validationResult.meeting.roomId}`);
          return;
        }
      } else {
        // Handle public meetings or authenticated users
        const data = await getMeeting(meetingId);
        setMeeting(data);

        if (data?.roomId) {
          navigate(`/lobby/${data.roomId}`);
          return;
        }
      }

      // Poll if no roomId
      if (meeting && !meeting.roomId) {
        intervalRef.current = setTimeout(fetchMeeting, POLL_INTERVAL);
      }
    } catch (error: any) {
      if (error.response?.status === 403) {
        if (!isAuthenticated) {
          const currentUrl = window.location.pathname + window.location.search;
          setRedirectTo(currentUrl);
          navigate('/login');
          return;
        } else {
          setAccessDenied(true);
          toast.error('This is a private meeting. You need an invite to join.');
        }
      } else {
        toast.error('Meeting not found');
      }
    } finally {
      setLoading(false);
    }
  }, [
    meetingId,
    searchParams,
    isAuthenticated,
    setRedirectTo,
    navigate,
    meeting,
    getMeeting,
    validateInviteToken,
  ]);

  const startPolling = useCallback(() => {
    fetchMeeting();
  }, [fetchMeeting]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
    }
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    stopPolling();
  }, [stopPolling]);

  return {
    meeting,
    loading,
    accessDenied,
    startPolling,
    stopPolling,
    cleanup,
  };
};
