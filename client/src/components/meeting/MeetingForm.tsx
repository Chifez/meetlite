import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { MeetingFormData } from '@/lib/types';
import { useState } from 'react';
import { toast } from 'sonner';
import MeetingFormTitle from './MeetingFormTitle';
import MeetingFormDateTime from './MeetingFormDateTime';
import MeetingFormDurationPrivacy from './MeetingFormDurationPrivacy';
import MeetingFormInvite from './MeetingFormInvite';
import MeetingFormFooter from './MeetingFormFooter';
import { env } from '@/config/env';
import api from '@/lib/axios';

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
}: MeetingFormProps) => {
  const [inviteMethod, setInviteMethod] = useState('email');
  const [timezone, setTimezone] = useState('Africa/Lagos');
  const [timePopoverOpen, setTimePopoverOpen] = useState(false);
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [ampm, setAmPm] = useState<'AM' | 'PM'>('AM');
  const [inviteInput, setInviteInput] = useState('');
  const [displayTime, setDisplayTime] = useState('');
  const [generatingDescription, setGeneratingDescription] = useState(false);

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
    setGeneratingDescription(true);
    try {
      const response = await api.post(`${env.AI_SERVICE_URL}/description`, {
        title: formData.title,
      });
      const description = response.data?.description;
      if (description) {
        onInputChange({
          target: { name: 'description', value: description },
        } as any);
      } else {
        toast.error('No description returned from AI.');
      }
    } catch (err) {
      toast.error(`Failed to generate description. ${err}`);
    } finally {
      setGeneratingDescription(false);
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
            generatingDescription={generatingDescription}
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
            setTimezone={setTimezone}
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
