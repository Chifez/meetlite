import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { MeetingFormData } from '@/lib/types';

interface MeetingFormProps {
  formData: MeetingFormData;
  loading: boolean;
  hideFooter?: boolean;
  onInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  onDateChange: (date: Date | undefined) => void;
  onTimeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPrivacyChange: (value: 'public' | 'private') => void;
  onParticipantInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onParticipantKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onRemoveParticipant: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const MeetingForm = ({
  formData,
  loading,
  hideFooter,
  onInputChange,
  onDateChange,
  onTimeChange,
  onPrivacyChange,
  onParticipantInput,
  onParticipantKeyDown,
  onRemoveParticipant,
  onSubmit,
  onCancel,
}: MeetingFormProps) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Schedule a Meeting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block mb-1 font-medium">Title *</label>
            <Input
              name="title"
              value={formData.title}
              onChange={onInputChange}
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Description</label>
            <Input
              name="description"
              value={formData.description}
              onChange={onInputChange}
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
                      (formData.date ? '' : ' text-muted-foreground')
                    }
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.date ? (
                      format(formData.date, 'PPP')
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.date}
                    onSelect={onDateChange}
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
                value={formData.time}
                onChange={onTimeChange}
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
              value={formData.duration}
              onChange={onInputChange}
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Privacy *</label>
            <Select value={formData.privacy} onValueChange={onPrivacyChange}>
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
              {formData.participants.map((p) => (
                <Badge
                  key={p}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  {p}
                  <button
                    type="button"
                    className="ml-1 text-gray-400 hover:text-red-500"
                    onClick={() => onRemoveParticipant(p)}
                    aria-label={`Remove ${p}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              name="participantInput"
              value={formData.participantInput}
              onChange={onParticipantInput}
              onKeyDown={onParticipantKeyDown}
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
