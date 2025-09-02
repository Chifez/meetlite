export type Organization = {
  id: string;
  name: string;
  slug?: string;
  logo?: string;
  industry?: string;
  members: any[];
  memberCount?: number;
  size?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  plan?: {
    type: 'free' | 'pro' | 'enterprise';
    startDate?: Date;
    endDate?: Date | null;
    status?: 'active' | 'expired' | 'cancelled';
  };
  role?: 'owner' | 'member';
  settings?: {
    allowPublicMeetings?: boolean;
    requireMeetingApproval?: boolean;
    maxMeetingDuration?: number;
    allowExternalParticipants?: boolean;
    defaultMeetingPrivacy?: 'public' | 'private';
  };
  createdAt?: string;
};
