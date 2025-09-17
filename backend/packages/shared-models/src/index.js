import { createUserModel } from './models/User.js';
import { createOrganizationModel } from './models/Organization.js';
import { createOrganizationInvitationModel } from './models/OrganizationInvitation.js';
import { createMeetingRecordingModel } from './models/MeetingAssets.js';

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
export { default as connectionPool } from './utils/connectionPool.js';
export * from './utils/queryHelpers.js';
export * from './config/plans.js';
export * from './constants/errorCodes.js';
export { AppError } from './utils/AppError.js';

// Create a factory for all shared models
export const createModelFactory = (connection) => ({
  User: createUserModel(connection),
  Organization: createOrganizationModel(connection),
  OrganizationInvitation: createOrganizationInvitationModel(connection),
  MeetingRecording: createMeetingRecordingModel(connection),
  // Add more shared models here as they're created
  // Meeting: createMeetingModel(connection),
  // Room: createRoomModel(connection),
});
