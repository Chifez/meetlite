import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Meeting } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useMeetingsStore } from '@/stores/meetings-store';
import { primaryMeetingAction, PrimaryAction } from './meeting-view-state';

export function useMeetingController() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { startMeeting, completeMeeting, openDeleteDialog } = useMeetingsStore();
  const [detailsMeeting, setDetailsMeeting] = useState<Meeting | null>(null);

  const openDetails = useCallback((meeting: Meeting) => {
    setDetailsMeeting(meeting);
  }, []);

  const closeDetails = useCallback(() => {
    setDetailsMeeting(null);
  }, []);

  const handleCopyLink = useCallback((meeting: Meeting) => {
    const url = `${window.location.origin}/lobby/${meeting.roomId || meeting.meetingId}`;
    navigator.clipboard.writeText(url);
    toast.success('Meeting link copied to clipboard');
  }, []);

  const handleDelete = useCallback((meeting: Meeting) => {
    if (meeting.source === 'google' && meeting.externalId) {
      openDeleteDialog(meeting.meetingId, {
        isGoogleCalendar: true,
        externalId: meeting.externalId,
      });
    } else {
      openDeleteDialog(meeting.meetingId);
    }
  }, [openDeleteDialog]);

  const handleEndMeeting = useCallback(async (meeting: Meeting) => {
    try {
      await completeMeeting(meeting.meetingId);
      toast.success('Meeting ended');
    } catch (e) {
      toast.error('Failed to end meeting');
    }
  }, [completeMeeting]);

  const handleAction = useCallback(async (meeting: Meeting, explicitAction?: PrimaryAction) => {
    const action = explicitAction || primaryMeetingAction(meeting, { currentUserId: user?.id });

    switch (action.kind) {
      case 'start': {
        try {
          const roomId = await startMeeting(meeting.meetingId);
          navigate(`/lobby/${roomId}`);
        } catch (err: any) {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to start meeting');
        }
        break;
      }

      case 'join': {
        const target = meeting.roomId || meeting.meetingId;
        navigate(`/lobby/${target}`);
        break;
      }

      case 'details': {
        // Strict invariant: 'details' MUST ONLY open dialog and NEVER start a meeting!
        setDetailsMeeting(meeting);
        break;
      }

      case 'disabled': {
        if (action.reason === 'WAITING_FOR_HOST') {
          toast.info('Meeting has not started yet', {
            description: 'The host has not started this meeting yet. You will be able to join as soon as they start.',
          });
        } else if (action.reason === 'TOO_EARLY') {
          toast.info('Meeting not yet open', {
            description: 'You can join up to 15 minutes before the scheduled time.',
          });
        }
        break;
      }

      case 'recap': {
        navigate(`/recordings?meetingId=${meeting.meetingId}`);
        break;
      }

      case 'none':
        break;
    }
  }, [navigate, openDetails, startMeeting, user?.id]);

  return {
    handleAction,
    openDetails,
    closeDetails,
    detailsMeeting,
    handleCopyLink,
    handleDelete,
    handleEndMeeting,
  };
}
