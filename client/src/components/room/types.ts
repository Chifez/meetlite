import { Socket } from 'socket.io-client';

export interface PeerConnection {
  id: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
  isLoading?: boolean;
}

export interface MediaState {
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export interface RoomData {
  participants: string[];
  mediaState: Record<string, MediaState>;
  participantInfo?: Record<
    string,
    {
      email: string;
      userId: string;
    }
  >;
}

export interface VideoParticipantProps {
  stream: MediaStream | null;
  mediaState: MediaState;
  isLocal: boolean;
  isLoading?: boolean;
  userEmail?: string;
  userName?: string;
}

export interface RoomContextType {
  socket: Socket | null;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  peers: Map<string, PeerConnection>;
  screenPeers: Map<string, PeerConnection>;
  audioEnabled: boolean;
  videoEnabled: boolean;
  peerMediaState: Map<string, MediaState>;
  isScreenSharing: boolean;
  screenSharingUser: string | null;
  getParticipantEmail: (userId: string) => string | undefined;
  toggleAudio: () => void;
  toggleVideo: () => void;
  leaveMeeting: () => void;
  shareScreen: () => Promise<void>;
}

export interface Participant {
  id: string;
  stream: MediaStream | null;
  mediaState: {
    audioEnabled: boolean;
    videoEnabled: boolean;
  };
  isLocal: boolean;
  isLoading: boolean;
  userEmail?: string;
  userName?: string;
}

// For audio visualization
export interface AudioLevel {
  userId: string;
  level: number; // 0-100
  userEmail?: string;
}
