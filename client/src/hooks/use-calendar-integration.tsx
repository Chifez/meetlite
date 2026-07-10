import { useCalendarContext } from '@/contexts/calendar-context';
import type { CalendarEvent, CalendarIntegration, CalendarContextType } from '@/contexts/calendar-context';

export type { CalendarEvent, CalendarIntegration };
export type UseCalendarIntegrationReturn = CalendarContextType;

export const useCalendarIntegration = (): UseCalendarIntegrationReturn => {
  return useCalendarContext();
};
