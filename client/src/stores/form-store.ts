import { create } from 'zustand';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { extractData } from '@/lib/api-response';
import { getUserTimeZone } from '@/lib/timezones';

export interface MeetingFormData {
  title: string;
  description: string;
  date: Date | undefined;
  time: string;
  timeZone: string;
  duration: number;
  privacy: 'public' | 'private';
  participants: string[];
  participantInput: string;
}

interface FormState {
  // Form data
  formData: MeetingFormData;
  loading: boolean;

  // Modal state
  showScheduleModal: boolean;

  // Actions
  setFormData: (data: Partial<MeetingFormData>) => void;
  resetForm: () => void;
  setLoading: (loading: boolean) => void;

  // Form handlers
  handleInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  handleDateChange: (date: Date | undefined) => void;
  handleTimeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handlePrivacyChange: (value: 'public' | 'private') => void;
  handleParticipantInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeParticipant: (value: string) => void;

  // Modal actions
  openScheduleModal: () => void;
  closeScheduleModal: () => void;

  // Submit action
  handleSubmit: (
    onSuccess?: (meetingId: string) => void,
    teamId?: string
  ) => Promise<void>;
}

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
};

export const useFormStore = create<FormState>((set, get) => ({
  // Initial state
  formData: initialFormData,
  loading: false,
  showScheduleModal: false,

  // State setters
  setFormData: (data) =>
    set((state) => ({
      formData: { ...state.formData, ...data },
    })),
  resetForm: () => set({ formData: initialFormData }),
  setLoading: (loading) => set({ loading }),

  // Form handlers
  handleInputChange: (e) => {
    const { name, value } = e.target;
    set((state) => ({
      formData: { ...state.formData, [name]: value },
    }));
  },

  handleDateChange: (date) => {
    set((state) => ({
      formData: { ...state.formData, date },
    }));
  },

  handleTimeChange: (e) => {
    set((state) => ({
      formData: { ...state.formData, time: e.target.value },
    }));
  },

  handlePrivacyChange: (value) => {
    set((state) => ({
      formData: { ...state.formData, privacy: value },
    }));
  },

  handleParticipantInput: (e) => {
    const value = e.target.value.trim();
    if (value && !get().formData.participants.includes(value)) {
      set((state) => ({
        formData: {
          ...state.formData,
          participants: [...state.formData.participants, value],
          participantInput: '',
        },
      }));
    } else {
      set((state) => ({
        formData: { ...state.formData, participantInput: '' },
      }));
    }
  },

  removeParticipant: (value) => {
    set((state) => ({
      formData: {
        ...state.formData,
        participants: state.formData.participants.filter((p) => p !== value),
      },
    }));
  },

  // Modal actions
  openScheduleModal: () => set({ showScheduleModal: true }),
  closeScheduleModal: () => set({ showScheduleModal: false }),

  // Submit action
  handleSubmit: async (onSuccess, teamId) => {
    const { formData } = get();

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

    set({ loading: true });

    const meetingData = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      localDate,
      localTime: formData.time.length === 5 ? `${formData.time}:00` : formData.time,
      timeZone: formData.timeZone,
      duration: formData.duration,
      participants: formData.participants,
      privacy: formData.privacy,
      inviteEmails: formData.participants,
      hostEmail: '', // Will be set from auth context when used
      ...(teamId && { teamId }),
    };

    try {
      const response = await api.post(`/api/meetings`, meetingData, {
        headers: { 'x-meeting-v2': 'true', 'Idempotency-Key': crypto.randomUUID() },
      });
      const result = extractData<{ meetingId: string }>(response);
      toast.success('Meeting created successfully!');
      onSuccess?.(result.meetingId);
      get().resetForm();
      get().closeScheduleModal();
    } catch (error) {
      toast.error('Failed to create meeting');
      console.error('Create meeting error:', error);
    } finally {
      set({ loading: false });
    }
  },
}));
