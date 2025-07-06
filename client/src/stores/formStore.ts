import { create } from 'zustand';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { env } from '@/config/env';

export interface MeetingFormData {
  title: string;
  description: string;
  date: Date | undefined;
  time: string;
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
  handleSubmit: (onSuccess?: (meetingId: string) => void) => Promise<void>;
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
  handleSubmit: async (onSuccess) => {
    const { formData } = get();

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

    set({ loading: true });

    const meetingData = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      scheduledTime,
      duration: formData.duration,
      participants: formData.participants,
      privacy: formData.privacy,
      inviteEmails: formData.participants,
      hostEmail: '', // Will be set from auth context when used
    };

    try {
      const response = await api.post(
        `${env.ROOM_API_URL}/meetings`,
        meetingData
      );
      toast.success('Meeting created successfully!');
      onSuccess?.(response.data.meetingId);
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
