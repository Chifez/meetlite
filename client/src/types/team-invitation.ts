export type TeamInvitation = {
  id: string;
  teamId: string;
  teamName?: string;
  organizationId: string;
  invitedUserId: string;
  invitedUserName?: string;
  invitedBy: string;
  inviterName?: string;
  role: 'member' | 'owner';
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  inviteToken: string;
  message?: string;
  expiresAt: string;
  acceptedAt?: string;
  acceptedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateTeamInvitationRequest = {
  invitedUserId: string;
  role?: 'member' | 'owner';
  message?: string;
};

export type CreateTeamRequest = {
  name: string;
  description?: string;
  logo?: string;
  settings?: {
    allowPublicMeetings?: boolean;
    requireMeetingApproval?: boolean;
    maxMeetingDuration?: number;
    allowExternalParticipants?: boolean;
    defaultMeetingPrivacy?: 'public' | 'private';
  };
};

export type UpdateTeamRequest = {
  name?: string;
  description?: string;
  logo?: string;
  settings?: Partial<{
    allowPublicMeetings: boolean;
    requireMeetingApproval: boolean;
    maxMeetingDuration: number;
    allowExternalParticipants: boolean;
    defaultMeetingPrivacy: 'public' | 'private';
  }>;
};
