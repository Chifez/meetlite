import { Socket } from 'socket.io-client';

export interface PeerConnection {
  id: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

export interface MediaState {
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export interface RoomData {
  participants: string[];
  mediaState: Record<string, MediaState>;
}

export interface RoomControlsProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  participantCount: number;
  onRefreshConnection: () => void;
  onReturnToLobby: () => void;
}

export interface VideoGridProps {
  localStream: MediaStream | null;
  peers: Map<string, PeerConnection>;
  peerMediaState: Map<string, MediaState>;
  videoEnabled: boolean;
}

export interface VideoParticipantProps {
  stream: MediaStream | null;
  mediaState: MediaState;
  isLocal: boolean;
}

export interface RoomContextType {
  socket: Socket | null;
  localStream: MediaStream | null;
  peers: Map<string, PeerConnection>;
  audioEnabled: boolean;
  videoEnabled: boolean;
  participantCount: number;
  peerMediaState: Map<string, MediaState>;
  toggleAudio: () => void;
  toggleVideo: () => void;
  leaveMeeting: () => void;
  shareScreen: () => void;
}
