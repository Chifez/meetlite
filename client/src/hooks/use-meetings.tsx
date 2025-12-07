import { useCallback } from 'react';
import api from '@/lib/axios';
import { Meeting } from '@/lib/types';
import { extractData } from '@/lib/api-response';

export const useMeetings = () => {
  const fetchMeetings = useCallback(async () => {
    const res = await api.get('/api/meetings');
    return extractData<Meeting[]>(res);
  }, []);

  const createMeeting = useCallback(async (data: Record<string, any>) => {
    const res = await api.post('/api/meetings', data);
    const result = extractData<{ meetingId: string }>(res);
    return result.meetingId;
  }, []);

  const getMeeting = useCallback(async (meetingId: string) => {
    const res = await api.get(`/api/meetings/${meetingId}`);
    return extractData<Meeting>(res);
  }, []);

  const updateMeeting = useCallback(
    async (meetingId: string, updates: Partial<Meeting>) => {
      const res = await api.put(`/api/meetings/${meetingId}`, updates);
      return extractData<Meeting>(res);
    },
    []
  );

  const deleteMeeting = useCallback(async (meetingId: string) => {
    await api.delete(`/api/meetings/${meetingId}`);
  }, []);

  const startMeeting = useCallback(async (meetingId: string) => {
    const res = await api.post(`/api/meetings/${meetingId}/start`, {});
    const result = extractData<{ roomId: string }>(res);
    return result.roomId;
  }, []);

  const completeMeeting = useCallback(async (meetingId: string) => {
    await api.post(`/api/meetings/${meetingId}/complete`, {});
  }, []);

  const validateInviteToken = useCallback(
    async (meetingId: string, token: string) => {
      const res = await api.post(`/api/meetings/${meetingId}/validate-token`, {
        token,
      });
      return extractData<{ valid: boolean; meeting: Meeting }>(res);
    },
    []
  );

  return {
    fetchMeetings,
    createMeeting,
    getMeeting,
    updateMeeting,
    deleteMeeting,
    startMeeting,
    completeMeeting,
    validateInviteToken,
  };
};
