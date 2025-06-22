import { useState } from 'react';
import { useMeetings } from '@/hooks/useMeetings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';

interface MeetingFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  hideFooter?: boolean;
}

const initialForm = {
  title: '',
  description: '',
  date: undefined as Date | undefined,
  time: '',
  duration: 30,
  privacy: 'public' as 'public' | 'private',
  participants: [] as string[],
  participantInput: '',
};

const MeetingForm = ({ onSuccess, onCancel, hideFooter }: MeetingFormProps) => {
  const { createMeeting } = useMeetings();
  const { user } = useAuth();
  // Consolidated form state
  const [form, setForm] = useState({ ...initialForm });
  const [loading, setLoading] = useState(false);

  // Generic handler for input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleParticipantInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, participantInput: e.target.value }));
  };

  const handleParticipantKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (['Enter', ','].includes(e.key)) {
      e.preventDefault();
      const value = form.participantInput.trim();
      if (value && !form.participants.includes(value)) {
        setForm((prev) => ({
          ...prev,
          participants: [...prev.participants, value],
          participantInput: '',
        }));
      }
    } else if (
      e.key === 'Backspace' &&
      !form.participantInput &&
      form.participants.length > 0
    ) {
      setForm((prev) => ({
        ...prev,
        participants: prev.participants.slice(0, -1),
      }));
    }
  };

  const removeParticipant = (value: string) => {
    setForm((prev) => ({
      ...prev,
      participants: prev.participants.filter((p) => p !== value),
    }));
  };

  // Date/time handlers
  const handleDateChange = (date: Date | undefined) => {
    setForm((prev) => ({ ...prev, date }));
  };
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, time: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.date || !form.time || !form.duration) {
      toast.error('Please fill in all required fields');
      return;
    }
    setLoading(true);
    try {
      // Combine date and time into ISO string
      const [hours, minutes] = form.time.split(':');
      const scheduledDate = new Date(form.date);
      scheduledDate.setHours(Number(hours));
      scheduledDate.setMinutes(Number(minutes));
      scheduledDate.setSeconds(0);
      scheduledDate.setMilliseconds(0);
      await createMeeting({
        title: form.title,
        description: form.description,
        scheduledTime: scheduledDate.toISOString(),
        duration: Number(form.duration),
        privacy: form.privacy,
        participants: form.participants,
        hostEmail: user?.email,
      });
      toast.success('Meeting scheduled');
      setForm({ ...initialForm });
      onSuccess();
    } catch (e) {
      toast.error('Failed to schedule meeting');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-6">
      <form onSubmit={handleSubmit} action="schedule-meeting">
        <CardHeader>
          <CardTitle>Schedule a Meeting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block mb-1 font-medium">Title *</label>
            <Input
              name="title"
              value={form.title}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Description</label>
            <Input
              name="description"
              value={form.description}
              onChange={handleChange}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block mb-1 font-medium">Date *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={
                      'w-full justify-start text-left font-normal' +
                      (form.date ? '' : ' text-muted-foreground')
                    }
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.date ? (
                      format(form.date, 'PPP')
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.date}
                    onSelect={handleDateChange}
                    captionLayout="dropdown"
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex-1">
              <label className="block mb-1 font-medium">Time *</label>
              <Input
                type="time"
                name="time"
                value={form.time}
                onChange={handleTimeChange}
                required
              />
            </div>
          </div>
          <div>
            <label className="block mb-1 font-medium">
              Duration (minutes) *
            </label>
            <Input
              type="number"
              min={1}
              name="duration"
              value={form.duration}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Privacy *</label>
            <Select
              value={form.privacy}
              onValueChange={(val) =>
                setForm((f) => ({ ...f, privacy: val as 'public' | 'private' }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select privacy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block mb-1 font-medium">
              Invite Participants (emails or user IDs)
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.participants.map((p) => (
                <Badge
                  key={p}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  {p}
                  <button
                    type="button"
                    className="ml-1 text-gray-400 hover:text-red-500"
                    onClick={() => removeParticipant(p)}
                    aria-label={`Remove ${p}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              name="participantInput"
              value={form.participantInput}
              onChange={handleParticipantInput}
              onKeyDown={handleParticipantKeyDown}
              placeholder="Type email or user ID and press Enter"
              autoComplete="off"
            />
          </div>
        </CardContent>
        {!hideFooter && (
          <CardFooter className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Scheduling...' : 'Schedule'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
          </CardFooter>
        )}
      </form>
    </Card>
  );
};

export default MeetingForm;
