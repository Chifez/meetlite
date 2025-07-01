import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { env } from '@/config/env';

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

export const useMeetingForm = (onSuccess?: (meetingId: string) => void) => {
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
    const value = e.target.value.trim();
    if (value && !formData.participants.includes(value)) {
      setFormData((prev) => ({
        ...prev,
        participants: [...prev.participants, value],
        participantInput: '',
      }));
    } else {
      setFormData((prev) => ({ ...prev, participantInput: '' }));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const value = e.currentTarget.value.trim();

      if (value && !formData.participants.includes(value)) {
        setFormData((prev) => ({
          ...prev,
          participants: [...prev.participants, value],
        }));
        e.currentTarget.value = '';
      }
    }
  };

  const removeLastParticipant = () => {
    setFormData((prev) => ({
      ...prev,
      participants: prev.participants.slice(0, -1),
    }));
  };

  const removeParticipant = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      participants: prev.participants.filter((p) => p !== value),
    }));
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    const scheduledTime =
      formData.date && formData.time
        ? (() => {
            // Create date in local timezone
            const [year, month, day] = [
              formData.date.getFullYear(),
              formData.date.getMonth(),
              formData.date.getDate(),
            ];
            const [hours, minutes] = formData.time.split(':').map(Number);
            const localDate = new Date(year, month, day, hours, minutes);
            return localDate.toISOString();
          })()
        : undefined;

    if (!scheduledTime) {
      toast.error('Please select a meeting time');
      return;
    }

    // Check if the scheduled time is in the past
    if (new Date(scheduledTime) <= new Date()) {
      toast.error('Meeting time cannot be in the past');
      return;
    }

    setLoading(true);
    const meetingData = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      scheduledTime,
      duration: formData.duration,
      participants: formData.participants,
      privacy: formData.privacy,
      inviteEmails: formData.participants,
      hostEmail: user?.email,
    };

    try {
      const response = await api.post(
        `${env.ROOM_API_URL}/meetings`,
        meetingData
      );

      toast.success('Meeting created successfully!');
      onSuccess?.(response.data.meetingId);
      resetForm();
    } catch (error) {
      toast.error('Failed to create meeting');
      console.error('Create meeting error:', error);
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
    handleKeyPress,
    removeLastParticipant,
    removeParticipant,
    handleSubmit,
  };
};
