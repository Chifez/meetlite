import { useMemo, useState, useEffect } from 'react';
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  Views,
  type View,
} from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, isToday, isAfter } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './MeetingCalendar.css';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Lock, Users, CalendarDays } from 'lucide-react';

function CustomToolbar({ label, onNavigate, onView, view }: any) {
  return (
    <div className="flex items-center justify-between p-6 pb-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 md:gap-3">
        <Button size="sm" variant="outline" onClick={() => onNavigate('PREV')}>
          ←
        </Button>
        <Button size="sm" variant="outline" onClick={() => onNavigate('TODAY')}>
          Today
        </Button>
        <Button size="sm" variant="outline" onClick={() => onNavigate('NEXT')}>
          →
        </Button>
      </div>
      <h2 className="text-base md:text-xl font-semibold text-gray-900 dark:text-gray-100">
        {label}
      </h2>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={view === 'week' ? 'default' : 'outline'}
          onClick={() => onView('week')}
          className="hidden md:block"
        >
          Week
        </Button>
        <Button
          size="sm"
          variant={view === 'day' ? 'default' : 'outline'}
          onClick={() => onView('day')}
          className="hidden md:block"
        >
          Day
        </Button>
      </div>
    </div>
  );
}

export default function MeetingCalendar({
  meetings,
}: {
  meetings: any[];
  onEventClick: (event: any) => void;
}) {
  const locales = { 'en-US': enUS };
  const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
    getDay,
    locales,
  });
  const events = useMemo(
    () =>
      meetings.map((meeting) => ({
        id: meeting.meetingId,
        title: meeting.title,
        start: new Date(meeting.scheduledTime),
        end: new Date(
          new Date(meeting.scheduledTime).getTime() + meeting.duration * 60000
        ),
        allDay: false,
        resource: meeting,
      })),
    [meetings]
  );

  // Responsive view mode
  const [calendarView, setCalendarView] = useState<View>(Views.WEEK);
  useEffect(() => {
    const checkView = () => {
      if (window.matchMedia('(max-width: 768px)').matches) {
        setCalendarView(Views.DAY);
      } else {
        setCalendarView(Views.WEEK);
      }
    };
    checkView();
    window.addEventListener('resize', checkView);
    return () => window.removeEventListener('resize', checkView);
  }, []);

  // Dialog state for event details
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  // Custom day/column styling for highlight
  function customDayPropGetter(date: Date) {
    if (isToday(date)) {
      return {
        style: {
          backgroundColor: 'var(--today-highlight, rgba(99, 102, 241, 0.08))',
        },
      };
    }
    return {};
  }

  return (
    <div>
      <BigCalendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        defaultView={Views.WEEK}
        view={calendarView}
        views={{ week: true, day: true }}
        style={{ height: '70vh', minHeight: 500 }}
        popup
        components={{
          toolbar: (props) => (
            <CustomToolbar
              {...props}
              view={calendarView}
              onView={setCalendarView}
            />
          ),
        }}
        eventPropGetter={(event) => ({
          style: {
            backgroundColor:
              event.resource.privacy === 'private' ? '#2563eb' : '#22c55e',
            color: 'white',
            borderRadius: '6px',
            border: 'none',
            padding: '4px 8px',
            fontWeight: 500,
            fontSize: '0.95rem',
            boxShadow: '0 2px 8px 0 rgba(0,0,0,0.04)',
          },
          'data-privacy': event.resource.privacy,
        })}
        dayPropGetter={customDayPropGetter}
        onSelectEvent={(event) => setSelectedEvent(event)}
      />
      {/* Event Details Dialog */}
      <Dialog
        open={!!selectedEvent}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
      >
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 mb-2 capitalize">
              {selectedEvent?.resource?.privacy === 'private' ? (
                <Lock className="h-5 w-5 text-blue-600" />
              ) : (
                <Users className="h-5 w-5 text-blue-600" />
              )}
              {selectedEvent?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="mb-2 text-gray-700">
            {selectedEvent?.resource?.description}
          </div>
          <div className="mb-2 text-sm text-gray-500 flex items-center gap-2">
            <CalendarDays className="inline h-4 w-4 mr-1 text-blue-400" />
            {selectedEvent?.start
              ? format(selectedEvent.start, 'MMM,dd yyyy hh:mm a')
              : ''}
            {''} &bull; {selectedEvent?.resource?.duration} min
            <Badge variant="secondary" className="ml-2 capitalize">
              {selectedEvent?.resource?.privacy}
            </Badge>
            <Badge className="ml-2 capitalize">
              {(() => {
                const end = selectedEvent?.end;
                if (end && isAfter(new Date(), end)) return 'Completed';
                return selectedEvent?.resource?.status == 'scheduled'
                  ? 'Upcoming'
                  : 'Ongoing';
              })()}
            </Badge>
            {selectedEvent?.resource?.source === 'google' && (
              <span className="ml-2 px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-xs font-medium border border-blue-100">
                Google
              </span>
            )}
          </div>
          {selectedEvent?.resource?.participants?.length > 0 && (
            <div className="text-xs text-gray-500 mt-2">
              Participants:{' '}
              {selectedEvent.resource.participants.map((p: string) => (
                <Badge key={p} variant="secondary" className="mr-1">
                  {p}
                </Badge>
              ))}
            </div>
          )}
          <DialogFooter className="mt-4">
            {/* Example: Add join or delete actions here if needed */}
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
