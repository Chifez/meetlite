import { Connection } from 'mongoose';
import { createUserModel } from './models/user.js';
import { createOrganizationModel } from './models/organization.js';
import { createOrganizationInvitationModel } from './models/organization-invitation.js';
import { createMeetingRecordingModel } from './models/meeting-assets.js';
import { createPushSubscriptionModel } from './models/push-subscription.js';
import { createTeamModel } from './models/team.js';
import { createTeamInvitationModel } from './models/team-invitation.js';
import { createNotificationModel } from './models/notification.js';
import { createAuditLogModel } from './models/audit-log.js';
import { createMeetingModel } from './models/meeting.js';

// Export all shared models and types
export * from './models/user.js';
export { default as User, createUserModel } from './models/user.js';
export * from './models/organization.js';
export {
  default as Organization,
  createOrganizationModel,
} from './models/organization.js';
export * from './models/organization-invitation.js';
export {
  default as OrganizationInvitation,
  createOrganizationInvitationModel,
} from './models/organization-invitation.js';
export * from './models/meeting-assets.js';
export {
  default as MeetingRecording,
  createMeetingRecordingModel,
} from './models/meeting-assets.js';
export * from './models/push-subscription.js';
export {
  default as PushSubscription,
  createPushSubscriptionModel,
} from './models/push-subscription.js';
export * from './models/team.js';
export { default as Team, createTeamModel } from './models/team.js';
export * from './models/team-invitation.js';
export {
  default as TeamInvitation,
  createTeamInvitationModel,
} from './models/team-invitation.js';
export * from './models/notification.js';
export {
  default as Notification,
  createNotificationModel,
} from './models/notification.js';
export * from './models/audit-log.js';
export {
  default as AuditLog,
  createAuditLogModel,
} from './models/audit-log.js';
export * from './models/meeting.js';
export { default as Meeting, createMeetingModel } from './models/meeting.js';
export {
  default as EnterpriseInquiry,
  EnterpriseInquiry as EnterpriseInquiryModel,
} from './models/enterprise-inquiry.js';
export * from './models/enterprise-inquiry.js';

export { default as connectionPool } from './utils/connection-pool.js';
export * from './utils/query-helpers.js';
export * from './config/plans.js';
export * from './constants/error-codes.js';
export { AppError } from './utils/app-error.js';
export { PlanValidationService } from './services/plan-validation.service.js';
export { emailService } from './services/email.service.js';
export * from './templates/email-templates.js';
export {
  adaptTemplate,
  adaptWelcomeTemplate,
  adaptPasswordResetTemplate,
  adaptOrganizationInviteTemplate,
  adaptTeamInviteTemplate,
  adaptMeetingInviteTemplate,
  adaptMeetingReminderTemplate,
  adaptPlanEmailTemplate,
  adaptPlanExpirationWarningTemplate,
} from './templates/template-adapters.js';
export * from './utils/response-format.js';
export { createLogger } from './utils/logger.js';

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
export const createModelFactory = (connection: Connection) => ({
  User: createUserModel(connection),
  Organization: createOrganizationModel(connection),
  OrganizationInvitation: createOrganizationInvitationModel(connection),
  MeetingRecording: createMeetingRecordingModel(connection),
  PushSubscription: createPushSubscriptionModel(connection),
  Team: createTeamModel(connection),
  TeamInvitation: createTeamInvitationModel(connection),
  Notification: createNotificationModel(connection),
  AuditLog: createAuditLogModel(connection),
  Meeting: createMeetingModel(connection),
});

export * from './events/socket-events.js';
export * from './events/event-bus.js';
