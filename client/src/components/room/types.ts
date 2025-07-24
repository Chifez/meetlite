import { Socket } from 'socket.io-client';
import { ChatState } from '@/types/chat';
import { Node as FlowNode, Edge as FlowEdge } from '@xyflow/react';

export type Node = FlowNode;
export type Edge = FlowEdge;

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

export interface WorkflowData {
  nodes: Node[];
  edges: Edge[];
  lastModified?: Date;
  lastModifiedBy?: string;
}

export interface WhiteboardData {
  version: number;
  lastModified?: Date;
  lastModifiedBy?: string;
}

export interface CollaborationState {
  mode: 'none' | 'workflow' | 'whiteboard';
  activeTool: 'none' | 'workflow' | 'whiteboard';
  workflowData: WorkflowData | null;
  whiteboardData: WhiteboardData | null;
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
  // Chat functionality
  chatState: ChatState;
  sendMessage: (message: string) => void;
  toggleChatPanel: () => void;
  markChatAsRead: () => void;
  startTyping: () => void;
  stopTyping: () => void;
  // Collaboration functionality
  collaborationState: CollaborationState;
  changeCollaborationMode: (mode: 'none' | 'workflow' | 'whiteboard') => void;
  sendWorkflowOperation: (operation: any) => void;
  sendWhiteboardUpdate: (update: any) => void;
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
