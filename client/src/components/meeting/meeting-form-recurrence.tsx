import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { MeetingFormData } from '@/lib/types';

interface MeetingFormRecurrenceProps {
  formData: MeetingFormData;
  onRecurrenceChange: (recurrence: MeetingFormData['recurrence']) => void;
}

const RECURRENCE_PATTERNS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays (Mon-Fri)' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export default function MeetingFormRecurrence({
  formData,
  onRecurrenceChange,
}: MeetingFormRecurrenceProps) {
  const recurrence = formData.recurrence || {
    enabled: false,
    pattern: 'weekly' as const,
    interval: 1,
    endType: 'never' as const,
  };

  const handleEnableChange = (enabled: boolean) => {
    if (enabled) {
      onRecurrenceChange({
        enabled: true,
        pattern: recurrence.pattern || 'weekly',
        interval: recurrence.interval || 1,
        endType: recurrence.endType || 'never',
        daysOfWeek: recurrence.daysOfWeek,
        dayOfMonth: recurrence.dayOfMonth,
        endDate: recurrence.endDate,
        occurrences: recurrence.occurrences,
      });
    } else {
      onRecurrenceChange({
        enabled: false,
        pattern: 'weekly',
        interval: 1,
        endType: 'never',
      });
    }
  };

  const handlePatternChange = (pattern: string) => {
    onRecurrenceChange({
      ...recurrence,
      enabled: true,
      pattern: pattern as any,
      // Reset pattern-specific fields when changing patterns
      daysOfWeek: pattern === 'weekly' ? recurrence.daysOfWeek : undefined,
      dayOfMonth: pattern === 'monthly' ? recurrence.dayOfMonth : undefined,
    });
  };

  const handleIntervalChange = (value: string) => {
    const interval = parseInt(value) || 1;
    onRecurrenceChange({
      ...recurrence,
      enabled: true,
      interval: Math.max(1, interval),
    });
  };

  const handleEndTypeChange = (endType: string) => {
    onRecurrenceChange({
      ...recurrence,
      enabled: true,
      endType: endType as 'never' | 'after' | 'on',
      // Clear end condition fields when changing end type
      endDate: endType === 'on' ? recurrence.endDate : undefined,
      occurrences: endType === 'after' ? recurrence.occurrences : undefined,
    });
  };

  const handleOccurrencesChange = (value: string) => {
    const occurrences = parseInt(value) || 1;
    onRecurrenceChange({
      ...recurrence,
      enabled: true,
      occurrences: Math.max(1, occurrences),
    });
  };

  const handleEndDateChange = (date: Date | undefined) => {
    onRecurrenceChange({
      ...recurrence,
      enabled: true,
      endDate: date,
    });
  };

  const handleDayOfWeekToggle = (day: number) => {
    const currentDays = recurrence.daysOfWeek || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day].sort((a, b) => a - b);

    onRecurrenceChange({
      ...recurrence,
      enabled: true,
      daysOfWeek: newDays.length > 0 ? newDays : undefined,
    });
  };

  const handleDayOfMonthChange = (value: string) => {
    const dayOfMonth = parseInt(value);
    if (dayOfMonth >= 1 && dayOfMonth <= 31) {
      onRecurrenceChange({
        ...recurrence,
        enabled: true,
        dayOfMonth,
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between py-2 px-3 rounded-md border bg-muted/30">
        <Label htmlFor="recurrence-enabled" className="text-sm font-medium">
          Repeat meeting
        </Label>
        <Switch
          id="recurrence-enabled"
          checked={recurrence.enabled}
          onCheckedChange={handleEnableChange}
        />
      </div>

      {recurrence.enabled && (
        <div className="space-y-3 pl-4 border-l-2 border-border">
          {/* Recurrence Pattern */}
          <div>
            <Label className="mb-2 block">Repeat pattern</Label>
            <Select
              value={recurrence.pattern}
              onValueChange={handlePatternChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_PATTERNS.map((pattern) => (
                  <SelectItem key={pattern.value} value={pattern.value}>
                    {pattern.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Interval (for all patterns except weekdays) */}
          {recurrence.pattern !== 'weekdays' && (
            <div>
              <Label className="mb-2 block">Repeat every</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={recurrence.interval || 1}
                  onChange={(e) => handleIntervalChange(e.target.value)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">
                  {recurrence.pattern === 'daily'
                    ? 'day(s)'
                    : recurrence.pattern === 'weekly'
                    ? 'week(s)'
                    : recurrence.pattern === 'monthly'
                    ? 'month(s)'
                    : 'year(s)'}
                </span>
              </div>
            </div>
          )}

          {/* Days of Week (for weekly pattern) */}
          {recurrence.pattern === 'weekly' && (
            <div>
              <Label className="mb-2 block">Days of week</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <Button
                    key={day.value}
                    type="button"
                    variant={
                      recurrence.daysOfWeek?.includes(day.value)
                        ? 'default'
                        : 'outline'
                    }
                    size="sm"
                    onClick={() => handleDayOfWeekToggle(day.value)}
                  >
                    {day.label.slice(0, 3)}
                  </Button>
                ))}
              </div>
              {recurrence.daysOfWeek && recurrence.daysOfWeek.length === 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Select at least one day
                </p>
              )}
            </div>
          )}

          {/* Day of Month (for monthly pattern) */}
          {recurrence.pattern === 'monthly' && (
            <div>
              <Label className="mb-2 block">Day of month</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={
                  recurrence.dayOfMonth ||
                  new Date(formData.date || new Date()).getDate()
                }
                onChange={(e) => handleDayOfMonthChange(e.target.value)}
                className="w-32"
              />
            </div>
          )}

          {/* End Condition */}
          <div>
            <Label className="mb-2 block">Ends</Label>
            <Select
              value={recurrence.endType}
              onValueChange={handleEndTypeChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="after">After</SelectItem>
                <SelectItem value="on">On date</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Occurrences (if end type is "after") */}
          {recurrence.endType === 'after' && (
            <div>
              <Label className="mb-2 block">Number of occurrences</Label>
              <Input
                type="number"
                min={1}
                value={recurrence.occurrences || 1}
                onChange={(e) => handleOccurrencesChange(e.target.value)}
                className="w-32"
              />
            </div>
          )}

          {/* End Date (if end type is "on") */}
          {recurrence.endType === 'on' && (
            <div>
              <Label className="mb-2 block">End date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {recurrence.endDate ? (
                      format(recurrence.endDate, 'MMM, dd yyyy')
                    ) : (
                      <span className="text-muted-foreground">
                        Pick end date
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={recurrence.endDate}
                    onSelect={handleEndDateChange}
                    disabled={(date) => {
                      const startDate = formData.date || new Date();
                      return date < startDate;
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
