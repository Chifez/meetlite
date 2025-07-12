import React, { useState, useEffect } from 'react';
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
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [ampm, setAmPm] = useState<'AM' | 'PM'>('AM');
  const [inviteInput, setInviteInput] = useState('');
  const [displayTime, setDisplayTime] = useState('');
  const [currentDescription, setCurrentDescription] = useState('');

  const { streamDescription, generateDescriptionNonStreaming } =
    useStreamingAI();

  useEffect(() => {
    if (propTimezone && propTimezone !== timezone) setTimezone(propTimezone);
  }, [propTimezone]);

  // Parse 24-hour time from formData.time and update display state
  useEffect(() => {
    if (formData.time && formData.time.match(/^\d{2}:\d{2}$/)) {
      const [hours, minutes] = formData.time.split(':').map(Number);
      const isPM = hours >= 12;
      const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

      setHour(displayHour.toString());
      setMinute(minutes.toString().padStart(2, '0'));
      setAmPm(isPM ? 'PM' : 'AM');
      setDisplayTime(
        `${displayHour}:${minutes.toString().padStart(2, '0')} ${
          isPM ? 'PM' : 'AM'
        }`
      );
    }
  }, [formData.time]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit();
  };

  const handleTimeBoxChange = (type: 'hour' | 'minute', value: string) => {
    if (type === 'hour') {
      if (
        /^\d{0,2}$/.test(value) &&
        ((+value >= 1 && +value <= 12) || value === '')
      )
        setHour(value);
    } else {
      if (
        /^\d{0,2}$/.test(value) &&
        ((+value >= 0 && +value <= 59) || value === '')
      )
        setMinute(value);
    }
  };

  const handleTimeConfirm = () => {
    if (!hour || !minute) return;
    const h = ampm === 'PM' ? (parseInt(hour) % 12) + 12 : parseInt(hour) % 12;
    const formatted = `${h.toString().padStart(2, '0')}:${minute.padStart(
      2,
      '0'
    )}`;
    const displayFormatted = `${hour}:${minute.padStart(2, '0')} ${ampm}`;

    onTimeChange({ target: { name: 'time', value: formatted } } as any);
    setDisplayTime(displayFormatted);
    setTimePopoverOpen(false);
  };

  const handleInviteInput = (e: React.ChangeEvent<HTMLInputElement>) =>
    setInviteInput(e.target.value);

  const handleInviteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
  };

  const handleGenerateDescription = async () => {
    if (!formData.title || !formData.title.trim()) {
      toast.error('Please enter a meeting title first.');
      return;
    }

    setCurrentDescription('');

    try {
      // Try streaming first, fallback to non-streaming
      await streamDescription(
        formData.title,
        // onContent callback - called for each chunk
        (content: string) => {
          setCurrentDescription((prev) => prev + content);
          // Update the form field in real-time
          onInputChange({
            target: {
              name: 'description',
              value: currentDescription + content,
            },
          } as any);
        },
        // onComplete callback - called when streaming is done
        (fullContent: string) => {
          setCurrentDescription(fullContent);
          onInputChange({
            target: { name: 'description', value: fullContent },
          } as any);
          toast.success('Description generated successfully!');
        },
        // onError callback - fallback to non-streaming
        async (error: string) => {
          console.warn(
            'Streaming failed, falling back to non-streaming:',
            error
          );
          try {
            const description = await generateDescriptionNonStreaming(
              formData.title
            );
            if (description) {
              setCurrentDescription(description);
              onInputChange({
                target: { name: 'description', value: description },
              } as any);
              toast.success('Description generated successfully!');
            } else {
              toast.error('No description returned from AI.');
            }
          } catch (fallbackError) {
            toast.error(`Failed to generate description: ${fallbackError}`);
          }
        }
      );
    } catch (error) {
      toast.error(`Failed to generate description: ${error}`);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        {/* <CardHeader>
          <CardTitle>Schedule a Meeting</CardTitle>
        </CardHeader> */}
        <CardContent className="space-y-4 my-2">
          <MeetingFormTitle
            formData={formData}
            onInputChange={onInputChange}
            onGenerateDescription={handleGenerateDescription}
          />
          <MeetingFormDateTime
            formData={formData}
            onDateChange={onDateChange}
            hour={hour}
            minute={minute}
            ampm={ampm}
            setHour={setHour}
            setMinute={setMinute}
            setAmPm={setAmPm}
            timePopoverOpen={timePopoverOpen}
            setTimePopoverOpen={setTimePopoverOpen}
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
