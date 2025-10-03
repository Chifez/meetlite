import { useCallback } from 'react';
import api from '@/lib/axios';
import { env } from '@/config/env';
import { Meeting } from '@/lib/types';

export const useMeetings = () => {
  const fetchMeetings = useCallback(async () => {
    const res = await api.get<Meeting[]>(`${env.ROOM_API_URL}/meetings`);
    return res.data;
  }, []);

  const createMeeting = useCallback(async (data: Record<string, any>) => {
    const res = await api.post<{ meetingId: string }>(
      `${env.ROOM_API_URL}/meetings`,
      data
    );
    return res.data.meetingId;
  }, []);

  const getMeeting = useCallback(async (meetingId: string) => {
    const res = await api.get<Meeting>(
      `${env.ROOM_API_URL}/meetings/${meetingId}`
    );
    return res.data;
  }, []);

  const updateMeeting = useCallback(
    async (meetingId: string, updates: Partial<Meeting>) => {
      const res = await api.put<Meeting>(
        `${env.ROOM_API_URL}/meetings/${meetingId}`,
        updates
      );
      return res.data;
    },
    []
  );

  const deleteMeeting = useCallback(async (meetingId: string) => {
    await api.delete(`${env.ROOM_API_URL}/meetings/${meetingId}`);
  }, []);

  const startMeeting = useCallback(async (meetingId: string) => {
    const res = await api.post<{ roomId: string }>(
      `${env.ROOM_API_URL}/meetings/${meetingId}/start`,
      {}
    );
    return res.data.roomId;
  }, []);

  const completeMeeting = useCallback(async (meetingId: string) => {
    const res = await api.post<{ message: string }>(
      `${env.ROOM_API_URL}/meetings/${meetingId}/complete`,
      {}
    );
    return res.data;
  }, []);

  const validateInviteToken = useCallback(
    async (meetingId: string, token: string) => {
      const res = await api.post<{ valid: boolean; meeting: Meeting }>(
        `${env.ROOM_API_URL}/meetings/${meetingId}/validate-token`,
        { token }
      );
      return res.data;
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
