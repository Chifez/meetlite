import { apiUrl } from './index.js';

export const ENDPOINTS = {
  auth: {
    signup: () => apiUrl('/api/auth/signup'),

    login: () => apiUrl('/api/auth/login'),

    refresh: () => apiUrl('/api/auth/refresh'),

    validate: () => apiUrl('/api/auth/validate'),

    profile: () => apiUrl('/api/auth/profile'),

    updateProfile: () => apiUrl('/api/auth/profile'),

    googleAuth: () => apiUrl('/api/auth/google'),

    googleCallback: () => apiUrl('/api/auth/google/callback'),

    forgotPassword: () => apiUrl('/api/auth/forgot-password'),

    resetPassword: () => apiUrl('/api/auth/reset-password'),

    onboarding: () => apiUrl('/api/auth/onboarding'),
  },

  organizations: {
    list: () => apiUrl('/api/organizations'),

    create: () => apiUrl('/api/organizations'),

    get: (orgId) => apiUrl(`/api/organizations/${orgId}`),

    update: (orgId) => apiUrl(`/api/organizations/${orgId}`),

    delete: (orgId) => apiUrl(`/api/organizations/${orgId}`),

    addMember: (orgId) => apiUrl(`/api/organizations/${orgId}/members`),

    listMembers: (orgId) => apiUrl(`/api/organizations/${orgId}/members`),

    removeMember: (orgId, userId) =>
      apiUrl(`/api/organizations/${orgId}/members/${userId}`),

    updateMemberRole: (orgId, userId) =>
      apiUrl(`/api/organizations/${orgId}/members/${userId}/role`),
  },

  rooms: {
    create: () => apiUrl('/api/rooms'),

    get: (roomId) => apiUrl(`/api/rooms/${roomId}`),

    join: (roomId) => apiUrl(`/api/rooms/${roomId}/join`),

    updateCollaboration: (roomId) =>
      apiUrl(`/api/rooms/${roomId}/collaboration`),

    updateSettings: (roomId) => apiUrl(`/api/rooms/${roomId}/settings`),

    updateParticipantRole: (roomId, userId) =>
      apiUrl(`/api/rooms/${roomId}/participants/${userId}/role`),
  },

  meetings: {
    create: () => apiUrl('/api/meetings'),

    list: () => apiUrl('/api/meetings'),

    get: (meetingId) => apiUrl(`/api/meetings/${meetingId}`),

    update: (meetingId) => apiUrl(`/api/meetings/${meetingId}`),

    delete: (meetingId) => apiUrl(`/api/meetings/${meetingId}`),

    start: (meetingId) => apiUrl(`/api/meetings/${meetingId}/start`),

    complete: (meetingId) => apiUrl(`/api/meetings/${meetingId}/complete`),

    validateToken: (meetingId) =>
      apiUrl(`/api/meetings/${meetingId}/validate-token`),
  },

  recordings: {
    upload: () => apiUrl('/api/recordings'),

    list: () => apiUrl('/api/recordings'),

    get: (recordingId) => apiUrl(`/api/recordings/${recordingId}`),

    stream: (recordingId) => apiUrl(`/api/recordings/${recordingId}/stream`),

    download: (recordingId) =>
      apiUrl(`/api/recordings/${recordingId}/download`),

    update: (recordingId) => apiUrl(`/api/recordings/${recordingId}`),

    delete: (recordingId) => apiUrl(`/api/recordings/${recordingId}`),

    process: (recordingId) => apiUrl(`/api/recordings/${recordingId}/process`),

    share: (recordingId) => apiUrl(`/api/recordings/${recordingId}/share`),

    archive: (recordingId) => apiUrl(`/api/recordings/${recordingId}/archive`),

    unarchive: (recordingId) =>
      apiUrl(`/api/recordings/${recordingId}/unarchive`),

    status: (recordingId) => apiUrl(`/api/recordings/${recordingId}/status`),

    stats: () => apiUrl('/api/recordings/stats'),
  },

  calendar: {
    googleAuth: () => apiUrl('/api/calendar/google/auth'),

    googleCallback: () => apiUrl('/api/calendar/google/callback'),

    connectGoogle: () => apiUrl('/api/calendar/connect/google'),

    import: () => apiUrl('/api/calendar/import'),

    export: () => apiUrl('/api/calendar/export'),

    conflicts: () => apiUrl('/api/calendar/conflicts'),

    schedule: () => apiUrl('/api/calendar/schedule'),

    deleteEvent: (eventId) => apiUrl(`/api/calendar/events/${eventId}`),

    connected: () => apiUrl('/api/calendar/connected'),

    disconnect: () => apiUrl('/api/calendar/disconnect'),
  },

  payments: {
    createCheckout: () => apiUrl('/api/payment/create-checkout-session'),

    createBillingPortal: () => apiUrl('/api/payment/create-billing-portal'),

    success: () => apiUrl('/api/payment/success'),

    subscription: () => apiUrl('/api/payment/subscription'),

    webhook: () => apiUrl('/api/payment/webhook'),
  },

  ai: {
    description: () => apiUrl('/api/ai/description'),

    transcribe: () => apiUrl('/api/ai/transcribe'),

    suggest: () => apiUrl('/api/ai/suggest'),

    insights: (meetingId) => apiUrl(`/api/ai/insights/${meetingId}`),

    parseMeeting: () => apiUrl('/api/ai/parse-meeting'),
  },

  analytics: {
    organization: (organizationId) =>
      apiUrl(`/api/analytics/organization/${organizationId}`),

    recordingStats: () => apiUrl('/api/analytics/recordings/stats'),
  },

  pushNotifications: {
    vapidKey: () => apiUrl('/api/push-notifications/vapid-public-key'),

    subscribe: () => apiUrl('/api/push-notifications/subscribe'),

    unsubscribe: () => apiUrl('/api/push-notifications/unsubscribe'),

    subscriptions: () => apiUrl('/api/push-notifications/subscriptions'),

    send: () => apiUrl('/api/push-notifications/send'),
  },
};
