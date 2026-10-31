import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { extractData, extractError } from '@/lib/api-response';
// import { env } from '@/config/env';

import { MeetingFormData } from '@/lib/types';
import { getUserTimeZone } from '@/lib/timezones';

const initialFormData: MeetingFormData = {
  title: '',
  description: '',
  date: undefined,
  time: '',
  timeZone: getUserTimeZone(),
  duration: 30,
  privacy: 'public',
  participants: [],
  participantInput: '',
  autoIncludeTeamMembers: true,
  recurrence: {
    enabled: false,
    pattern: 'weekly',
    interval: 1,
    endType: 'never',
  },
};

export const useMeetingForm = (
  onSuccess?: (meetingId: string) => void,
  teamId?: string
) => {
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

  const handleRecurrenceChange = (
    recurrence: MeetingFormData['recurrence']
  ) => {
    updateField('recurrence', recurrence);
  };

  const handleAutoIncludeChange = (checked: boolean) => {
    updateField('autoIncludeTeamMembers', checked);
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

    if (!formData.date || !formData.time) {
      toast.error('Please select a meeting time');
      return;
    }

    const localDate = [
      formData.date.getFullYear(),
      String(formData.date.getMonth() + 1).padStart(2, '0'),
      String(formData.date.getDate()).padStart(2, '0'),
    ].join('-');
    const localTime = formData.time.length === 5 ? `${formData.time}:00` : formData.time;

    // Auto-add pending email input to participants array (synchronous approach)
    let finalParticipants = [...formData.participants];
    if (
      formData.participantInput &&
      formData.participantInput.trim().length > 0
    ) {
      const pending = formData.participantInput.trim();

      // Handle multiple emails separated by commas, semicolons, or spaces
      const emailCandidates = pending
        .split(/[,;\s]+/)
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      const validEmails = [];
      const invalidEmails = [];

      for (const email of emailCandidates) {
        const emailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (emailLike && !finalParticipants.includes(email)) {
          validEmails.push(email);
        } else if (!emailLike) {
          invalidEmails.push(email);
        }
      }

      if (invalidEmails.length > 0) {
        toast.error(`Invalid email format: ${invalidEmails.join(', ')}`);
        return;
      }

      if (validEmails.length > 0) {
        finalParticipants.push(...validEmails);
        // Clear the input for UI feedback
        setFormData((prev) => ({ ...prev, participantInput: '' }));
      }
    }

    setLoading(true);
    const meetingData = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      localDate,
      localTime,
      duration: formData.duration,
      participants: finalParticipants,
      privacy: formData.privacy,
      inviteEmails: finalParticipants,
      hostEmail: user?.email,
      timeZone: formData.timeZone,
      ...(teamId && { teamId }),
      ...(teamId && {
        autoIncludeTeamMembers: formData.autoIncludeTeamMembers ?? true,
      }),
      ...(formData.recurrence?.enabled && {
        recurrence: {
          frequency:
            formData.recurrence.pattern === 'monthly'
              ? 'monthlyByDate'
              : formData.recurrence.pattern === 'yearly'
                ? 'yearlyByDate'
                : formData.recurrence.pattern,
          interval: formData.recurrence.interval,
          weekdays: formData.recurrence.daysOfWeek,
          dayOfMonth: formData.recurrence.dayOfMonth,
          end:
            formData.recurrence.endType === 'after'
              ? { type: 'count', count: formData.recurrence.occurrences }
              : formData.recurrence.endType === 'on' && formData.recurrence.endDate
                ? {
                    type: 'until',
                    localDate: [
                      formData.recurrence.endDate.getFullYear(),
                      String(formData.recurrence.endDate.getMonth() + 1).padStart(2, '0'),
                      String(formData.recurrence.endDate.getDate()).padStart(2, '0'),
                    ].join('-'),
                  }
                : { type: 'never' },
        },
      }),
    };

    try {
      const response = await api.post(`/api/meetings`, meetingData, {
        headers: {
          'x-meeting-v2': 'true',
          'Idempotency-Key': crypto.randomUUID(),
        },
      });
      const result = extractData<{ meetingId: string }>(response);

      toast.success('Meeting created successfully!');
      onSuccess?.(result.meetingId);
      resetForm();
    } catch (error) {
      toast.error(extractError(error) || 'Failed to create meeting. Please try again.');
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
    handleRecurrenceChange,
    handleAutoIncludeChange,
    handleParticipantInput,
    handleKeyPress,
    removeLastParticipant,
    removeParticipant,
    handleSubmit,
  };
};
