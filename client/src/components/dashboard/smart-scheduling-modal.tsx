import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import {
  CalendarPlus,
  Sparkles,
  Calendar as CalendarIcon,
  Clock,
  Globe,
  Lock,
  Repeat,
  ChevronDown,
  X,
  Users,
  Hourglass,
  Pencil,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { MeetingFormData } from '@/lib/types';
import { getUserTimeZone } from '@/lib/timezones';
import { InputTags } from '@/components/scheduling/input-tags';
import { MeetingScheduledConfirmation } from '@/components/scheduling/meeting-scheduled-dialog';
import { useStreamingAI } from '@/hooks/use-streaming-ai';
import { useEnhancedSmartScheduling } from '@/hooks/use-enhanced-smart-scheduling';
import { toast } from 'sonner';

interface SmartSchedulingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: MeetingFormData;
  formLoading: boolean;
  onInputChange: (e: any) => void;
  onDateChange: (date: any) => void;
  onTimeChange: (time: any) => void;
  onPrivacyChange: (privacy: any) => void;
  onRecurrenceChange?: (recurrence: MeetingFormData['recurrence']) => void;
  onParticipantInput: (e: any) => void;
  onRemoveParticipant: (value: string) => void;
  onSubmit: () => Promise<any> | void;
  onCancel: () => void;
  onScheduleOnCalendar?: (slot: any) => void | Promise<void>;
  teamId?: string;
  teamName?: string;
  onAutoIncludeChange?: (checked: boolean) => void;
}

interface DynamicSuggestedSlot {
  id: string;
  title: string;
  timeLabel: string;
  dateStr: string;
  timeStr: string;
  status: string;
  statusType: 'free' | 'conflict';
  pillLabel?: string;
  avatars: Array<{ initials: string; bg: string; color: string }>;
}

