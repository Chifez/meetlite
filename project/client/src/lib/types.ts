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