import { createUserModel } from './models/user.js';
import { createOrganizationModel } from './models/organization.js';
import { createOrganizationInvitationModel } from './models/organization-invitation.js';
import { createMeetingRecordingModel } from './models/meeting-assets.js';
import { createPushSubscriptionModel } from './models/push-subscription.js';
import { createTeamModel } from './models/team.js';
import { createTeamInvitationModel } from './models/team-invitation.js';
import { createNotificationModel } from './models/notification.js';
import { createAuditLogModel } from './models/audit-log.js';

// Export all shared models and utilities
export { default as User, createUserModel } from './models/user.js';
export {
  default as Organization,
  createOrganizationModel,
} from './models/organization.js';
export {
  default as OrganizationInvitation,
  createOrganizationInvitationModel,
} from './models/organization-invitation.js';
export {
  default as MeetingRecording,
  createMeetingRecordingModel,
} from './models/meeting-assets.js';
export {
  default as PushSubscription,
  createPushSubscriptionModel,
} from './models/push-subscription.js';
export { default as Team, createTeamModel } from './models/team.js';
export {
  default as TeamInvitation,
  createTeamInvitationModel,
} from './models/team-invitation.js';
export {
  default as Notification,
  createNotificationModel,
} from './models/notification.js';
export {
  default as AuditLog,
  createAuditLogModel,
} from './models/audit-log.js';
export { default as connectionPool } from './utils/connection-pool.js';
export * from './utils/query-helpers.js';
export * from './config/plans.js';
export * from './constants/error-codes.js';
export { AppError } from './utils/app-error.js';
export { PlanValidationService } from './services/plan-validation.service.js';
export { emailService } from './services/email.service.js';
export * from './templates/email-templates.js';
export * from './templates/template-adapters.js';
export * from './utils/response-format.js';

// Export queue infrastructure
export * from './queues/base/base-queue.js';
export * from './queues/base/base-worker.js';
export * from './queues/base/queue-manager.js';
export * from './queues/types/notification-queue.js';
export * from './queues/types/notification-worker.js';
export * from './queues/types/email-queue.js';
export * from './queues/types/email-worker.js';
export * from './queues/types/video-processing-queue.js';
export * from './queues/utils/encryption.js';
export * from './queues/utils/job-helpers.js';

// Create a factory for all shared models
export const createModelFactory = (connection) => ({
  User: createUserModel(connection),
  Organization: createOrganizationModel(connection),
  OrganizationInvitation: createOrganizationInvitationModel(connection),
  MeetingRecording: createMeetingRecordingModel(connection),
  PushSubscription: createPushSubscriptionModel(connection),
  Team: createTeamModel(connection),
  TeamInvitation: createTeamInvitationModel(connection),
  Notification: createNotificationModel(connection),
  AuditLog: createAuditLogModel(connection),
  // Add more shared models here as they're created
  // Meeting: createMeetingModel(connection),
  // Room: createRoomModel(connection),
});