// Helper: Snap to next 15-minute slot
function getNext15MinuteTime(): { time24: string; display: string } {
  const now = new Date();
  const minutes = now.getMinutes();
  const remainder = minutes % 15;
  now.setMinutes(minutes + (15 - remainder), 0, 0);

  const hours = now.getHours();
  const mins = now.getMinutes();
  const time24 = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  const isPM = hours >= 12;
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const display = `${displayHour}:${String(mins).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
  return { time24, display };
}

// Helper: Format 24h time to 12h display
function formatTime12h(time24: string): string {
  if (!time24 || !time24.includes(':')) return '';
  const [h, m] = time24.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return time24;
  const isPM = h >= 12;
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${String(m).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
}

// Helper: Calculate live end time
function calculateEndTime(
  date: Date | undefined,
  timeString: string | undefined,
  durationMinutes: number
): string {
  if (!timeString) return '';
  const [h, m] = timeString.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return '';
  const d = date ? new Date(date) : new Date();
  d.setHours(h, m, 0, 0);
  const end = new Date(d.getTime() + durationMinutes * 60 * 1000);
  const endHours = end.getHours();
  const endMins = end.getMinutes();
  const isPM = endHours >= 12;
  const displayHour = endHours === 0 ? 12 : endHours > 12 ? endHours - 12 : endHours;
  return `${displayHour}:${String(endMins).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
}

// Helper: Generate participant avatar initials and deterministic colors
function getParticipantAvatars(
  participants: string[] = []
): Array<{ initials: string; bg: string; color: string }> {
  if (!participants || participants.length === 0) {
    return [{ initials: 'YOU', bg: '#EEEDE8', color: '#3A3A37' }];
  }
  const colors = [
    { bg: '#E1F5EE', color: '#085041' },
    { bg: '#FAECE7', color: '#712B13' },
    { bg: '#EBF3FE', color: '#1B4D89' },
    { bg: '#F1EFE8', color: '#5A5850' },
    { bg: '#FBEBEB', color: '#791F1F' },
  ];
  return participants.slice(0, 4).map((p, i) => {
    const clean = p.split('@')[0] || 'U';
    const initials = clean.slice(0, 2).toUpperCase();
    return { initials, ...colors[i % colors.length] };
  });
}

const DURATION_PRESETS = [15, 30, 45, 60];

const SAMPLE_PROMPTS = [
  'Sync tomorrow at 2:00 PM for 30m',
  'Weekly standup, Mondays 10:00 AM',
  'Project review this Friday at 3:00 PM for 45 min',
];

export default function SmartSchedulingModal({
  open,
  onOpenChange,
  formData,
  formLoading,
  onInputChange,
  onDateChange,
  onTimeChange,
  onPrivacyChange,
  onRecurrenceChange,
  onParticipantInput,
  onRemoveParticipant,
  onSubmit,
  onCancel,
  teamId,
  teamName,
  onAutoIncludeChange,
}: SmartSchedulingModalProps) {
  // Sticky tab selection
  const [activeTab, setActiveTab] = useState<'smart' | 'manual'>(() => {
    const saved = localStorage.getItem('meetlite_schedule_tab');
    return saved === 'smart' ? 'smart' : 'manual';
  });

  const handleTabChange = (tab: 'smart' | 'manual') => {
    setActiveTab(tab);
    localStorage.setItem('meetlite_schedule_tab', tab);
  };

  const [timezone] = useState(getUserTimeZone());
  const [titleError, setTitleError] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Confirmation view state
  const [confirmedMeeting, setConfirmedMeeting] = useState<any | null>(null);

  // Time and Date picker popover states
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Recurrence expand state
  const [repeatExpanded, setRepeatExpanded] = useState(false);

  // AI Description improvement
  const { isStreaming, generateDescriptionNonStreaming } = useStreamingAI();

  // Natural language smart scheduling states (all dynamic, no hardcoded mocks)
  const [nlPrompt, setNlPrompt] = useState('');
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);
  const [parsedFacts, setParsedFacts] = useState<{
    title: string;
    attendees: string;
    window: string;
    duration: string;
  } | null>(null);

  const [suggestedSlots, setSuggestedSlots] = useState<DynamicSuggestedSlot[]>([]);

  const {
    isProcessing: isSmartProcessing,
    smartSchedule,
    populateFormData,
  } = useEnhancedSmartScheduling();

  // Ensure reasonable initial defaults when opened
  useEffect(() => {
    if (open) {
      setConfirmedMeeting(null);
      setTitleError(false);

      if (!formData.date) {
        onDateChange(new Date());
      }
      if (!formData.time) {
        const next = getNext15MinuteTime();
        onTimeChange({ target: { name: 'time', value: next.time24 } } as any);
      }
    }
  }, [open]);

  // Sync recurrence switch with form state
  useEffect(() => {
    if (formData.recurrence?.enabled) {
      setRepeatExpanded(true);
    }
  }, [formData.recurrence?.enabled]);

  // Live end-time string
  const endTimeStr = useMemo(() => {
    return calculateEndTime(formData.date, formData.time, formData.duration || 30);
  }, [formData.date, formData.time, formData.duration]);

  // Timezone display abbreviation
  const tzAbbrev = useMemo(() => {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'short',
      }).formatToParts(new Date());
      return parts.find((p) => p.type === 'timeZoneName')?.value || timezone;
    } catch {
      return timezone;
    }
  }, [timezone]);

  // Handle Duration chip click
  const handleDurationSelect = (min: number) => {
    onInputChange({ target: { name: 'duration', value: min } } as any);
  };

  // Handle Improve Description with AI
  const handleImproveDescription = async () => {
    if (!formData.title.trim()) {
      toast.error('Please enter a meeting title first');
      titleInputRef.current?.focus();
      return;
    }
    try {
      const improved = await generateDescriptionNonStreaming(formData.title);
      if (improved) {
        onInputChange({ target: { name: 'description', value: improved } } as any);
        toast.success('Description improved with AI');
      }
    } catch (err) {
      toast.error('Could not improve description');
    }
  };

  // Submit Handler
  const handleScheduleSubmit = async () => {
    if (!formData.title.trim()) {
      setTitleError(true);
      titleInputRef.current?.focus();
      return;
    }
    setTitleError(false);

    try {
      const result = await onSubmit();

      const snapshot = {
        title: formData.title,
        description: formData.description,
        date: formData.date || new Date(),
        time: formData.time,
        duration: formData.duration || 30,
        privacy: formData.privacy || 'public',
        participants: [...(formData.participants || [])],
        timeZone: timezone,
        isRecurring: formData.recurrence?.enabled,
        roomId: result?.meetingId || result?.roomId || (formData as any).roomId,
        meetingId: result?.meetingId || (formData as any).meetingId,
      };

      setConfirmedMeeting(snapshot);
    } catch (err) {
      console.error('Schedule error:', err);
    }
  };

  // Dynamic Natural Language Smart Parsing & Slot Builder
  const handleFindTimes = async (promptOverride?: string) => {
    const inputToParse = (promptOverride || nlPrompt).trim();
    if (!inputToParse) return;

    if (promptOverride) {
      setNlPrompt(promptOverride);
    }

    try {
      const { parsedData, conflictCheck } = await smartSchedule(inputToParse);
      if (!parsedData) return;

      // 1. Calculate Date Object & Readable Labels
      let dateObj = new Date();
      if (parsedData.date) {
        const parts = parsedData.date.split('-').map(Number);
        if (parts.length === 3) {
          dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
        }
      }

      const dateLabel = format(dateObj, 'EEE, MMM d');
      const timeDisplay = formatTime12h(parsedData.time);
      const endDisplay = calculateEndTime(dateObj, parsedData.time, parsedData.duration || 30);

      // 2. Derive What We Understood
      const attendeeList = parsedData.participants || [];
      const attendeeText =
        attendeeList.length > 0
          ? `${attendeeList.length} attendee${attendeeList.length > 1 ? 's' : ''} (${attendeeList.join(', ')})`
          : 'Host only';

      setParsedFacts({
        title: parsedData.title || 'Scheduled Meeting',
        attendees: attendeeText,
        window: `${dateLabel} · ${timeDisplay}`,
        duration: `${parsedData.duration || 30} min`,
      });

      // 3. Build Real Dynamic Slots
      const slots: DynamicSuggestedSlot[] = [];
      const avatars = getParticipantAvatars(attendeeList);

      const hasConflict = conflictCheck ? !conflictCheck.isAvailable : false;
      const conflictCount = conflictCheck?.conflicts?.length || 0;

      // Primary requested slot
      slots.push({
        id: 'slot-requested',
        title: parsedData.title || 'Scheduled Meeting',
        timeLabel: `${dateLabel} · ${timeDisplay}–${endDisplay}`,
        dateStr: parsedData.date,
        timeStr: parsedData.time,
        status: hasConflict
          ? `${conflictCount} conflict${conflictCount > 1 ? 's' : ''} on your calendar`
          : "Everyone's free · Best fit",
        statusType: hasConflict ? 'conflict' : 'free',
        pillLabel: hasConflict ? 'Conflict' : 'Best fit',
        avatars,
      });

      // Alternative slots from conflict check
      if (conflictCheck?.alternatives && conflictCheck.alternatives.length > 0) {
        conflictCheck.alternatives.forEach((alt, idx) => {
          const altDate = alt.date ? new Date(`${alt.date}T${alt.time}`) : new Date(alt.start);
          const altDateLabel = !isNaN(altDate.getTime()) ? format(altDate, 'EEE, MMM d') : alt.date;
          const altTimeDisplay = formatTime12h(alt.time);
          const altEndDisplay = calculateEndTime(altDate, alt.time, parsedData.duration || 30);

          slots.push({
            id: `slot-alt-${idx}`,
            title: parsedData.title || 'Scheduled Meeting',
            timeLabel: `${altDateLabel} · ${altTimeDisplay}–${altEndDisplay}`,
            dateStr: alt.date,
            timeStr: alt.time,
            status: alt.reason || 'Open alternative slot',
            statusType: 'free',
            pillLabel: 'Open',
            avatars,
          });
        });
      }

      setSuggestedSlots(slots);
      setSelectedSlotIndex(0);

      // 4. Update the form data with the primary slot
      const updates = populateFormData(parsedData);
      Object.entries(updates).forEach(([key, val]) => {
        if (key === 'date' && val) onDateChange(val);
        else if (key === 'time' && val)
          onTimeChange({ target: { name: 'time', value: val } } as any);
        else if (key === 'privacy' && val) onPrivacyChange(val);
        else if (key === 'recurrence' && val && onRecurrenceChange)
          onRecurrenceChange(val as MeetingFormData['recurrence']);
        else if (key !== 'participants' && key !== 'recurrence') {
          onInputChange({ target: { name: key, value: val } } as any);
        }
      });

      if (hasConflict) {
        toast.warning(
          `Schedule conflict detected for ${timeDisplay}. Open alternative slots have been provided below.`
        );
      } else {
        toast.success(`Found open slot for ${timeDisplay}!`);
      }
    } catch (err: any) {
      console.error('Smart scheduling NL parse error:', err);
      toast.error('Could not parse scheduling prompt');
    }
  };

  // Slot Selection Handler
  const handleSlotSelect = (slot: DynamicSuggestedSlot, idx: number) => {
    setSelectedSlotIndex(idx);
    if (slot.dateStr) {
      const parts = slot.dateStr.split('-').map(Number);
      if (parts.length === 3) {
        onDateChange(new Date(parts[0], parts[1] - 1, parts[2]));
      }
    }
    if (slot.timeStr) {
      onTimeChange({ target: { name: 'time', value: slot.timeStr } } as any);
    }
    toast.info(`Updated schedule to ${slot.timeLabel}`);
  };

  const handleClose = () => {
    setConfirmedMeeting(null);
    onOpenChange(false);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'p-0 gap-0 overflow-hidden border border-[#DAD7CF] dark:border-border/80 rounded-[14px] bg-[#FBFAF8] dark:bg-card shadow-xl transition-all duration-200',
          confirmedMeeting ? 'max-w-[440px]' : 'max-w-[540px]'
        )}
      >
        {confirmedMeeting ? (
          <MeetingScheduledConfirmation
            meeting={confirmedMeeting}
            onDone={handleClose}
          />
        ) : (
          <div className="w-full text-foreground text-[13px] leading-normal font-sans">
            {/* Header */}
            <div className="flex items-center gap-2 px-4.5 pt-3.5 pb-2.5">
              <CalendarPlus className="w-5 h-5 text-primary shrink-0" />
              <div className="text-base font-medium flex-1 text-foreground">
                Schedule meeting
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-[#6B6A65] hover:text-foreground focus:outline-none p-1 rounded-md"
                aria-label="Close"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Segmented Switch */}
            <div className="px-4.5 pb-3">
              <div className="flex bg-[#EEEDE8] dark:bg-muted/70 rounded-[9px] p-[3px] gap-[2px]">
                <button
                  type="button"
                  onClick={() => handleTabChange('smart')}
                  className={cn(
                    'flex-1 text-center py-1.5 rounded-[7px] text-xs font-medium flex items-center justify-center gap-1.5 transition-all',
                    activeTab === 'smart'
                      ? 'bg-white dark:bg-card text-foreground border border-[#DAD7CF] dark:border-border/80 shadow-2xs font-medium'
                      : 'text-[#6B6A65] dark:text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Smart scheduling</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('manual')}
                  className={cn(
                    'flex-1 text-center py-1.5 rounded-[7px] text-xs font-medium flex items-center justify-center gap-1.5 transition-all',
                    activeTab === 'manual'
                      ? 'bg-white dark:bg-card text-foreground border border-[#DAD7CF] dark:border-border/80 shadow-2xs font-medium'
                      : 'text-[#6B6A65] dark:text-muted-foreground hover:text-foreground'
                  )}
                >
                  <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                  <span>Manual</span>
                </button>
              </div>
            </div>

            {/* Body */}
            {activeTab === 'manual' ? (
              <div className="px-4.5 pb-3.5 space-y-3">
                {/* Optional Team Context Banner */}
                {teamName && (
                  <div className="flex items-center justify-between p-2 px-3 rounded-lg bg-primary/5 border border-primary/15 text-xs text-foreground">
                    <span className="font-medium">Scheduling for @{teamName}</span>
                    {onAutoIncludeChange && (
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-muted-foreground">
                        <input
                          type="checkbox"
                          defaultChecked
                          onChange={(e) => onAutoIncludeChange(e.target.checked)}
                          className="accent-primary rounded"
                        />
                        <span>Auto-invite team members</span>
                      </label>
                    )}
                  </div>
                )}

                {/* Title */}
                <div>
                  <label
                    htmlFor="meeting-title"
                    className="text-xs font-medium text-[#3A3A37] dark:text-foreground/90 block mb-1.5"
                  >
                    Title
                  </label>
                  <input
                    id="meeting-title"
                    ref={titleInputRef}
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={(e) => {
                      setTitleError(false);
                      onInputChange(e);
                    }}
                    placeholder="Meeting title"
                    className={cn(
                      'w-full h-9 bg-white dark:bg-background border rounded-lg px-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-all',
                      'border-[#CFCCC3] dark:border-border/80',
                      titleError
                        ? 'border-destructive ring-2 ring-destructive/20'
                        : 'focus:border-primary focus:ring-3 focus:ring-primary/20'
                    )}
                  />
                  {titleError && (
                    <p className="text-[11px] text-destructive mt-1 font-medium">
                      Please enter a title for the meeting.
                    </p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="meeting-description"
                      className="text-xs font-medium text-[#3A3A37] dark:text-foreground/90"
                    >
                      Description{' '}
                      <span className="text-[#8A8984] dark:text-muted-foreground font-normal">
                        · optional
                      </span>
                    </label>
                  </div>
                  <div className="bg-white dark:bg-background border border-[#CFCCC3] dark:border-border/80 rounded-lg p-2 h-[68px] relative transition-all focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/20">
                    <textarea
                      id="meeting-description"
                      name="description"
                      value={formData.description}
                      onChange={onInputChange}
                      placeholder="Add an agenda or description..."
                      rows={2}
                      className="w-full h-[38px] bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none border-none p-0 resize-none"
                    />
                    <button
                      type="button"
                      onClick={handleImproveDescription}
                      disabled={isStreaming}
                      className="absolute right-2 bottom-1.5 text-[11px] text-primary font-medium flex items-center gap-1 hover:underline focus:outline-none disabled:opacity-50"
                    >
                      {isStreaming ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Improving...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />
                          <span>Improve with AI</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Date and Start Time Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-[1.3fr_1fr] gap-2.5">
                  {/* Date Picker */}
                  <div>
                    <label className="text-xs font-medium text-[#3A3A37] dark:text-foreground/90 block mb-1.5">
                      Date
                    </label>
                    <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="w-full h-9 bg-white dark:bg-background border border-[#CFCCC3] dark:border-border/80 rounded-lg px-2.5 flex items-center gap-2 text-xs text-foreground text-left focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/20"
                        >
                          <CalendarIcon className="w-4 h-4 text-[#6B6A65] shrink-0" />
                          <span>
                            {formData.date
                              ? format(formData.date, 'EEE, MMM d, yyyy')
                              : 'Select date'}
                          </span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarPicker
                          mode="single"
                          selected={formData.date}
                          onSelect={(d) => {
                            if (d) onDateChange(d);
                            setDatePickerOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Start Time Select */}
                  <div>
                    <label className="text-xs font-medium text-[#3A3A37] dark:text-foreground/90 block mb-1.5">
                      Start time
                    </label>
                    <Popover open={timePickerOpen} onOpenChange={setTimePickerOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="w-full h-9 bg-white dark:bg-background border border-[#CFCCC3] dark:border-border/80 rounded-lg px-2.5 flex items-center justify-between text-xs text-foreground text-left focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/20"
                        >
                          <span>{formatTime12h(formData.time) || 'Select time'}</span>
                          <ChevronDown className="w-3.5 h-3.5 text-[#6B6A65]" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-44 p-1 max-h-56 overflow-y-auto" align="start">
                        <div className="space-y-0.5">
                          {Array.from({ length: 96 }).map((_, i) => {
                            const totalMins = i * 15;
                            const h = Math.floor(totalMins / 60);
                            const m = totalMins % 60;
                            const time24 = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                            const isSelected = formData.time === time24;
                            return (
                              <button
                                key={time24}
                                type="button"
                                onClick={() => {
                                  onTimeChange({
                                    target: { name: 'time', value: time24 },
                                  } as any);
                                  setTimePickerOpen(false);
                                }}
                                className={cn(
                                  'w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                                  isSelected
                                    ? 'bg-primary text-primary-foreground'
                                    : 'hover:bg-muted text-foreground'
                                )}
                              >
                                {formatTime12h(time24)}
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Duration Chips & Live End Time */}
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium text-[#3A3A37] dark:text-foreground/90 mr-1">
                      Duration
                    </span>
                    {DURATION_PRESETS.map((mins) => {
                      const isSelected = formData.duration === mins;
                      return (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => handleDurationSelect(mins)}
                          className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                            isSelected
                              ? 'bg-[#E3E6F0] dark:bg-primary/20 border-primary text-primary font-semibold'
                              : 'bg-white dark:bg-card border-[#CFCCC3] dark:border-border/80 text-[#3A3A37] dark:text-muted-foreground hover:bg-muted'
                          )}
                        >
                          {mins} min
                        </button>
                      );
                    })}
                  </div>
                  {/* Live End Time Hint */}
                  <div className="text-[11px] text-[#6B6A65] dark:text-muted-foreground mt-1.5">
                    Ends {endTimeStr || '3:00 AM'} · {timezone} ({tzAbbrev})
                  </div>
                </div>

                {/* Invite People via InputTags */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-[#3A3A37] dark:text-foreground/90">
                      Invite people
                    </label>
                    <span className="text-[11px] text-[#6B6A65] dark:text-muted-foreground">
                      Send by <strong className="font-semibold text-foreground">Email</strong>
                    </span>
                  </div>
                  <InputTags
                    tags={formData.participants || []}
                    onChange={(tags) => {
                      if (tags.length < (formData.participants || []).length) {
                        const removed = (formData.participants || []).find(
                          (t) => !tags.includes(t)
                        );
                        if (removed) onRemoveParticipant(removed);
                      } else {
                        const added = tags[tags.length - 1];
                        if (added) {
                          onParticipantInput({
                            target: { name: 'participantInput', value: added },
                          });
                        }
                      }
                    }}
                    placeholder={
                      formData.participants?.length === 0 ? 'Add email...' : 'Add another'
                    }
                  />
                </div>

                {/* Grouped Options Card: Privacy & Repeat */}
                <div className="bg-white dark:bg-background border border-[#DAD7CF] dark:border-border/80 rounded-[10px] overflow-hidden divide-y divide-[#E8E5DE] dark:divide-border/60">
                  {/* Privacy Row */}
                  <div className="flex items-center gap-2.5 p-2.5 px-3">
                    <div className="w-7 h-7 rounded-lg bg-[#EEEDE8] dark:bg-muted flex items-center justify-center text-[#5F5E5A] dark:text-muted-foreground shrink-0">
                      {formData.privacy === 'private' ? (
                        <Lock className="w-4 h-4" />
                      ) : (
                        <Globe className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs text-foreground capitalize">
                        {formData.privacy === 'private' ? 'Private' : 'Public'}
                      </div>
                      <div className="text-[11px] text-[#6B6A65] dark:text-muted-foreground">
                        {formData.privacy === 'private'
                          ? 'Only invited people can join'
                          : 'Anyone with the link can join'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onPrivacyChange(
                          formData.privacy === 'private' ? 'public' : 'private'
                        )
                      }
                      className="text-xs text-primary font-medium hover:underline focus:outline-none"
                    >
                      Change
                    </button>
                  </div>

                  {/* Repeat Row */}
                  <div className="flex flex-col p-2.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#EEEDE8] dark:bg-muted flex items-center justify-center text-[#5F5E5A] dark:text-muted-foreground shrink-0">
                        <Repeat className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs text-foreground">Repeat</div>
                        <div className="text-[11px] text-[#6B6A65] dark:text-muted-foreground capitalize">
                          {repeatExpanded && formData.recurrence?.enabled
                            ? `Repeats ${formData.recurrence.pattern || 'weekly'}`
                            : 'Does not repeat'}
                        </div>
                      </div>
                      <Switch
                        checked={repeatExpanded}
                        onCheckedChange={(checked) => {
                          setRepeatExpanded(checked);
                          if (onRecurrenceChange) {
                            onRecurrenceChange({
                              enabled: checked,
                              pattern: (formData.recurrence?.pattern as any) || 'weekly',
                              interval: 1,
                              endType: 'never',
                            });
                          }
                        }}
                      />
                    </div>

                    {/* Inline Recurrence Expansion */}
                    {repeatExpanded && (
                      <div className="mt-2.5 pt-2 border-t border-[#E8E5DE] dark:border-border/60 flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] text-[#6B6A65] dark:text-muted-foreground">
                          Frequency:
                        </span>
                        {(['daily', 'weekly', 'monthly'] as const).map((pat) => (
                          <button
                            key={pat}
                            type="button"
                            onClick={() => {
                              if (onRecurrenceChange) {
                                onRecurrenceChange({
                                  ...(formData.recurrence || {
                                    enabled: true,
                                    interval: 1,
                                    endType: 'never',
                                  }),
                                  pattern: pat,
                                  endType: formData.recurrence?.endType || 'never',
                                });
                              }
                            }}
                            className={cn(
                              'text-xs px-2.5 py-0.5 rounded-full capitalize font-medium transition-all',
                              formData.recurrence?.pattern === pat
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-[#EEEDE8] dark:bg-muted text-foreground hover:bg-secondary/60'
                            )}
                          >
                            {pat}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Smart Scheduling Tab (100% Dynamic) */
              <div className="px-4.5 pb-3.5 space-y-3.5">
                {/* Natural Language Box */}
                <div>
                  <span className="text-xs font-medium text-[#3A3A37] dark:text-foreground/90 block mb-1.5">
                    What do you want to schedule?
                  </span>
                  <div className="bg-white dark:bg-background border border-[#DAD7CF] dark:border-border/80 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/20 rounded-[10px] p-2.5 transition-all">
                    <textarea
                      value={nlPrompt}
                      onChange={(e) => setNlPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleFindTimes();
                        }
                      }}
                      placeholder="e.g. Design review tomorrow at 2:00 PM for 45 min with teammate@company.com"
                      rows={2}
                      className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none border-none p-0 resize-none"
                    />
                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[#E8E5DE] dark:border-border/60">
                      <span className="text-[11px] text-[#6B6A65] dark:text-muted-foreground">
                        Press Enter or click Find times
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleFindTimes()}
                        disabled={isSmartProcessing || !nlPrompt.trim()}
                        className="h-7 px-2.5 text-xs rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1"
                      >
                        {isSmartProcessing ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Parsing...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            <span>Find times</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Clickable Quick Starter Chips */}
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {SAMPLE_PROMPTS.map((sample) => (
                      <button
                        key={sample}
                        type="button"
                        onClick={() => handleFindTimes(sample)}
                        className="text-xs bg-white dark:bg-card border border-[#DAD7CF] dark:border-border/80 text-[#6B6A65] dark:text-muted-foreground hover:text-foreground hover:border-primary/50 px-2.5 py-1 rounded-lg transition-colors text-left"
                      >
                        {sample}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Parsed Facts Banner (shown only when parsed) */}
                {parsedFacts && (
                  <div>
                    <span className="text-xs font-medium text-[#3A3A37] dark:text-foreground/90 block mb-1.5">
                      What we understood
                    </span>
                    <div className="flex gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 bg-white dark:bg-card border border-[#DAD7CF] dark:border-border/80 rounded-lg px-2.5 py-1 text-xs text-foreground font-medium">
                        <Pencil className="w-3.5 h-3.5 text-[#6B6A65]" />
                        {parsedFacts.title}
                      </span>
                      <span className="inline-flex items-center gap-1.5 bg-white dark:bg-card border border-[#DAD7CF] dark:border-border/80 rounded-lg px-2.5 py-1 text-xs text-foreground font-medium truncate max-w-xs">
                        <Users className="w-3.5 h-3.5 text-[#6B6A65] shrink-0" />
                        <span className="truncate">{parsedFacts.attendees}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 bg-white dark:bg-card border border-[#DAD7CF] dark:border-border/80 rounded-lg px-2.5 py-1 text-xs text-foreground font-medium">
                        <CalendarIcon className="w-3.5 h-3.5 text-[#6B6A65]" />
                        {parsedFacts.window}
                      </span>
                      <span className="inline-flex items-center gap-1.5 bg-white dark:bg-card border border-[#DAD7CF] dark:border-border/80 rounded-lg px-2.5 py-1 text-xs text-foreground font-medium">
                        <Hourglass className="w-3.5 h-3.5 text-[#6B6A65]" />
                        {parsedFacts.duration}
                      </span>
                    </div>
                  </div>
                )}

                {/* Suggested Times List (Dynamic) */}
                {suggestedSlots.length > 0 ? (
                  <div>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-xs font-medium text-[#3A3A37] dark:text-foreground/90">
                        Suggested times
                      </span>
                      <span className="text-[11px] text-[#6B6A65] dark:text-muted-foreground">
                        {timezone} ({tzAbbrev})
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {suggestedSlots.map((slot, idx) => {
                        const isSelected = selectedSlotIndex === idx;
                        return (
                          <div
                            key={slot.id}
                            onClick={() => handleSlotSelect(slot, idx)}
                            className={cn(
                              'flex items-center gap-2.5 p-2 px-3 rounded-[10px] border cursor-pointer transition-all',
                              isSelected
                                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                : 'bg-white dark:bg-card border-[#DAD7CF] dark:border-border/80 hover:border-foreground/30'
                            )}
                          >
                            <div
                              className={cn(
                                'w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all',
                                isSelected
                                  ? 'border-primary bg-primary'
                                  : 'border-[#B4B2A9] bg-transparent'
                              )}
                            >
                              {isSelected && (
                                <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-foreground">
                                {slot.timeLabel}
                              </div>
                              <div
                                className={cn(
                                  'text-[11px]',
                                  slot.statusType === 'conflict'
                                    ? 'text-[#854F0B] dark:text-amber-400 font-medium'
                                    : 'text-[#6B6A65] dark:text-muted-foreground'
                                )}
                              >
                                {slot.status}
                              </div>
                            </div>
                            <div className="flex -space-x-1.5 shrink-0">
                              {slot.avatars.map((av, avIdx) => (
                                <div
                                  key={avIdx}
                                  style={{ backgroundColor: av.bg, color: av.color }}
                                  className="w-5 h-5 rounded-full border border-white dark:border-card text-[9px] font-medium flex items-center justify-center"
                                >
                                  {av.initials}
                                </div>
                              ))}
                            </div>
                            {slot.pillLabel && (
                              <span
                                className={cn(
                                  'text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0',
                                  slot.statusType === 'conflict'
                                    ? 'bg-[#FAEEDA] text-[#633806] dark:bg-amber-950/60 dark:text-amber-300'
                                    : 'bg-[#E1F5EE] text-[#085041] dark:bg-emerald-950/60 dark:text-emerald-300'
                                )}
                              >
                                {slot.pillLabel}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Initial Empty Prompt State */
                  <div className="p-4 rounded-xl border border-dashed border-[#DAD7CF] dark:border-neutral-800 text-center space-y-1 bg-muted/20">
                    <div className="w-7 h-7 mx-auto rounded-lg bg-[#EEEDE8] dark:bg-neutral-800 flex items-center justify-center text-primary mb-1">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-xs font-medium text-foreground">
                      Natural language scheduling
                    </div>
                    <p className="text-[11px] text-muted-foreground max-w-xs mx-auto leading-normal">
                      Type who you want to meet with, what day, and duration. We'll automatically verify calendar availability and propose conflict-free slots.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Footer Bar */}
            <div className="flex items-center gap-2 px-4.5 py-3 border-t border-[#E2DFD7] dark:border-border/80 bg-[#F6F5F1] dark:bg-muted/30">
              <div className="flex-1 text-xs text-[#6B6A65] dark:text-muted-foreground flex items-center gap-1.5 truncate">
                {activeTab === 'manual' ? (
                  <>
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {formData.date ? format(formData.date, 'EEE, MMM d') : 'Today'} ·{' '}
                      {formatTime12h(formData.time) || '2:30 AM'}–{endTimeStr || '3:00 AM'} ·{' '}
                      {formData.participants?.length || 0} invited
                    </span>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleTabChange('manual')}
                    className="text-xs text-primary font-medium hover:underline focus:outline-none"
                  >
                    Edit details in manual form →
                  </button>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                className="h-8 px-3 rounded-lg border-[#CFCCC3] dark:border-border/80 bg-white dark:bg-card text-xs font-medium"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleScheduleSubmit}
                disabled={formLoading}
                className="h-8 px-3.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs shadow-xs"
              >
                {formLoading ? 'Scheduling...' : 'Schedule meeting'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
