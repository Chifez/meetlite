import { createUserModel } from './models/User.js';
import { createOrganizationModel } from './models/Organization.js';
import { createOrganizationInvitationModel } from './models/OrganizationInvitation.js';
import { createMeetingRecordingModel } from './models/MeetingAssets.js';
import { createPushSubscriptionModel } from './models/PushSubscription.js';
import { createTeamModel } from './models/Team.js';
import { createTeamInvitationModel } from './models/TeamInvitation.js';
import { createNotificationModel } from './models/Notification.js';
import { createAuditLogModel } from './models/AuditLog.js';

// Export all shared models and utilities
export { default as User, createUserModel } from './models/User.js';
export {
  default as Organization,
  createOrganizationModel,
} from './models/Organization.js';
export {
  default as OrganizationInvitation,
  createOrganizationInvitationModel,
} from './models/OrganizationInvitation.js';
export {
  default as MeetingRecording,
  createMeetingRecordingModel,
} from './models/MeetingAssets.js';
export {
  default as PushSubscription,
  createPushSubscriptionModel,
} from './models/PushSubscription.js';
export { default as Team, createTeamModel } from './models/Team.js';
export {
  default as TeamInvitation,
  createTeamInvitationModel,
} from './models/TeamInvitation.js';
export {
  default as Notification,
  createNotificationModel,
} from './models/Notification.js';
export { default as AuditLog, createAuditLogModel } from './models/AuditLog.js';
export { default as connectionPool } from './utils/connectionPool.js';
export * from './utils/queryHelpers.js';
export * from './config/plans.js';
export * from './constants/errorCodes.js';
export { AppError } from './utils/AppError.js';
export { PlanValidationService } from './services/plan-validation.service.js';
export * from './utils/response-format.js';

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
