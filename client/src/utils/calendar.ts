/**
 * Calendar utility functions for creating calendar events
 */

export interface CalendarEvent {
  title: string;
  description: string;
  location?: string;
  startDate: Date;
  endDate: Date;
  timezone?: string;
}

/**
 * Generate Google Calendar URL
 */
export const generateGoogleCalendarUrl = (event: CalendarEvent): string => {
  const formatDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatDate(event.startDate)}/${formatDate(event.endDate)}`,
    details: event.description,
    ...(event.location && { location: event.location }),
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

/**
 * Generate Outlook Calendar URL
 */
export const generateOutlookCalendarUrl = (event: CalendarEvent): string => {
  const formatDate = (date: Date): string => {
    return date.toISOString();
  };

  const params = new URLSearchParams({
    subject: event.title,
    startdt: formatDate(event.startDate),
    enddt: formatDate(event.endDate),
    body: event.description,
    ...(event.location && { location: event.location }),
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
};

/**
 * Generate iCal file content
 */
export const generateICalContent = (event: CalendarEvent): string => {
  const formatDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const escapeText = (text: string): string => {
    return text.replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n');
  };

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MeetLite//Demo Scheduling//EN',
    'BEGIN:VEVENT',
    `DTSTART:${formatDate(event.startDate)}`,
    `DTEND:${formatDate(event.endDate)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
};

/**
 * Download iCal file
 */
export const downloadICalFile = (event: CalendarEvent): void => {
  const content = generateICalContent(event);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${event.title.replace(/[^a-z0-9]/gi, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

