export const SocketEvents = {
  // Room lifecycle
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
  ROOM_DATA: 'room-data',
  PEER_JOINED: 'peer-joined',
  PEER_LEFT: 'peer-left',

  // MediaSoup
  MEDIASOUP_CREATE_TRANSPORT: 'mediasoup:create-transport',
  MEDIASOUP_CONNECT_TRANSPORT: 'mediasoup:connect-transport',
  MEDIASOUP_CREATE_PRODUCER: 'mediasoup:create-producer',
  MEDIASOUP_CREATE_CONSUMER: 'mediasoup:create-consumer',
  TRANSPORT_CREATED: 'transport-created',
  TRANSPORT_CONNECTED: 'transport-connected',
  PRODUCER_CREATED: 'producer-created',
  CONSUMER_CREATED: 'consumer-created',

  // Media state
  MEDIA_STATE_CHANGED: 'media-state-changed',
  SCREEN_SHARE_STARTED: 'screen-share-started',
  SCREEN_SHARE_STOPPED: 'screen-share-stopped',

  // Collaboration
  COLLAB_JOIN: 'collaboration:join',
  COLLAB_LEAVE: 'collaboration:leave',
  COLLAB_STATE_UPDATE: 'collaboration:state-update',

  // Recording
  RECORDING_STARTED: 'recording:started',
  RECORDING_STOPPED: 'recording:stopped',
  RECORDING_CHUNK: 'recording:chunk',

  // Chat
  CHAT_MESSAGE: 'chat:message',
  CHAT_HISTORY: 'chat:history',
} as const;

export type SocketEvent = typeof SocketEvents[keyof typeof SocketEvents];
