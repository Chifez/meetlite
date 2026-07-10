export type TeamMember = {
  userId: string;
  userName: string;
  userEmail: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
};

export type TeamSettings = {
  allowPublicMeetings?: boolean;
  requireMeetingApproval?: boolean;
  maxMeetingDuration?: number;
  allowExternalParticipants?: boolean;
  defaultMeetingPrivacy?: 'public' | 'private';
};

export type TeamStats = {
  totalMembers?: number;
  totalMeetings?: number;
  totalMeetingHours?: number;
  totalRecordings?: number;
  lastActivity?: string;
};

export type Team = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  logo?: string;
  organizationId: string;
  ownerId: string;
  ownerName?: string;
  members: TeamMember[];
  memberCount?: number;
  settings?: TeamSettings;
  stats?: TeamStats;
  status?: 'active' | 'archived' | 'deleted';
  createdAt?: string;
  updatedAt?: string;
  role?: 'owner' | 'admin' | 'member';
};

export type CreateTeamRequest = {
  name: string;
  description?: string;
  slug?: string;
  logo?: string;
  settings?: TeamSettings;
};

export type UpdateTeamRequest = {
  name?: string;
  description?: string;
  logo?: string;
  settings?: TeamSettings;
};
