import { useAuth } from './useAuth';
import { useCallback } from 'react';
import axios from 'axios';
import { env } from '@/config/env';
import { Meeting } from '@/lib/types';

export const useMeetings = () => {
  const { getAuthHeaders } = useAuth();

  const fetchMeetings = useCallback(async () => {
    const res = await axios.get<Meeting[]>(`${env.ROOM_API_URL}/meetings`, {
      headers: getAuthHeaders(),
    });
    return res.data;
  }, [getAuthHeaders]);

  const createMeeting = useCallback(
    async (data: Record<string, any>) => {
      const res = await axios.post<{ meetingId: string }>(
        `${env.ROOM_API_URL}/meetings`,
        data,
        { headers: getAuthHeaders() }
      );
      return res.data.meetingId;
    },
    [getAuthHeaders]
  );

  const getMeeting = useCallback(
    async (meetingId: string) => {
      const res = await axios.get<Meeting>(
        `${env.ROOM_API_URL}/meetings/${meetingId}`,
        {
          headers: getAuthHeaders(),
        }
      );
      return res.data;
    },
    [getAuthHeaders]
  );

  const updateMeeting = useCallback(
    async (meetingId: string, updates: Partial<Meeting>) => {
      const res = await axios.put<Meeting>(
        `${env.ROOM_API_URL}/meetings/${meetingId}`,
        updates,
        { headers: getAuthHeaders() }
      );
      return res.data;
    },
    [getAuthHeaders]
  );

  const deleteMeeting = useCallback(
    async (meetingId: string) => {
      await axios.delete(`${env.ROOM_API_URL}/meetings/${meetingId}`, {
        headers: getAuthHeaders(),
      });
    },
    [getAuthHeaders]
  );

  const startMeeting = useCallback(
    async (meetingId: string) => {
      const res = await axios.post<{ roomId: string }>(
        `${env.ROOM_API_URL}/meetings/${meetingId}/start`,
        {},
        { headers: getAuthHeaders() }
      );
      return res.data.roomId;
    },
    [getAuthHeaders]
  );

  return {
    fetchMeetings,
    createMeeting,
    getMeeting,
    updateMeeting,
    deleteMeeting,
    startMeeting,
  };
};
