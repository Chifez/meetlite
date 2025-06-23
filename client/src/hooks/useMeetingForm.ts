import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import axios from 'axios';
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
  const { user, getAuthHeaders } = useAuth();
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
        ? new Date(
            formData.date.toISOString().split('T')[0] + 'T' + formData.time
          ).toISOString()
        : undefined;

    if (!scheduledTime) {
      toast.error('Please select a meeting time');
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
      const response = await axios.post(
        `${env.ROOM_API_URL}/meetings`,
        meetingData,
        { headers: getAuthHeaders() }
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
