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
import { useState } from 'react';
import timezones from '@/lib/timezones'; // Assume you have a list of IANA timezones
import MeetingFormTitle from './MeetingFormTitle';
import MeetingFormDateTime from './MeetingFormDateTime';
import MeetingFormDurationPrivacy from './MeetingFormDurationPrivacy';
import MeetingFormInvite from './MeetingFormInvite';
import MeetingFormFooter from './MeetingFormFooter';

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

const INVITE_METHODS = [
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
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
  onParticipantKeyDown,
  onRemoveParticipant,
  onSubmit,
  onCancel,
}: MeetingFormProps) => {
  const [inviteMethod, setInviteMethod] = useState('email');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [timezone, setTimezone] = useState('Africa/Lagos');
  const [timePopoverOpen, setTimePopoverOpen] = useState(false);
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [ampm, setAmPm] = useState<'AM' | 'PM'>('AM');
  const [inviteInput, setInviteInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteMethod === 'whatsapp') {
      // WhatsApp invite logic
      if (!/^\d{7,15}$/.test(whatsappNumber.replace(/\D/g, ''))) {
        alert('Please enter a valid WhatsApp number.');
        return;
      }
      const dateStr = formData.date ? format(formData.date, 'MMM,dd yyyy') : '';
      const timeStr = formData.time || '';
      const msg = encodeURIComponent(
        `You're invited to a meeting: ${formData.title}\nDate: ${dateStr} ${timeStr} (${timezone})`
      );
      const link = `https://wa.me/${whatsappNumber.replace(
        /\D/g,
        ''
      )}?text=${msg}`;
      window.open(link, '_blank');
      return;
    }
    onSubmit();
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
    onTimeChange({ target: { name: 'time', value: formatted } } as any);
    setTimePopoverOpen(false);
  };

  const handleInviteInput = (e: React.ChangeEvent<HTMLInputElement>) =>
    setInviteInput(e.target.value);

  const handleInviteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inviteInput.trim()) {
      e.preventDefault();
      if (inviteMethod === 'email') {
        onParticipantInput({
          target: { name: 'participantInput', value: inviteInput },
        } as any);
      } else if (inviteMethod === 'whatsapp') {
        if (/^\d{7,15}$/.test(inviteInput.replace(/\D/g, ''))) {
          onParticipantInput({
            target: { name: 'participantInput', value: inviteInput },
          } as any);
        }
      }
      setInviteInput('');
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        {/* <CardHeader>
          <CardTitle>Schedule a Meeting</CardTitle>
        </CardHeader> */}
        <CardContent className="space-y-4 my-2">
          <MeetingFormTitle formData={formData} onInputChange={onInputChange} />
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
