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
  version?: number;
  lastModified?: Date;
  lastModifiedBy?: string;
}

export interface WhiteboardData {
  version: number;
  lastModified?: Date;
  lastModifiedBy?: string;
}

export interface CodeData {
  code: string;
  language: string;
  version: number;
  lastModified?: Date;
  lastModifiedBy?: string | null;
}

export interface CodeUpdate {
  code: string;
  language?: string;
  version: number;
  timestamp: number;
  userId: string;
}

export interface CollaborationState {
  mode: 'none' | 'workflow' | 'whiteboard' | 'code';
  activeTool: 'none' | 'workflow' | 'whiteboard' | 'code';
  workflowData: WorkflowData | null;
  whiteboardData: WhiteboardData | null;
  codeData: CodeData | null;
  screenSharingUserId: string | null;
  // New presenter-related fields
  presenter: {
    userId: string | null;
    mode: 'workflow' | 'whiteboard' | 'code' | null;
    collaborationSettings: {
      mode: 'view-only' | 'allow-edit' | 'selective-edit';
      allowedUsers: string[];
    };
  };
}

export interface WorkflowOperation {
  type:
    | 'add_node'
    | 'update_node'
    | 'delete_node'
    | 'add_edge'
    | 'delete_edge'
    | 'update_edge';
  node?: Node;
  nodeId?: string;
  data?: Partial<Node>;
  edge?: Edge;
  edgeId?: string;
  edgeData?: Partial<Edge>;
  version?: number;
  timestamp?: number;
  userId?: string;
}

export interface WhiteboardUpdate {
  version: number;
  data: unknown;
}

// Extend Socket type to include user property
export interface ExtendedSocket extends Socket {
  user?: {
    id: string;
    userId: string;
    email: string;
  };
}

export interface RoomContextType {
  socket: ExtendedSocket | null;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  peers: Map<string, PeerConnection>;
  screenPeers: Map<string, PeerConnection>;
  audioEnabled: boolean;
  videoEnabled: boolean;
  peerMediaState: Map<string, MediaState>;
  isScreenSharing: boolean;
  screenSharingUser: string | null;
  isMediaSoupConnected: boolean;
  getParticipantEmail: (userId: string) => string | undefined;
  getParticipantDisplayName: (userId: string) => string | undefined;
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
  changeCollaborationMode: (
    mode: 'none' | 'workflow' | 'whiteboard' | 'code'
  ) => void;
  sendWorkflowOperation: (operation: WorkflowOperation) => void;
  sendWhiteboardUpdate: (update: WhiteboardUpdate) => void;
  // REMOVED: sendCodeUpdate - Code synchronization now handled by pure YJS
  changeCodeLanguage: (language: string) => void;
  requestCodeSync: () => void;
  // Presenter functionality
  startPresenting: (mode: 'workflow' | 'whiteboard' | 'code') => void;
  stopPresenting: () => void;
  updateCollaborationSettings: (settings: {
    mode: 'view-only' | 'allow-edit' | 'selective-edit';
    allowedUsers?: string[];
  }) => void;
  canEdit: (userId: string) => boolean;
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
