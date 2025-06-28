import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';

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
  type: 'google' | 'outlook' | 'ical';
  name: string;
  isConnected: boolean;
  lastSync?: Date;
}

export const useCalendarIntegration = () => {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Connect Google Calendar
  const connectGoogleCalendar = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.post('/api/calendar/connect/google', {
        userId: user?.id,
      });

      if (response.data.success) {
        setIntegrations((prev) => [
          ...prev,
          {
            id: 'google',
            type: 'google',
            name: 'Google Calendar',
            isConnected: true,
            lastSync: new Date(),
          },
        ]);
      }

      return response.data;
    } catch (error) {
      console.error('Google Calendar connection error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Connect Outlook Calendar
  const connectOutlookCalendar = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.post('/api/calendar/connect/outlook', {
        userId: user?.id,
      });

      if (response.data.success) {
        setIntegrations((prev) => [
          ...prev,
          {
            id: 'outlook',
            type: 'outlook',
            name: 'Outlook Calendar',
            isConnected: true,
            lastSync: new Date(),
          },
        ]);
      }

      return response.data;
    } catch (error) {
      console.error('Outlook Calendar connection error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Import calendar events
  const importCalendarEvents = useCallback(
    async (
      calendarType: 'google' | 'outlook' | 'ical',
      startDate: Date,
      endDate: Date
    ): Promise<CalendarEvent[]> => {
      try {
        const response = await api.post('/api/calendar/import', {
          calendarType,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        return response.data;
      } catch (error) {
        console.error('Calendar import error:', error);
        return [];
      }
    },
    []
  );

  // Export meeting to external calendar
  const exportMeetingToCalendar = useCallback(
    async (
      meetingId: string,
      calendarType: 'google' | 'outlook' | 'ical'
    ): Promise<boolean> => {
      try {
        const response = await api.post('/api/calendar/export', {
          meetingId,
          calendarType,
        });

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
        const response = await api.post('/api/calendar/conflicts', {
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

  // Get connected calendars
  const getConnectedCalendars = useCallback(async (): Promise<
    CalendarIntegration[]
  > => {
    try {
      const response = await api.get('/api/calendar/connected');
      setIntegrations(response.data);
      return response.data;
    } catch (error) {
      console.error('Get connected calendars error:', error);
      return [];
    }
  }, []);

  // Disconnect calendar
  const disconnectCalendar = useCallback(
    async (calendarType: 'google' | 'outlook') => {
      try {
        const response = await api.post('/api/calendar/disconnect', {
          calendarType,
        });

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
    },
    []
  );

  // Generate iCal file
  const generateICalFile = useCallback(
    async (meetingData: {
      title: string;
      description: string;
      startTime: string;
      endTime: string;
      attendees: string[];
    }): Promise<string> => {
      try {
        const response = await api.post('/api/calendar/ical', meetingData);
        return response.data.icalContent;
      } catch (error) {
        console.error('iCal generation error:', error);
        return '';
      }
    },
    []
  );

  return {
    integrations,
    isLoading,
    connectGoogleCalendar,
    connectOutlookCalendar,
    importCalendarEvents,
    exportMeetingToCalendar,
    checkCalendarConflicts,
    getConnectedCalendars,
    disconnectCalendar,
    generateICalFile,
  };
};
