import { useState } from 'react';
import { useMeetings } from '@/hooks/useMeetings';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface MeetingFormData {
  title: string;
  description: string;
  date: Date | undefined;
  time: string;
  duration: number;
  privacy: 'public' | 'private';
  participants: string[];
  participantInput: string;
}

const initialFormData: MeetingFormData = {
  title: '',
  description: '',
  date: undefined,
  time: '',
  duration: 30,
  privacy: 'public',
  participants: [],
  participantInput: '',
};

export const useMeetingForm = (onSuccess?: () => void) => {
  const { createMeeting } = useMeetings();
  const { user } = useAuth();
  const [formData, setFormData] = useState<MeetingFormData>(initialFormData);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setFormData(initialFormData);
  };

  const updateField = <K extends keyof MeetingFormData>(
    field: K,
    value: MeetingFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    updateField(name as keyof MeetingFormData, value);
  };

  const handleDateChange = (date: Date | undefined) => {
    updateField('date', date);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateField('time', e.target.value);
  };

  const handlePrivacyChange = (value: 'public' | 'private') => {
    updateField('privacy', value);
  };

  const handleParticipantInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateField('participantInput', e.target.value);
  };

  const handleParticipantKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (['Enter', ','].includes(e.key)) {
      e.preventDefault();
      const value = formData.participantInput.trim();
      if (value && !formData.participants.includes(value)) {
        setFormData((prev) => ({
          ...prev,
          participants: [...prev.participants, value],
          participantInput: '',
        }));
      }
    } else if (
      e.key === 'Backspace' &&
      !formData.participantInput &&
      formData.participants.length > 0
    ) {
      setFormData((prev) => ({
        ...prev,
        participants: prev.participants.slice(0, -1),
      }));
    }
  };

  const removeParticipant = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      participants: prev.participants.filter((p) => p !== value),
    }));
  };

  const submitForm = async () => {
    if (
      !formData.title ||
      !formData.date ||
      !formData.time ||
      !formData.duration
    ) {
      toast.error('Please fill in all required fields');
      return false;
    }

    setLoading(true);
    try {
      // Combine date and time into ISO string
      const [hours, minutes] = formData.time.split(':');
      const scheduledDate = new Date(formData.date);
      scheduledDate.setHours(Number(hours));
      scheduledDate.setMinutes(Number(minutes));
      scheduledDate.setSeconds(0);
      scheduledDate.setMilliseconds(0);

      await createMeeting({
        title: formData.title,
        description: formData.description,
        scheduledTime: scheduledDate.toISOString(),
        duration: Number(formData.duration),
        privacy: formData.privacy,
        participants: formData.participants,
        hostEmail: user?.email,
      });

      toast.success('Meeting scheduled');
      resetForm();
      onSuccess?.();
      return true;
    } catch (e) {
      toast.error('Failed to schedule meeting');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    formData,
    loading,
    resetForm,
    updateField,
    handleInputChange,
    handleDateChange,
    handleTimeChange,
    handlePrivacyChange,
    handleParticipantInput,
    handleParticipantKeyDown,
    removeParticipant,
    submitForm,
  };
};
