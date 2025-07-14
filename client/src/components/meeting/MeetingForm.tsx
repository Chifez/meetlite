import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { MeetingFormData } from '@/lib/types';
import { toast } from 'sonner';
import MeetingFormTitle from './MeetingFormTitle';
import MeetingFormDateTime from './MeetingFormDateTime';
import MeetingFormDurationPrivacy from './MeetingFormDurationPrivacy';
import MeetingFormInvite from './MeetingFormInvite';
import MeetingFormFooter from './MeetingFormFooter';
import { useStreamingAI } from '@/hooks/useStreamingAI';

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
  onRemoveParticipant: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  onCancel: () => void;
  timezone?: string;
  setTimezone?: (tz: string) => void;
}

const INVITE_METHODS = [
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp', disabled: true },
  { value: 'twitter', label: 'Twitter', disabled: true },
];

// Utility function to parse 24-hour time to 12-hour format
const parseTimeTo12Hour = (timeString: string) => {
  if (!timeString || !timeString.match(/^\d{2}:\d{2}$/)) {
    return {
      hour: '',
      minute: '',
      ampm: 'AM' as 'AM' | 'PM',
      displayTime: '',
    };
  }

  const [hours, minutes] = timeString.split(':').map(Number);
  const isPM = hours >= 12;
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

  return {
    hour: displayHour.toString(),
    minute: minutes.toString().padStart(2, '0'),
    ampm: (isPM ? 'PM' : 'AM') as 'AM' | 'PM',
    displayTime: `${displayHour}:${minutes.toString().padStart(2, '0')} ${
      isPM ? 'PM' : 'AM'
    }`,
  };
};

