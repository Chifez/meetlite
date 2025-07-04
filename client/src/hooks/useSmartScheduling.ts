import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { env } from '@/config/env';
import { MeetingFormData } from '@/lib/types';
import { useCalendarIntegration } from './useCalendarIntegration';

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

interface AvailabilityCheck {
  isAvailable: boolean;
  conflicts: any[];
  alternatives: { start: Date; end: Date }[];
}

export const useSmartScheduling = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const { checkCalendarConflicts } = useCalendarIntegration();

  const parseNaturalLanguage = useCallback(
    async (input: string): Promise<ParsedMeetingData | null> => {
      setIsProcessing(true);
      setParsingError(null);

      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const response = await api.post(`${env.AI_SERVICE_URL}/parse-meeting`, {
          input,
          timezone,
        });

        if (response.data.success) {
          return response.data.data;
        } else {
          throw new Error(response.data.error || 'Failed to parse meeting');
        }
      } catch (error: any) {
        console.error('Natural language parsing error:', error);
        const errorMessage =
          error.response?.data?.error ||
          error.message ||
          'Failed to process your request';
        setParsingError(errorMessage);
        toast.error(errorMessage);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const checkAvailability = useCallback(
    async (parsedData: ParsedMeetingData): Promise<AvailabilityCheck> => {
      try {
        const startDate = new Date(`${parsedData.date}T${parsedData.time}`);
        const endDate = new Date(
          startDate.getTime() + parsedData.duration * 60 * 1000
        );

        const result = await checkCalendarConflicts(
          startDate,
          endDate,
          parsedData.participants
        );

        return {
          isAvailable: result.conflicts.length === 0,
          conflicts: result.conflicts,
          alternatives: result.availableSlots,
        };
      } catch (error) {
        console.error('Availability check error:', error);
        // Return available by default if check fails
        return {
          isAvailable: true,
          conflicts: [],
          alternatives: [],
        };
      }
    },
    [checkCalendarConflicts]
  );

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

  const suggestAlternatives = useCallback(
    (parsedData: ParsedMeetingData, conflicts: any[]): ParsedMeetingData[] => {
      const alternatives: ParsedMeetingData[] = [];
      const baseDate = new Date(`${parsedData.date}T${parsedData.time}`);

      // Suggest +30 minutes, +1 hour, +2 hours
      const timeOffsets = [30, 60, 120];

      timeOffsets.forEach((offsetMinutes) => {
        const newTime = new Date(
          baseDate.getTime() + offsetMinutes * 60 * 1000
        );

        alternatives.push({
          ...parsedData,
          date: newTime.toISOString().split('T')[0],
          time: newTime.toTimeString().slice(0, 5),
        });
      });

      return alternatives;
    },
    []
  );

  return {
    isProcessing,
    parsingError,
    setParsingError,
    parseNaturalLanguage,
    checkAvailability,
    populateFormData,
    suggestAlternatives,
  };
};
