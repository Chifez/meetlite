import { createUserModel } from './models/User.js';

// Export all shared models and utilities
export { default as User, createUserModel } from './models/User.js';
export { default as connectionPool } from './utils/connectionPool.js';
export * from './utils/queryHelpers.js';

// Create a factory for all shared models
export const createModelFactory = (connection) => ({
  User: createUserModel(connection),
  // Add more shared models here as they're created
  // Meeting: createMeetingModel(connection),
  // Room: createRoomModel(connection),
});
