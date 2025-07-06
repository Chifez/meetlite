import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import { env } from '@/config/env';
import { useMeetingsStore } from '@/stores';
import { toast } from 'sonner';

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  attendees?: string[];
}

interface CalendarIntegration {
  id: string;
  type: 'google';
  name: string;
  isConnected: boolean;
  lastSync?: Date;
}

export const useCalendarIntegration = () => {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importedEvents, setImportedEvents] = useState<CalendarEvent[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const { meetings, setMeetings } = useMeetingsStore();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Load connected calendars on mount
  useEffect(() => {
    if (user?.id) {
      getConnectedCalendars();
    }
  }, [user?.id]);

  // Check if user is connected to a specific calendar
  const isConnected = useCallback(
    (calendarType: 'google') => {
      return integrations.some(
        (integration) =>
          integration.type === calendarType && integration.isConnected
      );
    },
    [integrations]
  );

  // Helper to stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
      setIsPolling(false);
    }
  }, []);

  // Get connected calendars
  const getConnectedCalendars = useCallback(async (): Promise<
    CalendarIntegration[]
  > => {
    try {
      const response = await api.get(
        `${env.CALENDAR_API_URL}/api/calendar/connected`
      );
      setIntegrations(response.data);
      return response.data;
    } catch (error) {
      console.error('Get connected calendars error:', error);
      return [];
    }
  }, []);

  // Enhanced connectGoogleCalendar with polling
  const connectGoogleCalendar = useCallback(
    async (onConnected?: () => void) => {
      try {
        setIsLoading(true);
        const response = await api.post(
          `${env.CALENDAR_API_URL}/api/calendar/connect/google`,
          {}
        );
        if (response.data.authUrl) {
          window.open(response.data.authUrl, '_blank', 'width=500,height=600');
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

  // Import calendar events
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

        console.log('url', env.CALENDAR_API_URL);
        const response = await api.post(
          `${env.CALENDAR_API_URL}/api/calendar/import`,
          {
            calendarType,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          }
        );

        const events = response.data;
        const taggedEvents = events.map((e: any) => ({
          ...e,
          source: calendarType,
        }));

        // Convert to meeting format and add to local store (avoiding duplicates)
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
              externalId: ev.id, // Store original calendar event ID
            });
          }
        });

        setMeetings(allMeetings);
        setImportedEvents(taggedEvents);

        // Show success message
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

  // Export meeting to external calendar
  const exportMeetingToCalendar = useCallback(
    async (meetingId: string, calendarType: 'google'): Promise<boolean> => {
      try {
        const response = await api.post(
          `${env.CALENDAR_API_URL}/api/calendar/export`,
          {
            meetingId,
            calendarType,
          }
        );

        return response.data.success;
      } catch (error) {
        console.error('Calendar export error:', error);
        return false;
      }
    },
    []
  );

  // Check for calendar conflicts
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
        const response = await api.post(
          `${env.CALENDAR_API_URL}/api/calendar/conflicts`,
          {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            attendees,
          }
        );

        return response.data;
      } catch (error) {
        console.error('Calendar conflict check error:', error);
        return { conflicts: [], availableSlots: [] };
      }
    },
    []
  );

  // Disconnect calendar
  const disconnectCalendar = useCallback(async (calendarType: 'google') => {
    try {
      const response = await api.post(
        `${env.CALENDAR_API_URL}/api/calendar/disconnect`,
        {
          calendarType,
        }
      );

      if (response.data.success) {
        setIntegrations((prev) =>
          prev.filter((integration) => integration.type !== calendarType)
        );
      }

      return response.data.success;
    } catch (error) {
      console.error('Calendar disconnect error:', error);
      return false;
    }
  }, []);

  // Handle calendar import with connection check
  const handleCalendarImport = useCallback(
    async (calendarType: 'google') => {
      try {
        // Check if connected first
        if (!isConnected(calendarType)) {
          // If not connected, try to connect first
          await connectGoogleCalendar();
          // Don't try to import immediately - user needs to complete OAuth first
          return;
        }

        // Now import events
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

  // Manual refresh connection status (useful after OAuth completion)
  const refreshConnectionStatus = useCallback(async () => {
    try {
      await getConnectedCalendars();
    } catch (error) {
      console.error('Failed to refresh connection status:', error);
    }
  }, [getConnectedCalendars]);

  // When modal closes, stop polling
  useEffect(() => {
    if (!showImportModal) {
      stopPolling();
    }
  }, [showImportModal, stopPolling]);

  return {
    integrations,
    isLoading,
    showImportModal,
    setShowImportModal,
    importLoading,
    importedEvents,
    importError,
    isConnected,
    handleCalendarImport,
    refreshConnectionStatus,
    connectGoogleCalendar,
    importCalendarEvents,
    exportMeetingToCalendar,
    checkCalendarConflicts,
    getConnectedCalendars,
    disconnectCalendar,
    isPolling,
    stopPolling,
  };
};
