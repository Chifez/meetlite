import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { env } from '@/config/env';
import { MeetingFormData } from '@/lib/types';
import { useCalendarIntegration } from './useCalendarIntegration';
import {
  SMART_SCHEDULING_CONFIG,
  ALTERNATIVE_OFFSETS,
  MAX_ALTERNATIVES,
} from '@/config/smartScheduling';

interface ParsedMeetingData {
  title: string;
  date: string;
  time: string;
  timezone: string;
  privacy: 'public' | 'private';
  description?: string;
  participants: string[];
  duration: number;
  confidence: number;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  source: 'calendar' | 'database';
}

interface ConflictCheckResult {
  isAvailable: boolean;
  conflicts: CalendarEvent[];
  alternatives: AlternativeSlot[];
  calendarConnected: boolean;
  internalMeetings: number;
}

interface AlternativeSlot {
  date: string;
  time: string;
  start: Date;
  end: Date;
  available: boolean;
  reason?: string;
  source?: 'calendar' | 'generated';
}

interface SmartSchedulingState {
  isProcessing: boolean;
  error: string | null;
  result: ConflictCheckResult | null;
}

export const useEnhancedSmartScheduling = () => {
  const [state, setState] = useState<SmartSchedulingState>({
    isProcessing: false,
    error: null,
    result: null,
  });

  const {
    checkCalendarConflicts,
    isConnected,
    integrations,
    getConnectedCalendars,
  } = useCalendarIntegration();

  /**
   * Enhanced smart scheduling with conflict checking
   */
  const smartSchedule = useCallback(
    async (
      input: string
    ): Promise<{
      parsedData: ParsedMeetingData | null;
      conflictCheck: ConflictCheckResult | null;
    }> => {
      setState((prev) => ({
        ...prev,
        isProcessing: true,
        error: null,
        result: null,
      }));

      try {
        // Step 1: Parse the meeting using existing endpoint
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const parseResponse = await api.post(
          `${env.AI_SERVICE_URL}/parse-meeting`,
          {
            input,
            timezone,
          }
        );

        if (!parseResponse.data.success) {
          throw new Error(
            parseResponse.data.error || 'Failed to parse meeting'
          );
        }

        const parsedData: ParsedMeetingData = parseResponse.data.data;

        // Step 2: Check for conflicts
        const conflictCheck = await checkConflicts(parsedData);

        setState((prev) => ({
          ...prev,
          isProcessing: false,
          result: conflictCheck,
        }));

        return { parsedData, conflictCheck };
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.error ||
          error.message ||
          'Smart scheduling failed';

        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: errorMessage,
        }));

        toast.error('Smart Scheduling Failed', {
          description: errorMessage,
        });

        return { parsedData: null, conflictCheck: null };
      }
    },
    [checkCalendarConflicts]
  );

  /**
   * Check for conflicts with calendar and internal meetings
   */
  const checkConflicts = useCallback(
    async (parsedData: ParsedMeetingData): Promise<ConflictCheckResult> => {
      try {
        const startDate = new Date(`${parsedData.date}T${parsedData.time}`);
        const endDate = new Date(
          startDate.getTime() + parsedData.duration * 60 * 1000
        );

        // Manually refresh calendar connection status to ensure we have latest state
        const connectedCalendars = await getConnectedCalendars();

        // Check if calendar is connected using the returned data directly
        const calendarConnected = connectedCalendars.some(
          (integration) =>
            integration.type === 'google' && integration.isConnected
        );

        let conflicts: CalendarEvent[] = [];
        let alternatives: AlternativeSlot[] = [];

        if (calendarConnected) {
          // Check calendar conflicts
          try {
            const calendarResult = await checkCalendarConflicts(
              startDate,
              endDate,
              parsedData.participants
            );

            conflicts = calendarResult.conflicts.map((event) => ({
              id: event.id,
              title: event.title,
              start: new Date(event.start),
              end: new Date(event.end),
              source: 'calendar' as const,
            }));

            // Convert available slots to alternatives
            alternatives = calendarResult.availableSlots
              .map((slot): AlternativeSlot | null => {
                try {
                  // Ensure start and end are Date objects
                  const startDate =
                    slot.start instanceof Date
                      ? slot.start
                      : new Date(slot.start);
                  const endDate =
                    slot.end instanceof Date ? slot.end : new Date(slot.end);

                  return {
                    date: startDate.toISOString().split('T')[0],
                    time: startDate.toTimeString().slice(0, 5),
                    start: startDate,
                    end: endDate,
                    available: true,
                    source: 'calendar',
                    reason: 'Calendar suggestion',
                  };
                } catch (slotError) {
                  console.error('❌ Error processing slot:', slot, slotError);
                  return null;
                }
              })
              .filter((slot): slot is AlternativeSlot => slot !== null); // Type-safe filter
          } catch (calendarError) {
            // Continue with internal meetings check
          }
        } else {
          // Continue with internal meetings check
        }

        // Check internal meetings (database)
        const internalConflicts = await checkInternalMeetings(
          startDate,
          endDate
        );
        conflicts = [...conflicts, ...internalConflicts];

        // Generate alternatives based on ALL conflicts (both calendar and internal)
        if (conflicts.length > 0) {
          const allAlternatives = generateAlternatives(
            startDate,
            parsedData.duration,
            conflicts
          );

          // If we have calendar alternatives, merge them with generated ones
          if (alternatives.length > 0) {
            const calendarAlternatives = alternatives.map((slot) => ({
              ...slot,
              reason: slot.reason || 'Calendar suggestion',
            }));

            // Combine and deduplicate alternatives
            const combinedAlternatives = [
              ...calendarAlternatives,
              ...allAlternatives,
            ];
            alternatives = combinedAlternatives
              .filter(
                (slot, index, arr) =>
                  arr.findIndex(
                    (s) => s.date === slot.date && s.time === slot.time
                  ) === index
              )
              .slice(0, MAX_ALTERNATIVES); // Use constant instead of hardcoded 5
          } else {
            // No calendar alternatives, use generated ones
            alternatives = allAlternatives;
          }
        }

        const result: ConflictCheckResult = {
          isAvailable: conflicts.length === 0,
          conflicts,
          alternatives,
          calendarConnected,
          internalMeetings: conflicts.filter((c) => c.source === 'database')
            .length,
        };

        return result;
      } catch (error) {
        // Return available by default if check fails
        return {
          isAvailable: true,
          conflicts: [],
          alternatives: [],
          calendarConnected: false,
          internalMeetings: 0,
        };
      }
    },
    [checkCalendarConflicts, isConnected, integrations, getConnectedCalendars]
  );

  /**
   * Check for conflicts with internal meetings
   */
  const checkInternalMeetings = useCallback(
    async (startDate: Date, endDate: Date): Promise<CalendarEvent[]> => {
      try {
        const response = await api.get(`${env.ROOM_API_URL}/meetings`);
        const meetings = response.data;

        const conflicts: CalendarEvent[] = [];

        meetings.forEach((meeting: any) => {
          const meetingStart = new Date(meeting.scheduledTime);
          const meetingEnd = new Date(
            meetingStart.getTime() + (meeting.duration || 30) * 60 * 1000
          );

          // Check for overlap
          const hasConflict =
            (startDate < meetingEnd && endDate > meetingStart) ||
            (meetingStart < endDate && meetingEnd > startDate);

          if (
            hasConflict &&
            meeting.status !== 'cancelled' &&
            meeting.status !== 'completed'
          ) {
            conflicts.push({
              id: meeting.meetingId,
              title: meeting.title,
              start: meetingStart,
              end: meetingEnd,
              source: 'database',
            });
          }
        });

        return conflicts;
      } catch (error) {
        console.error('❌ Failed to check internal meetings:', error);
        return [];
      }
    },
    []
  );

  /**
   * Generate alternative time slots
   */
  const generateAlternatives = useCallback(
    (
      originalStart: Date,
      duration: number,
      existingConflicts: CalendarEvent[] = []
    ): AlternativeSlot[] => {
      const alternatives: AlternativeSlot[] = [];
      const baseDate = new Date(originalStart);

      // Find the latest end time among all conflicts
      const latestConflictEnd =
        existingConflicts.length > 0
          ? Math.max(
              ...existingConflicts.map((conflict) =>
                new Date(conflict.end).getTime()
              )
            )
          : baseDate.getTime();

      // Start alternatives from the latest conflict end time
      const startFromTime = Math.max(baseDate.getTime(), latestConflictEnd);

      // Generate alternatives using configured offsets from the conflict-free start time
      const timeOffsets = [
        ALTERNATIVE_OFFSETS.SHORT,
        ALTERNATIVE_OFFSETS.MEDIUM,
        ALTERNATIVE_OFFSETS.LONG,
        ALTERNATIVE_OFFSETS.NEXT_DAY,
      ];

      timeOffsets.forEach((offsetMinutes) => {
        const newTime = new Date(startFromTime + offsetMinutes * 60 * 1000);
        const newEnd = new Date(newTime.getTime() + duration * 60 * 1000);

        // Check if this time conflicts with existing conflicts
        const hasConflict = existingConflicts.some((conflict) => {
          const conflictStart = new Date(conflict.start);
          const conflictEnd = new Date(conflict.end);
          return (
            (newTime < conflictEnd && newEnd > conflictStart) ||
            (conflictStart < newEnd && conflictEnd > newTime)
          );
        });

        // Only add if it's within business hours and doesn't conflict
        const hour = newTime.getHours();
        if (SMART_SCHEDULING_CONFIG.isBusinessHours(hour) && !hasConflict) {
          alternatives.push({
            date: newTime.toISOString().split('T')[0],
            time: newTime.toTimeString().slice(0, 5),
            start: newTime,
            end: newEnd,
            available: true,
            reason: SMART_SCHEDULING_CONFIG.getOffsetDescription(offsetMinutes),
            source: 'generated',
          });
        }
      });

      return alternatives.slice(0, MAX_ALTERNATIVES);
    },
    []
  );

  /**
   * Populate form data from parsed meeting
   */
  const populateFormData = useCallback(
    (parsedData: ParsedMeetingData): Partial<MeetingFormData> => {
      const date = new Date(`${parsedData.date}T${parsedData.time}`);

      return {
        title: parsedData.title,
        description: parsedData.description || '',
        date: date,
        time: parsedData.time,
        duration: parsedData.duration,
        privacy: parsedData.privacy,
        participants: parsedData.participants,
        participantInput: '',
      };
    },
    []
  );

  /**
   * Clear the current result
   */
  const clearResult = useCallback(() => {
    setState((prev) => ({
      ...prev,
      result: null,
      error: null,
    }));
  }, []);

  return {
    ...state,
    smartSchedule,
    populateFormData,
    clearResult,
  };
};
