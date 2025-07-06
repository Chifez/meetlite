import { create } from 'zustand';
import { Meeting } from '@/lib/types';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { env } from '@/config/env';

interface MeetingsState {
  // State
  meetings: Meeting[];
  loading: boolean;
  view: 'list' | 'calendar';

  // Modal states
  deleteDialog: {
    open: boolean;
    meetingId?: string;
  };

  // Actions
  setMeetings: (meetings: Meeting[]) => void;
  setLoading: (loading: boolean) => void;
  setView: (view: 'list' | 'calendar') => void;

  // Meeting actions
  fetchMeetings: (userId?: string) => Promise<void>;
  createMeeting: (meetingData: any) => Promise<string | null>;
  deleteMeeting: (meetingId: string) => Promise<void>;
  startMeeting: (meetingId: string) => Promise<string>;
  completeMeeting: (meetingId: string) => Promise<void>;
  refreshGoogleCalendarEvents: () => Promise<void>;

  // Modal actions
  openDeleteDialog: (meetingId: string) => void;
  closeDeleteDialog: () => void;
}

export const useMeetingsStore = create<MeetingsState>((set, get) => ({
  // Initial state
  meetings: [],
  loading: false,
  view: 'list',
  deleteDialog: { open: false },

  // State setters
  setMeetings: (meetings) => set({ meetings }),
  setLoading: (loading) => set({ loading }),
  setView: (view) => set({ view }),

  // Meeting actions
  fetchMeetings: async (userId) => {
    set({ loading: true });
    try {
      const response = await api.get(`${env.ROOM_API_URL}/meetings`);
      const data = response.data;

      // Filter meetings based on user permissions
      if (userId) {
        const now = new Date();
        const userMeetings = data.filter((meeting: Meeting) => {
          const meetingEnd = new Date(
            new Date(meeting.scheduledTime).getTime() +
              (meeting.duration || 0) * 60000
          );
          const isCreator = meeting.createdBy === userId;
          const isInvited =
            meeting.invites?.some((invite) => invite.email === userId) || false;

          // Show meetings where user is creator OR invited
          const hasAccess = isCreator || isInvited;

          // Show if:
          // 1. User has access (creator or invited) AND
          // 2. Meeting is ongoing or upcoming (not completed or cancelled)
          return (
            hasAccess &&
            meeting.status !== 'cancelled' &&
            meeting.status !== 'completed' &&
            meetingEnd > now
          );
        });

        // Check if user is connected to Google Calendar and fetch events
        try {
          const calendarResponse = await api.get(
            `${env.CALENDAR_API_URL}/api/calendar/connected`
          );
          const connectedCalendars = calendarResponse.data;
          const isGoogleConnected = connectedCalendars.some(
            (cal: any) => cal.type === 'google' && cal.isConnected
          );

          if (isGoogleConnected) {
            // Fetch Google Calendar events for the next 30 days
            const now = new Date();
            const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            const googleResponse = await api.post(
              `${env.CALENDAR_API_URL}/api/calendar/import`,
              {
                calendarType: 'google',
                startDate: now.toISOString(),
                endDate: in30.toISOString(),
              }
            );

            const googleEvents = googleResponse.data.map((event: any) => ({
              ...event,
              scheduledTime: event.start,
              duration: Math.round(
                (new Date(event.end).getTime() -
                  new Date(event.start).getTime()) /
                  60000
              ),
              meetingId: `google-${event.id}`,
              participants: event.attendees || [],
              privacy: 'public',
              status: 'scheduled',
              source: 'google',
              externalId: event.id,
              title: event.title,
              description: event.description || '',
            }));

            // Merge Google events with user meetings, avoiding duplicates
            const allMeetings = [...userMeetings];
            googleEvents.forEach((googleEvent: any) => {
              const isDuplicate = allMeetings.some(
                (meeting) =>
                  meeting.externalId === googleEvent.externalId ||
                  (meeting.title === googleEvent.title &&
                    meeting.scheduledTime === googleEvent.scheduledTime)
              );

              if (!isDuplicate) {
                allMeetings.push(googleEvent);
              }
            });

            set({ meetings: allMeetings });
          } else {
            set({ meetings: userMeetings });
          }
        } catch (calendarError) {
          console.error(
            'Failed to fetch Google Calendar events:',
            calendarError
          );
          set({ meetings: userMeetings });
        }
      } else {
        set({ meetings: data });
      }
    } catch (error) {
      toast.error('Failed to load meetings');
      console.error('Fetch meetings error:', error);
    } finally {
      set({ loading: false });
    }
  },

  createMeeting: async (meetingData) => {
    try {
      const response = await api.post(
        `${env.ROOM_API_URL}/meetings`,
        meetingData
      );
      const newMeeting = response.data;

      set((state) => ({
        meetings: [...state.meetings, newMeeting],
      }));

      toast.success('Meeting created successfully!');
      return newMeeting.meetingId;
    } catch (error) {
      toast.error('Failed to create meeting');
      console.error('Create meeting error:', error);
      return null;
    }
  },

  deleteMeeting: async (meetingId) => {
    try {
      await api.delete(`${env.ROOM_API_URL}/meetings/${meetingId}`);

      set((state) => ({
        meetings: state.meetings.filter(
          (meeting) => meeting.meetingId !== meetingId
        ),
      }));

      toast.success('Meeting deleted successfully');
    } catch (error) {
      toast.error('Failed to delete meeting');
      console.error('Delete meeting error:', error);
      throw error;
    }
  },

  startMeeting: async (meetingId) => {
    try {
      const response = await api.post(
        `${env.ROOM_API_URL}/meetings/${meetingId}/start`
      );
      const roomId = response.data.roomId;

      // Update meeting status to ongoing
      set((state) => ({
        meetings: state.meetings.map((meeting) =>
          meeting.meetingId === meetingId
            ? { ...meeting, status: 'ongoing', roomId }
            : meeting
        ),
      }));

      toast.success('Meeting started');
      return roomId;
    } catch (error) {
      console.error('Start meeting error:', error);
      throw error;
    }
  },

  completeMeeting: async (meetingId) => {
    try {
      await api.post(`${env.ROOM_API_URL}/meetings/${meetingId}/complete`);

      set((state) => ({
        meetings: state.meetings.map((meeting) =>
          meeting.meetingId === meetingId
            ? { ...meeting, status: 'completed' }
            : meeting
        ),
      }));

      toast.success('Meeting completed successfully');
    } catch (error) {
      toast.error('Failed to complete meeting');
      console.error('Complete meeting error:', error);
      throw error;
    }
  },

  refreshGoogleCalendarEvents: async () => {
    try {
      // Check if user is connected to Google Calendar
      const calendarResponse = await api.get(
        `${env.CALENDAR_API_URL}/api/calendar/connected`
      );
      const connectedCalendars = calendarResponse.data;
      const isGoogleConnected = connectedCalendars.some(
        (cal: any) => cal.type === 'google' && cal.isConnected
      );

      if (isGoogleConnected) {
        // Fetch latest Google Calendar events for the next 30 days
        const now = new Date();
        const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const googleResponse = await api.post(
          `${env.CALENDAR_API_URL}/api/calendar/import`,
          {
            calendarType: 'google',
            startDate: now.toISOString(),
            endDate: in30.toISOString(),
          }
        );

        const googleEvents = googleResponse.data.map((event: any) => ({
          ...event,
          scheduledTime: event.start,
          duration: Math.round(
            (new Date(event.end).getTime() - new Date(event.start).getTime()) /
              60000
          ),
          meetingId: `google-${event.id}`,
          participants: event.attendees || [],
          privacy: 'public',
          status: 'scheduled',
          source: 'google',
          externalId: event.id,
          title: event.title,
          description: event.description || '',
        }));

        // Get current meetings and merge with Google events
        const currentMeetings = get().meetings.filter(
          (m) => m.source !== 'google'
        );
        const allMeetings = [...currentMeetings];

        googleEvents.forEach((googleEvent: any) => {
          const isDuplicate = allMeetings.some(
            (meeting) =>
              meeting.externalId === googleEvent.externalId ||
              (meeting.title === googleEvent.title &&
                meeting.scheduledTime === googleEvent.scheduledTime)
          );

          if (!isDuplicate) {
            allMeetings.push(googleEvent);
          }
        });

        set({ meetings: allMeetings });
        toast.success('Google Calendar events refreshed successfully!');
      }
    } catch (error) {
      console.error('Failed to refresh Google Calendar events:', error);
      toast.error('Failed to refresh Google Calendar events');
    }
  },

  // Modal actions
  openDeleteDialog: (meetingId) =>
    set({ deleteDialog: { open: true, meetingId } }),
  closeDeleteDialog: () => set({ deleteDialog: { open: false } }),
}));
