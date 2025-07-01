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
  showImportModal: boolean;
  importLoading: boolean;
  importedEvents: any[];
  importError: string | null;

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

  // Modal actions
  openDeleteDialog: (meetingId: string) => void;
  closeDeleteDialog: () => void;
  setShowImportModal: (show: boolean) => void;
  setImportLoading: (loading: boolean) => void;
  setImportedEvents: (events: any[]) => void;
  setImportError: (error: string | null) => void;

  // Import actions
  importCalendarEvents: (
    calendarType: 'google' | 'outlook',
    startDate: Date,
    endDate: Date
  ) => Promise<void>;
}

export const useMeetingsStore = create<MeetingsState>((set, get) => ({
  // Initial state
  meetings: [],
  loading: false,
  view: 'list',
  deleteDialog: { open: false },
  showImportModal: false,
  importLoading: false,
  importedEvents: [],
  importError: null,

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
        set({ meetings: userMeetings });
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

  // Modal actions
  openDeleteDialog: (meetingId) =>
    set({ deleteDialog: { open: true, meetingId } }),
  closeDeleteDialog: () => set({ deleteDialog: { open: false } }),
  setShowImportModal: (show) => set({ showImportModal: show }),
  setImportLoading: (loading) => set({ importLoading: loading }),
  setImportedEvents: (events) => set({ importedEvents: events }),
  setImportError: (error) => set({ importError: error }),

  // Import actions
  importCalendarEvents: async (calendarType, startDate, endDate) => {
    set({ importLoading: true, importError: null, importedEvents: [] });

    try {
      const response = await api.get(`${env.CALENDAR_API_URL}/import`, {
        params: {
          type: calendarType,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      });

      const events = response.data;
      const taggedEvents = events.map((e: any) => ({
        ...e,
        source: calendarType,
      }));

      // Add imported events to meetings (avoiding duplicates)
      set((state) => {
        const all = [...state.meetings];
        taggedEvents.forEach((ev: any) => {
          if (
            !all.some(
              (m) => m.title === ev.title && m.scheduledTime === ev.start
            )
          ) {
            all.push({
              ...ev,
              scheduledTime: ev.start,
              duration:
                (new Date(ev.end).getTime() - new Date(ev.start).getTime()) /
                60000,
              meetingId: ev.id || `${ev.source}-${ev.id}`,
              participants: ev.attendees || [],
              privacy: 'public',
              status: 'scheduled',
            });
          }
        });
        return { meetings: all, importedEvents: taggedEvents };
      });
    } catch (error) {
      set({ importError: 'Failed to import events.' });
      console.error('Import error:', error);
    } finally {
      set({ importLoading: false });
    }
  },
}));
