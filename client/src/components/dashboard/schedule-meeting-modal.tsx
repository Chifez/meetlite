import React from 'react';
import SmartSchedulingModal from '@/components/dashboard/smart-scheduling-modal';
import { MeetingFormData } from '@/lib/types';

interface ScheduleMeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: MeetingFormData;
  formLoading: boolean;
  onInputChange: (e: any) => void;
  onDateChange: (date: any) => void;
  onTimeChange: (time: any) => void;
  onPrivacyChange: (privacy: any) => void;
  onRecurrenceChange?: (recurrence: any) => void;
  onParticipantInput: (e: any) => void;
  onRemoveParticipant: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  onCancel: () => void;
  teamId?: string;
  teamName?: string;
  onAutoIncludeChange?: (checked: boolean) => void;
}

export default function ScheduleMeetingModal(props: ScheduleMeetingModalProps) {
  return <SmartSchedulingModal {...props} />;
}
