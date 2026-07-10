import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { useAuth } from '@/hooks/use-auth';
import api from '@/lib/axios';
import { extractData } from '@/lib/api-response';
import { useMeetingsStore } from '@/stores';
import { toast } from 'sonner';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  attendees?: string[];
}

export interface CalendarIntegration {
  id: string;
  type: 'google';
  name: string;
  isConnected: boolean;
  lastSync?: Date;
}

export interface CalendarContextType {
  integrations: CalendarIntegration[];
  isLoading: boolean;
  showImportModal: boolean;
  setShowImportModal: (show: boolean) => void;
  importLoading: boolean;
  importedEvents: CalendarEvent[];
  importError: string | null;
  isPolling: boolean;
  isConnected: (calendarType: 'google') => boolean;
  getConnectedCalendars: () => Promise<CalendarIntegration[]>;
  connectGoogleCalendar: (onConnected?: () => void) => Promise<any>;
  importCalendarEvents: (
    calendarType: 'google',
    startDate: Date,
    endDate: Date
  ) => Promise<CalendarEvent[]>;
  exportMeetingToCalendar: (
    meetingId: string,
    calendarType: 'google'
  ) => Promise<boolean>;
  checkCalendarConflicts: (
    startDate: Date,
    endDate: Date,
    attendees: string[]
  ) => Promise<{
    conflicts: CalendarEvent[];
    availableSlots: { start: Date; end: Date }[];
  }>;
  disconnectCalendar: (calendarType: 'google') => Promise<boolean>;
  handleCalendarImport: (calendarType: 'google') => void;
  refreshConnectionStatus: () => Promise<void>;
  scheduleMeetingOnCalendar: (meetingData: {
    title: string;
    description?: string;
    startDate: Date;
    endDate: Date;
    participants: string[];
  }) => Promise<boolean>;
  deleteMeetingFromCalendar: (
    eventId: string,
    calendarType?: 'google'
  ) => Promise<boolean>;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export const CalendarProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importedEvents, setImportedEvents] = useState<CalendarEvent[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const { meetings, setMeetings } = useMeetingsStore();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isConnected = useCallback(
    (calendarType: 'google') => {
      return integrations.some(
        (integration) =>
          integration.type === calendarType && integration.isConnected
      );
    },
    [integrations]
  );

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
      setIsPolling(false);
    }
  }, []);

  const getConnectedCalendars = useCallback(async (): Promise<
    CalendarIntegration[]
  > => {
    try {
      const response = await api.get(`/api/calendar/connected`, {
        signal: abortControllerRef.current?.signal,
      });
      const data = extractData<CalendarIntegration[]>(response);
      setIntegrations(data);
      return data;
    } catch (error: any) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return [];
      }
      return [];
    }
  }, []);

  const connectGoogleCalendar = useCallback(
    async (onConnected?: () => void) => {
      try {
        setIsLoading(true);
        const response = await api.post(`/api/calendar/connect/google`, {});
        const data = extractData<{ authUrl?: string }>(response);
        if (data.authUrl) {
          window.open(data.authUrl, '_blank', 'width=500,height=600');
          setImportError(
            'Google OAuth window opened! Please complete the authorization in the new window. This page will update automatically once you are connected.'
          );
          setIsPolling(true);
          pollingRef.current = setInterval(async () => {
            const updated = await getConnectedCalendars();
            if (updated.some((i) => i.type === 'google' && i.isConnected)) {
              stopPolling();
              setImportError(null);
              if (onConnected) onConnected();
            }
          }, 2000);
        }
        return response.data;
      } catch (error) {
        console.error('Google Calendar connection error:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [getConnectedCalendars, stopPolling]
  );

  const importCalendarEvents = useCallback(
    async (
      calendarType: 'google',
      startDate: Date,
      endDate: Date
    ): Promise<CalendarEvent[]> => {
      try {
        setImportLoading(true);
        setImportError(null);
        setImportedEvents([]);

        const response = await api.post(`/api/calendar/import`, {
          calendarType,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        const events = extractData<any[]>(response);
        const taggedEvents = events.map((e: any) => ({
          ...e,
          source: calendarType,
        }));

        const allMeetings = [...meetings];
        taggedEvents.forEach((ev: any) => {
          if (
            !allMeetings.some(
              (m) => m.title === ev.title && m.scheduledTime === ev.start
            )
          ) {
            allMeetings.push({
              ...ev,
              scheduledTime: ev.start,
              duration:
                (new Date(ev.end).getTime() - new Date(ev.start).getTime()) /
                60000,
              meetingId: ev.id || `${ev.source}-${ev.id}`,
              participants: ev.attendees || [],
              privacy: 'public',
              status: 'scheduled',
              source: calendarType,
              externalId: ev.id,
            });
          }
        });

        setMeetings(allMeetings);
        setImportedEvents(taggedEvents);

        if (taggedEvents.length > 0) {
          toast.success(
            `Successfully imported ${taggedEvents.length} meetings from Google Calendar!`
          );
        }

        return taggedEvents;
      } catch (error) {
        console.error('Calendar import error:', error);
        setImportError('Failed to import events.');
        return [];
      } finally {
        setImportLoading(false);
      }
    },
    [meetings, setMeetings]
  );

  const exportMeetingToCalendar = useCallback(
    async (meetingId: string, calendarType: 'google'): Promise<boolean> => {
      try {
        const response = await api.post(`/api/calendar/export`, {
          meetingId,
          calendarType,
        });
        const data = extractData<{ success: boolean }>(response);
        return data.success;
      } catch (error) {
        console.error('Calendar export error:', error);
        return false;
      }
    },
    []
  );

  const checkCalendarConflicts = useCallback(
    async (
      startDate: Date,
      endDate: Date,
      attendees: string[]
    ): Promise<{
      conflicts: CalendarEvent[];
      availableSlots: { start: Date; end: Date }[];
    }> => {
      try {
        const response = await api.post(`/api/calendar/conflicts`, {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          attendees,
        });
        return response.data;
      } catch (error) {
        console.error('Calendar conflict check error:', error);
        return { conflicts: [], availableSlots: [] };
      }
    },
    []
  );

  const disconnectCalendar = useCallback(async (calendarType: 'google') => {
    try {
      const response = await api.post(`/api/calendar/disconnect`, {
        calendarType,
      });
      const data = extractData<{ success: boolean }>(response);
      if (data.success) {
        setIntegrations((prev) =>
          prev.filter((integration) => integration.type !== calendarType)
        );
      }
      return data.success;
    } catch (error) {
      console.error('Calendar disconnect error:', error);
      return false;
    }
  }, []);

  const handleCalendarImport = useCallback(
    async (calendarType: 'google') => {
      try {
        if (!isConnected(calendarType)) {
          await connectGoogleCalendar();
          return;
        }
        const now = new Date();
        const in30 = new Date();
        in30.setDate(now.getDate() + 30);
        await importCalendarEvents(calendarType, now, in30);
      } catch (error) {
        console.error('Calendar import error:', error);
        setImportError(
          `Failed to import from ${calendarType}. Please try again.`
        );
      }
    },
    [isConnected, connectGoogleCalendar, importCalendarEvents]
  );

  const refreshConnectionStatus = useCallback(async () => {
    try {
      await getConnectedCalendars();
    } catch (error) {
      console.error('Failed to refresh connection status:', error);
    }
  }, [getConnectedCalendars]);

  const scheduleMeetingOnCalendar = useCallback(
    async (meetingData: {
      title: string;
      description?: string;
      startDate: Date;
      endDate: Date;
      participants: string[];
    }): Promise<boolean> => {
      try {
        const response = await api.post(`/api/calendar/schedule`, {
          title: meetingData.title,
          description: meetingData.description || '',
          startDate: meetingData.startDate.toISOString(),
          endDate: meetingData.endDate.toISOString(),
          participants: meetingData.participants,
          calendarType: 'google',
        });

        const data = extractData<{ success: boolean }>(response);
        return data.success;
      } catch (error) {
        console.error('Calendar scheduling error:', error);
        return false;
      }
    },
    []
  );

  const deleteMeetingFromCalendar = useCallback(
    async (
      eventId: string,
      calendarType: 'google' = 'google'
    ): Promise<boolean> => {
      try {
        const response = await api.delete(`/api/calendar/events/${eventId}`, {
          data: { calendarType },
        });

        return response.data.success;
      } catch (error) {
        console.error('Calendar deletion error:', error);
        return false;
      }
    },
    []
  );

  const handleSetShowImportModal = useCallback((val: boolean) => setShowImportModal(val), []);

  useEffect(() => {
    abortControllerRef.current = new AbortController();
    if (isAuthenticated) {
      getConnectedCalendars();
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [isAuthenticated, getConnectedCalendars]);

  return (
    <CalendarContext.Provider
      value={{
        integrations,
        isLoading,
        showImportModal,
        setShowImportModal: handleSetShowImportModal,
        importLoading,
        importedEvents,
        importError,
        isPolling,
        isConnected,
        getConnectedCalendars,
        connectGoogleCalendar,
        importCalendarEvents,
        exportMeetingToCalendar,
        checkCalendarConflicts,
        disconnectCalendar,
        handleCalendarImport,
        refreshConnectionStatus,
        scheduleMeetingOnCalendar,
        deleteMeetingFromCalendar,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
};

export const useCalendarContext = () => {
  const context = useContext(CalendarContext);
  if (context === undefined) {
    throw new Error('useCalendarContext must be used within a CalendarProvider');
  }
  return context;
};
