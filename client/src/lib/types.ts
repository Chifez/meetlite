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

// Socket event types
export interface SignalingOffer {
  from: string;
  offer: RTCSessionDescriptionInit;
}

export interface SignalingAnswer {
  from: string;
  answer: RTCSessionDescriptionInit;
}

export interface SignalingCandidate {
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
  scheduledTime: string;
  duration: number;
  createdBy: string;
  participants: string[];
  privacy: 'public' | 'private';
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  createdAt: string;
  roomId?: string;
  invites: {
    email: string;
    status: 'pending' | 'accepted' | 'declined';
    inviteToken: string;
  }[];
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
}

export interface InviteValidationResponse {
  valid: boolean;
  meeting: Meeting;
}
