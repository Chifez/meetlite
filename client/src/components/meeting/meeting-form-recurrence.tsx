import { useMemo } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Calendar as CalendarIcon,
  Repeat,
  CalendarDays,
  CalendarClock,
  
} from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import { MeetingFormData } from '@/lib/types';
import { cn } from '@/lib/utils';

interface MeetingFormRecurrenceProps {
  formData: MeetingFormData;
  onRecurrenceChange: (recurrence: MeetingFormData['recurrence']) => void;
}

const RECURRENCE_PATTERNS = [
  { value: 'daily', label: 'Daily', icon: CalendarDays, description: 'Every day' },
  { value: 'weekdays', label: 'Weekdays', icon: CalendarIcon, description: 'Monday to Friday' },
  { value: 'weekly', label: 'Weekly', icon: CalendarClock, description: 'Same day each week' },
  { value: 'monthly', label: 'Monthly', icon: CalendarIcon, description: 'Same date each month' },
  { value: 'yearly', label: 'Yearly', icon: Repeat, description: 'Same date each year' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'S', fullName: 'Sunday' },
  { value: 1, label: 'M', fullName: 'Monday' },
  { value: 2, label: 'T', fullName: 'Tuesday' },
  { value: 3, label: 'W', fullName: 'Wednesday' },
  { value: 4, label: 'T', fullName: 'Thursday' },
  { value: 5, label: 'F', fullName: 'Friday' },
  { value: 6, label: 'S', fullName: 'Saturday' },
];

