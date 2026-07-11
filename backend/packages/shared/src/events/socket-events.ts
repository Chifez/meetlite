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
  PEER_JOINED: 'peer-joined',
  PEER_LEFT: 'peer-left',
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
  
  // Media & ScreenShare
  MEDIA_STATE_CHANGE: 'media-state-change',
  MEDIA_STATE_UPDATE: 'media-state-update',
  SCREEN_SHARE_STARTED: 'screen-share-started',
  SCREEN_SHARE_STOPPED: 'screen-share-stopped',
  MEDIA_STATE_CHANGED: 'media-state-changed',
  
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
  RECORDING_CHUNK: 'recording:chunk',

  // Collaboration
  COLLAB_REQUEST_STATE: 'collaboration:request-state',
  COLLAB_MODE: 'collaboration:mode',
  COLLAB_STATE: 'collaboration:state',
  COLLAB_MODE_CHANGED: 'collaboration:mode-changed',
  COLLAB_JOIN: 'collaboration:join',
  COLLAB_LEAVE: 'collaboration:leave',
  COLLAB_STATE_UPDATE: 'collaboration:state-update',
  
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
  TRANSPORT_CREATED: 'transport-created',
  TRANSPORT_CONNECTED: 'transport-connected',
  PRODUCER_CREATED: 'producer-created',

  // Chat
  CHAT_MESSAGE: 'chat:message',
  CHAT_HISTORY: 'chat:history',
} as const;

export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];
