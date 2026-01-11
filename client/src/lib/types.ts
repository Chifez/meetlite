// User types
export interface User {
  id: string;
  email: string;
}

// Room types
export interface Room {
  id: string;
  createdBy: string;
  createdAt: Date;
}

// API response types
export interface AuthResponse {
  token: string;
}

export interface RoomResponse {
  roomId: string;
}

// WebRTC types (for P2P fallback)
export interface WebRTCOffer {
  from: string;
  offer: RTCSessionDescriptionInit;
}

export interface WebRTCAnswer {
  from: string;
  answer: RTCSessionDescriptionInit;
}

export interface WebRTCCandidate {
  from: string;
  candidate: RTCIceCandidateInit;
}

export interface RoomData {
  participants: string[];
}

export interface Meeting {
  meetingId: string;
  title: string;
  description?: string;
  scheduledTime: string | Date;
  duration: number;
  createdBy?: string;
  participants: string[];
  privacy?: 'public' | 'private';
  status?: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  createdAt?: string;
  roomId?: string;
  teamId?: string;
  invites?: {
    email: string;
    status: 'pending' | 'accepted' | 'declined';
    inviteToken: string;
  }[];
  source?: 'google';
  externalId?: string;
  isRecurring?: boolean;
  recurrence?: {
    pattern: 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | 'custom';
    interval?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    endDate?: string | Date;
    occurrences?: number;
    endType: 'never' | 'after' | 'on';
    rrule?: string;
  };
  recurrenceId?: string;
  recurrenceExceptions?: Array<{
    date: string | Date;
    action: 'cancelled' | 'modified';
    modifiedMeetingId?: string;
  }>;
}

export interface MeetingFormData {
  title: string;
  description: string;
  date: Date | undefined;
  time: string;
  duration: number;
  privacy: 'public' | 'private';
  participants: string[];
  participantInput: string;
  autoIncludeTeamMembers?: boolean;
  recurrence?: {
    enabled: boolean;
    pattern: 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | 'custom';
    interval?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    endDate?: Date;
    occurrences?: number;
    endType: 'never' | 'after' | 'on';
  };
}

export interface InviteValidationResponse {
  valid: boolean;
  meeting: Meeting;
}

// Navigation types
export interface NavigationItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  available: boolean;
  organizationOnly?: boolean;
}

// Sidebar state types
export interface SidebarState {
  collapsed: boolean;
  mobileMenuOpen: boolean;
}

export type SidebarBreakpoint = 'mobile' | 'tablet' | 'desktop';
