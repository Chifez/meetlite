import {
  Home,
  Users,
  Video,
  BarChart3,
  Building2,
  Settings,
  Film,
  Bell,
} from 'lucide-react';
import type { NavigationItem } from './types';

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: Home, available: true },
  {
    path: '/members',
    label: 'Members',
    icon: Users,
    available: true,
    organizationOnly: true,
  },
  { path: '/meetings', label: 'Meetings', icon: Video, available: true },
  {
    path: '/recordings',
    label: 'Recordings',
    icon: Film,
    available: true,
  },

  {
    path: '/notifications',
    label: 'Notifications',
    icon: Bell,
    available: true,
  },
  { path: '/analytics', label: 'Analytics', icon: BarChart3, available: true },
  {
    path: '/organization',
    label: 'Organization',
    icon: Building2,
    available: true,
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: Settings,
    available: true,
    children: [
      { path: '/settings/profile', label: 'Profile', available: true },
      { path: '/settings/organization', label: 'Workspace', available: true, organizationOnly: true },
      { path: '/settings/plan', label: 'Plan & Billing', available: true },
      { path: '/settings/notifications', label: 'Notifications', available: true },
    ]
  },
];

export const NAV_LINKS = [
  { label: 'Features', href: '#features' },

  { label: 'Testimonials', href: '#testimonials' },
  { label: 'Compare', href: '#comparison' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Contact', href: '#contact' },
];

export const WORKSPACE_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;

export const SOCKET_EVENTS = {
  // Connection & Room
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  ERROR: 'error',
  READY: 'ready',
  USER_JOINED: 'user-joined',
  PARTICIPANT_JOINED: 'participant-joined',
  USER_LEFT: 'user-left',
  ROOM_DATA: 'room-data',
  
  // Media & ScreenShare
  MEDIA_STATE_CHANGE: 'media-state-change',
  MEDIA_STATE_UPDATE: 'media-state-update',
  SCREEN_SHARE_STARTED: 'screen-share-started',
  SCREEN_SHARE_STOPPED: 'screen-share-stopped',
  
  // Recording
  RECORDING_STATUS: 'recording:status',
  RECORDING_START: 'recording:start',
  RECORDING_STARTED: 'recording:started',
  RECORDING_STOP: 'recording:stop',
  RECORDING_STOPPED: 'recording:stopped',
  RECORDING_FINALIZE: 'recording:finalize',
  RECORDING_FINALIZED: 'recording:finalized',
  RECORDING_START_ERROR: 'recording:start-error',
  RECORDING_STOP_ERROR: 'recording:stop-error',

  // Collaboration
  COLLAB_REQUEST_STATE: 'collaboration:request-state',
  COLLAB_MODE: 'collaboration:mode',
  COLLAB_STATE: 'collaboration:state',
  COLLAB_MODE_CHANGED: 'collaboration:mode-changed',
  
  // Workflow
  WORKFLOW_AWARENESS: 'workflow:awareness',
  WORKFLOW_REQUEST_SYNC: 'workflow:request-sync',
  WORKFLOW_OPERATION: 'workflow:operation',
  
  // Whiteboard
  WHITEBOARD_REQUEST_SYNC: 'whiteboard:request-sync',
  WHITEBOARD_UPDATE: 'whiteboard:update',
  
  // Code
  CODE_REQUEST_SYNC: 'code:request-sync',
  CODE_LANGUAGE_CHANGE: 'code:language-change',
  
  // Presentation
  PRESENTATION_START: 'presentation:start',

  // YJS
  YJS_UPDATE: 'yjs:update',
  YJS_AWARENESS: 'yjs:awareness',
  YJS_SYNC_STEP1: 'yjs:sync-step1',
  YJS_SYNC_STEP2: 'yjs:sync-step2',

  // P2P WebRTC Fallbacks
  P2P_CALL_USER: 'p2p:call-user',
  P2P_ANSWER_MADE: 'p2p:answer-made',
  P2P_ICE_CANDIDATE: 'p2p:ice-candidate',
  INITIATE_CONNECTION: 'initiate-connection',

  // MediaSoup specific
  MEDIASOUP_CREATE_TRANSPORT: 'mediasoup:create-transport',
  MEDIASOUP_CONNECT_TRANSPORT: 'mediasoup:connect-transport',
  MEDIASOUP_CREATE_PRODUCER: 'mediasoup:create-producer',
  MEDIASOUP_CREATE_CONSUMER: 'mediasoup:create-consumer',
  CONSUMER_CREATED: 'consumer-created',
  NEW_PRODUCER: 'new-producer',
} as const;

export const COLLABORATION_MODES = {
  NONE: 'none',
  WORKFLOW: 'workflow',
  WHITEBOARD: 'whiteboard',
  CODE: 'code',
} as const;

export const ACTIVITY_TYPES = {
  MEETING_SCHEDULED: 'MEETING_SCHEDULED',
  QUICK_MEETING_STARTED: 'QUICK_MEETING_STARTED',
  MEETING_JOINED: 'MEETING_JOINED',
  MEMBER_INVITED: 'MEMBER_INVITED',
  MEMBER_JOINED: 'MEMBER_JOINED',
  MEMBER_REMOVED: 'MEMBER_REMOVED',
} as const;

export const RECORDING_STATUSES = {
  IDLE: 'idle',
  STARTING: 'starting',
  RECORDING: 'recording',
  STOPPING: 'stopping',
  PROCESSING: 'processing',
  ERROR: 'error',
} as const;