const END_TYPE_OPTIONS = [
  { value: 'never', label: 'Never', description: 'Repeats indefinitely' },
  { value: 'after', label: 'After', description: 'Specific number of occurrences' },
  { value: 'on', label: 'On date', description: 'Until a specific date' },
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

  // Generate preview of next occurrences
  const previewDates = useMemo(() => {
    if (!recurrence.enabled || !formData.date) return [];

    const startDate = new Date(formData.date);
    const dates: Date[] = [startDate];
    const pattern = recurrence.pattern;
    const interval = recurrence.interval || 1;
    const maxPreview = 5;

    for (let i = 1; i < maxPreview; i++) {
      let nextDate: Date;
      const prevDate = dates[dates.length - 1];

      switch (pattern) {
        case 'daily':
          nextDate = addDays(prevDate, interval);
          break;
        case 'weekdays': {
          // Move to next weekday
          let tempDate = addDays(prevDate, 1);
          while (tempDate.getDay() === 0 || tempDate.getDay() === 6) {
            tempDate = addDays(tempDate, 1);
          }
          nextDate = tempDate;
          break;
        }
        case 'weekly':
          nextDate = addWeeks(prevDate, interval);
          break;
        case 'monthly':
          nextDate = addMonths(prevDate, interval);
          break;
        case 'yearly':
          nextDate = addYears(prevDate, interval);
          break;
        default:
          nextDate = addWeeks(prevDate, 1);
      }

      // Check end conditions
      if (recurrence.endType === 'after' && recurrence.occurrences) {
        if (i >= recurrence.occurrences) break;
      }
      if (recurrence.endType === 'on' && recurrence.endDate) {
        if (nextDate > new Date(recurrence.endDate)) break;
      }

      dates.push(nextDate);
    }

    return dates;
  }, [recurrence, formData.date]);

  // Generate summary text
  const getSummaryText = (): string => {
    if (!recurrence.enabled) return '';

    const patternLabels: Record<string, string> = {
      daily: 'day',
      weekdays: 'weekday',
      weekly: 'week',
      monthly: 'month',
      yearly: 'year',
    };

    let summary = '';
    const interval = recurrence.interval || 1;
    const patternLabel = patternLabels[recurrence.pattern] || recurrence.pattern;

    if (recurrence.pattern === 'weekdays') {
      summary = 'Repeats every weekday (Mon-Fri)';
    } else if (interval === 1) {
      summary = `Repeats every ${patternLabel}`;
    } else {
      summary = `Repeats every ${interval} ${patternLabel}s`;
    }

    // Add days of week for weekly
    if (recurrence.pattern === 'weekly' && recurrence.daysOfWeek?.length) {
      const dayNames = recurrence.daysOfWeek
        .map((d) => DAYS_OF_WEEK.find((day) => day.value === d)?.fullName)
        .filter(Boolean)
        .join(', ');
      summary += ` on ${dayNames}`;
    }

    // Add end condition
    if (recurrence.endType === 'after' && recurrence.occurrences) {
      summary += `, ${recurrence.occurrences} time${recurrence.occurrences > 1 ? 's' : ''}`;
    } else if (recurrence.endType === 'on' && recurrence.endDate) {
      summary += `, until ${format(new Date(recurrence.endDate), 'MMM d, yyyy')}`;
    }

    return summary;
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
      endDate: endType === 'on' ? recurrence.endDate : undefined,
      occurrences: endType === 'after' ? recurrence.occurrences || 10 : undefined,
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
    <div className="space-y-4">
      {/* Enable Toggle */}
      <Card className={cn(
        'transition-colors',
        recurrence.enabled ? 'border-primary bg-primary/5' : ''
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2 rounded-lg',
                recurrence.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                <Repeat className="h-5 w-5" />
              </div>
              <div>
                <Label htmlFor="recurrence-enabled" className="text-sm font-medium cursor-pointer">
                  Repeat Meeting
                </Label>
                <p className="text-xs text-muted-foreground">
                  Schedule recurring meetings automatically
                </p>
              </div>
            </div>
            <Switch
              id="recurrence-enabled"
              checked={recurrence.enabled}
              onCheckedChange={handleEnableChange}
            />
          </div>
        </CardContent>
      </Card>

      {recurrence.enabled && (
        <div className="space-y-4">
          {/* Pattern Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Repeat Pattern</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {RECURRENCE_PATTERNS.map((pattern) => (
                <button
                  key={pattern.value}
                  type="button"
                  onClick={() => handlePatternChange(pattern.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-center',
                    recurrence.pattern === pattern.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-muted hover:border-muted-foreground/30'
                  )}
                >
                  <pattern.icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{pattern.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Interval & Day Selection */}
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* Interval */}
              {recurrence.pattern !== 'weekdays' && (
                <div className="flex items-center gap-3">
                  <Label className="text-sm whitespace-nowrap">Repeat every</Label>
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={recurrence.interval || 1}
                    onChange={(e) => handleIntervalChange(e.target.value)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">
                    {recurrence.pattern === 'daily' && (recurrence.interval === 1 ? 'day' : 'days')}
                    {recurrence.pattern === 'weekly' && (recurrence.interval === 1 ? 'week' : 'weeks')}
                    {recurrence.pattern === 'monthly' && (recurrence.interval === 1 ? 'month' : 'months')}
                    {recurrence.pattern === 'yearly' && (recurrence.interval === 1 ? 'year' : 'years')}
                  </span>
                </div>
              )}

              {/* Days of Week */}
              {recurrence.pattern === 'weekly' && (
                <div className="space-y-2">
                  <Label className="text-sm">On days</Label>
                  <div className="flex gap-1">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => handleDayOfWeekToggle(day.value)}
                        className={cn(
                          'w-9 h-9 rounded-full text-sm font-medium transition-all',
                          recurrence.daysOfWeek?.includes(day.value)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted-foreground/10'
                        )}
                        title={day.fullName}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Day of Month */}
              {recurrence.pattern === 'monthly' && (
                <div className="flex items-center gap-3">
                  <Label className="text-sm whitespace-nowrap">On day</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={
                      recurrence.dayOfMonth ||
                      new Date(formData.date || new Date()).getDate()
                    }
                    onChange={(e) => handleDayOfMonthChange(e.target.value)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">of the month</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* End Condition */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <Label className="text-sm font-medium">Ends</Label>
              <div className="grid grid-cols-3 gap-2">
                {END_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleEndTypeChange(option.value)}
                    className={cn(
                      'p-3 rounded-lg border-2 text-left transition-all',
                      recurrence.endType === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/30'
                    )}
                  >
                    <span className="text-sm font-medium block">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  </button>
                ))}
              </div>

              {/* Occurrences Input */}
              {recurrence.endType === 'after' && (
                <div className="flex items-center gap-3">
                  <Label className="text-sm whitespace-nowrap">After</Label>
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    value={recurrence.occurrences || 10}
                    onChange={(e) => handleOccurrencesChange(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">occurrences</span>
                </div>
              )}

              {/* End Date Picker */}
              {recurrence.endType === 'on' && (
                <div className="space-y-2">
                  <Label className="text-sm">End date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {recurrence.endDate ? (
                          format(new Date(recurrence.endDate), 'MMMM d, yyyy')
                        ) : (
                          <span className="text-muted-foreground">Select end date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={recurrence.endDate ? new Date(recurrence.endDate) : undefined}
                        onSelect={handleEndDateChange}
                        disabled={(date) => {
                          const startDate = formData.date || new Date();
                          return date < new Date(startDate);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview Section */}
          <Card className="bg-muted/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Preview</Label>
                <Badge variant="secondary" className="text-xs">
                  Next {previewDates.length} occurrences
                </Badge>
              </div>
              
              {/* Summary Text */}
              <p className="text-sm text-muted-foreground">{getSummaryText()}</p>

              {/* Date Preview */}
              <div className="flex flex-wrap gap-2">
                {previewDates.map((date, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className={cn(
                      'text-xs',
                      index === 0 ? 'bg-primary/10 border-primary' : ''
                    )}
                  >
                    {format(date, 'EEE, MMM d')}
                  </Badge>
                ))}
                {recurrence.endType === 'never' && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    ...and more
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
