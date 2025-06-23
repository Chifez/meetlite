import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Users, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';

export default function MeetingCard({
  meeting,
  userId,
  onStart,
  onDelete,
}: {
  meeting: any;
  userId?: string;
  onStart: (meetingId: string) => void;
  onDelete: (meetingId: string) => void;
}) {
  const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-700',
    ongoing: 'bg-green-100 text-green-700',
    completed: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  return (
    <Card className="border-blue-100 shadow-sm hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 mb-2 capitalize">
            {meeting.privacy === 'private' ? (
              <Lock className="h-5 w-5 text-blue-600" />
            ) : (
              <Users className="h-5 w-5 text-blue-600" />
            )}
            {meeting.title}
          </CardTitle>
          <CardDescription>
            <span className="inline-block mr-2">
              <CalendarDays className="inline h-4 w-4 mr-1 text-blue-400" />
              {format(new Date(meeting.scheduledTime), 'PPpp')}
            </span>
            <span className="inline-block mr-2">{meeting.duration} min</span>
            <span
              className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                statusColors[meeting.status] || 'bg-gray-100 text-gray-700'
              }`}
            >
              {meeting.status}
            </span>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-gray-700 mb-2">{meeting.description}</div>
        {meeting.participants?.length > 0 && (
          <div className="text-xs text-gray-500 mt-2">
            Participants:{' '}
            {meeting.participants.map((p: string) => (
              <Badge key={p} variant="secondary" className="mr-1">
                {p}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2 flex-wrap">
        {meeting.status === 'scheduled' &&
          !meeting.roomId &&
          meeting.createdBy === userId && (
            <Button onClick={() => onStart(meeting.meetingId)}>
              Start Meeting
            </Button>
          )}
        <Button
          variant="destructive"
          onClick={() => onDelete(meeting.meetingId)}
          className="text-white"
        >
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}
