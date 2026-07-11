export const WORKSPACE_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
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
  COMPLETED: 'completed',
  ERROR: 'error',
} as const;
