/**
 * Helper function to determine who should initiate the connection
 * Uses lexicographic ordering to ensure consistent initiator selection
 */
export const shouldInitiateConnection = (userA, userB) => {
  return userA < userB;
};

/**
 * Helper function to create a unique connection key for two users
 * The key is the same regardless of the order of users
 */
export const createConnectionKey = (userA, userB) => {
  return [userA, userB].sort().join('_');
};

/**
 * Helper function to create a unique screen sharing connection key
 * The key is the same regardless of the order of users
 */
export const createScreenConnectionKey = (userA, userB) => {
  return `screen_${[userA, userB].sort().join('_')}`;
};