const MeetingForm = ({
  formData,
  loading,
  hideFooter,
  onInputChange,
  onDateChange,
  onTimeChange,
  onPrivacyChange,
  onParticipantInput,
  onRemoveParticipant,
  onSubmit,
  onCancel,
  timezone: propTimezone,
  setTimezone: propSetTimezone,
}: MeetingFormProps) => {
  const [inviteMethod, setInviteMethod] = useState('email');
  const [timezone, setTimezone] = useState(propTimezone || 'Africa/Lagos');
  const [timePopoverOpen, setTimePopoverOpen] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [editingTime, setEditingTime] = useState({
    hour: '',
    minute: '',
    ampm: 'AM' as 'AM' | 'PM',
  });
  const { streamDescription, generateDescriptionNonStreaming } =
    useStreamingAI();

  // Derived state for time parsing - replaces the useEffect
  const timeData = useMemo(() => {
    return parseTimeTo12Hour(formData.time);
  }, [formData.time]);

  const { hour, minute, ampm, displayTime } = timeData;

  // Local state for time input - only used during editing

  // Update editing time when popover opens - this is the proper pattern
  const handleTimePopoverOpen = useCallback(
    (open: boolean) => {
      if (open) {
        // Sync editing state with current form data when popover opens
        setEditingTime({ hour, minute, ampm });
      }
      setTimePopoverOpen(open);
    },
    [hour, minute, ampm]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit();
  };

  const handleTimeBoxChange = (type: 'hour' | 'minute', value: string) => {
    if (type === 'hour') {
      if (
        /^\d{0,2}$/.test(value) &&
        ((+value >= 1 && +value <= 12) || value === '')
      ) {
        setEditingTime((prev) => ({ ...prev, hour: value }));
      }
    } else {
      if (
        /^\d{0,2}$/.test(value) &&
        ((+value >= 0 && +value <= 59) || value === '')
      ) {
        setEditingTime((prev) => ({ ...prev, minute: value }));
      }
    }
  };

  const handleTimeConfirm = useCallback(() => {
    const { hour: editHour, minute: editMinute, ampm: editAmpm } = editingTime;

    if (!editHour || !editMinute) return;

    const h =
      editAmpm === 'PM'
        ? (parseInt(editHour) % 12) + 12
        : parseInt(editHour) % 12;
    const formatted = `${h.toString().padStart(2, '0')}:${editMinute.padStart(
      2,
      '0'
    )}`;

    onTimeChange({ target: { name: 'time', value: formatted } } as any);
    setTimePopoverOpen(false);
  }, [editingTime, onTimeChange]);

  const handleInviteInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInviteInput(e.target.value);
  };

  const handleInviteKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && inviteInput.trim()) {
        e.preventDefault();
        if (inviteMethod === 'email') {
          // Email validation
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(inviteInput.trim())) {
            toast.error('Please enter a valid email address');
            return;
          }
          onParticipantInput({
            target: { name: 'participantInput', value: inviteInput },
          } as any);
        } else if (inviteMethod === 'whatsapp') {
          if (/^\d{7,15}$/.test(inviteInput.replace(/\D/g, ''))) {
            onParticipantInput({
              target: { name: 'participantInput', value: inviteInput },
            } as any);
          } else {
            toast.error('Please enter a valid WhatsApp number');
            return;
          }
        }
        setInviteInput('');
      }
    },
    [inviteInput, inviteMethod, onParticipantInput]
  );

  const handleGenerateDescription = useCallback(async () => {
    if (!formData.title || !formData.title.trim()) {
      toast.error('Please enter a meeting title first.');
      return;
    }

    let accumulatedContent = '';

    const updateDescription = (content: string) => {
      onInputChange({
        target: { name: 'description', value: content },
      } as any);
    };

    const handleContent = (content: string) => {
      accumulatedContent += content;
      updateDescription(accumulatedContent);
    };

    const handleComplete = (fullContent: string) => {
      accumulatedContent = fullContent;
      updateDescription(fullContent);
      toast.success('Description generated successfully!');
    };

    const handleError = async (error: string) => {
      console.warn('Streaming failed, falling back to non-streaming:', error);
      try {
        const description = await generateDescriptionNonStreaming(
          formData.title
        );
        if (description) {
          accumulatedContent = description;
          updateDescription(description);
          toast.success('Description generated successfully!');
        } else {
          toast.error('No description returned from AI.');
        }
      } catch (fallbackError) {
        toast.error(`Failed to generate description: ${fallbackError}`);
      }
    };

    try {
      await streamDescription(
        formData.title,
        handleContent,
        handleComplete,
        handleError
      );
    } catch (error) {
      toast.error(`Failed to generate description: ${error}`);
    }
  }, [
    formData.title,
    onInputChange,
    streamDescription,
    generateDescriptionNonStreaming,
  ]);

  useEffect(() => {
    if (propTimezone && propTimezone !== timezone) {
      setTimezone(propTimezone);
    }
  }, [propTimezone, timezone]);

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 my-2">
          <MeetingFormTitle
            formData={formData}
            onInputChange={onInputChange}
            onGenerateDescription={handleGenerateDescription}
          />
          <MeetingFormDateTime
            formData={formData}
            onDateChange={onDateChange}
            hour={editingTime.hour}
            minute={editingTime.minute}
            ampm={editingTime.ampm}
            setHour={(value: any) =>
              setEditingTime((prev) => ({ ...prev, hour: value }))
            }
            setMinute={(value: any) =>
              setEditingTime((prev) => ({ ...prev, minute: value }))
            }
            setAmPm={(value: any) =>
              setEditingTime((prev) => ({ ...prev, ampm: value }))
            }
            timePopoverOpen={timePopoverOpen}
            setTimePopoverOpen={handleTimePopoverOpen}
            timezone={timezone}
            setTimezone={propSetTimezone || setTimezone}
            onTimeChange={onTimeChange}
            handleTimeBoxChange={handleTimeBoxChange}
            handleTimeConfirm={handleTimeConfirm}
            displayTime={displayTime}
          />
          <MeetingFormDurationPrivacy
            formData={formData}
            onInputChange={onInputChange}
            onPrivacyChange={onPrivacyChange}
          />
          <MeetingFormInvite
            inviteMethod={inviteMethod}
            setInviteMethod={setInviteMethod}
            INVITE_METHODS={INVITE_METHODS}
            inviteInput={inviteInput}
            onInviteInputChange={handleInviteInput}
            onInviteInputKeyDown={handleInviteKeyDown}
            invitees={formData.participants}
            removeInvitee={onRemoveParticipant}
          />
        </CardContent>
        {!hideFooter && (
          <CardFooter className="flex gap-2">
            <MeetingFormFooter isSubmitting={loading} onCancel={onCancel} />
          </CardFooter>
        )}
      </form>
    </Card>
  );
};

export default MeetingForm;
