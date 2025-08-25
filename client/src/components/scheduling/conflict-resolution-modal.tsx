import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  source: 'calendar' | 'database';
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

interface ConflictCheckResult {
  isAvailable: boolean;
  conflicts: CalendarEvent[];
  alternatives: AlternativeSlot[];
  calendarConnected: boolean;
  internalMeetings: number;
}

interface ConflictResolutionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflictCheck: ConflictCheckResult;
  originalMeeting: {
    title: string;
    date: string;
    time: string;
    duration: number;
  };
  onSelectAlternative: (slot: AlternativeSlot) => void;
  onScheduleOnCalendar?: (slot: AlternativeSlot) => void;
  onProceedAnyway: () => void;
  onCancel: () => void;
}

export default function ConflictResolutionModal({
  open,
  onOpenChange,
  conflictCheck,
  originalMeeting,
  onSelectAlternative,
  onScheduleOnCalendar,
  onProceedAnyway,
  onCancel,
}: ConflictResolutionModalProps) {
  const formatTime = (date: Date) => {
    return format(date, 'h:mm a');
  };

  const formatDate = (date: Date) => {
    return format(date, 'MMM d, yyyy');
  };

  const formatDuration = (start: Date, end: Date) => {
    const diffMs = end.getTime() - start.getTime();
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    return `${diffMinutes} min`;
  };

  const getConflictIcon = (source: 'calendar' | 'database') => {
    return source === 'calendar' ? (
      <Calendar className="h-4 w-4" />
    ) : (
      <Clock className="h-4 w-4" />
    );
  };

  const getConflictSource = (source: 'calendar' | 'database') => {
    return source === 'calendar' ? 'Google Calendar' : 'Internal Meeting';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto scrollbar-hide">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Scheduling Conflicts Detected
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Original Meeting Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">
              Original Meeting Request
            </h3>
            <div className="space-y-1 text-sm text-blue-800">
              <p>
                <strong>Title:</strong> {originalMeeting.title}
              </p>
              <p>
                <strong>Date:</strong>{' '}
                {formatDate(
                  new Date(`${originalMeeting.date}T${originalMeeting.time}`)
                )}
              </p>
              <p>
                <strong>Time:</strong>{' '}
                {formatTime(
                  new Date(`${originalMeeting.date}T${originalMeeting.time}`)
                )}
              </p>
              <p>
                <strong>Duration:</strong> {originalMeeting.duration} minutes
              </p>
            </div>
          </div>

          {/* Conflicts Section */}
          <div>
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Conflicts Found ({conflictCheck.conflicts.length})
            </h3>

            <div className="space-y-3">
              {conflictCheck.conflicts.map((conflict) => (
                <div
                  key={conflict.id}
                  className="border border-red-200 bg-red-50 rounded-lg p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getConflictIcon(conflict.source)}
                        <span className="font-medium text-red-900">
                          {conflict.title}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {getConflictSource(conflict.source)}
                        </Badge>
                      </div>
                      <div className="text-sm text-red-700">
                        <p>
                          {formatDate(conflict.start)} at{' '}
                          {formatTime(conflict.start)}
                        </p>
                        <p>
                          Duration:{' '}
                          {formatDuration(conflict.start, conflict.end)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alternatives Section */}
          {conflictCheck.alternatives.length > 0 && (
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Suggested Alternative Times
              </h3>

              <div className="space-y-2">
                {conflictCheck.alternatives.slice(0, 5).map((slot, index) => (
                  <div
                    key={index}
                    className="border border-green-200 bg-green-50 rounded-lg p-3 hover:bg-green-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-green-900">
                          {formatDate(slot.start)} at {formatTime(slot.start)}
                        </div>
                        {slot.reason && (
                          <div className="text-sm text-green-700">
                            {slot.reason}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {slot.source === 'calendar' && onScheduleOnCalendar ? (
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => onScheduleOnCalendar(slot)}
                          >
                            Schedule on Google
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-green-300 text-green-700 hover:bg-green-200"
                            onClick={() => onSelectAlternative(slot)}
                          >
                            Select
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calendar Status */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Calendar Integration:</span>
              <Badge
                variant={
                  conflictCheck.calendarConnected ? 'default' : 'secondary'
                }
              >
                {conflictCheck.calendarConnected
                  ? 'Connected'
                  : 'Not Connected'}
              </Badge>
            </div>
            {conflictCheck.internalMeetings > 0 && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-600">Internal Meetings:</span>
                <span className="font-medium">
                  {conflictCheck.internalMeetings} found
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>

            <Button
              onClick={onProceedAnyway}
              className="flex-1"
              variant="outline"
            >
              Schedule Anyway
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
