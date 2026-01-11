/**
 * Comprehensive Plan Configuration
 * Defines all plan types, constraints, and features for the application
 */

export const PLAN_TYPES = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
};

export const PLAN_CONSTRAINTS = {
  [PLAN_TYPES.FREE]: {
    // Organization Management
    maxOrganizationsOwned: 2, // How many orgs they can create/own
    maxOrganizationsMember: 5, // How many orgs they can be a member of
    maxTeamSize: 10, // Max members in orgs they own

    // Invitation Limits
    maxInvitationsPerDay: 5, // Daily invitation limit
    maxInvitationsPerMonth: 50, // Monthly invitation limit

    // Meeting & Video Calls
    maxConcurrentMeetings: 1, // Max simultaneous meetings
    maxMeetingDuration: 60, // Max meeting duration in minutes
    maxParticipantsPerMeeting: 10, // Max participants in a single meeting
    maxMeetingsPerDay: 10, // Max meetings per day
    maxMeetingsPerMonth: 100, // Max meetings per month

    // Storage & Files
    maxStorageGB: 1, // Max storage in GB
    maxFileSizeMB: 25, // Max file size in MB
    maxFilesPerMeeting: 10, // Max files per meeting

    // Features
    features: [
      'basic_meetings',
      'file_sharing',
      'screen_sharing',
      'chat_messaging',
      'meeting_recording_basic',
    ],

    // API & Integration Limits
    maxAPICallsPerDay: 1000, // Max API calls per day
    maxWebhooks: 5, // Max webhook integrations

    // Support
    supportLevel: 'community', // Support level
    responseTime: '72h', // Support response time

    // Branding
    customBranding: false, // Custom branding allowed
    whiteLabel: false, // White label allowed

    // Security
    sso: false, // Single Sign-On
    advancedSecurity: false, // Advanced security features

    // Analytics
    analytics: 'basic', // Analytics level
    reporting: 'basic', // Reporting level
    dataRetention: 30, // Data retention in days
  },

  [PLAN_TYPES.PRO]: {
    // Organization Management
    maxOrganizationsOwned: 10,
    maxOrganizationsMember: 50,
    maxTeamSize: 100,

    // Invitation Limits
    maxInvitationsPerDay: 50,
    maxInvitationsPerMonth: 500,

    // Meeting & Video Calls
    maxConcurrentMeetings: 5,
    maxMeetingDuration: 240, // 4 hours
    maxParticipantsPerMeeting: 100,
    maxMeetingsPerDay: 50,
    maxMeetingsPerMonth: 1000,

    // Storage & Files
    maxStorageGB: 100,
    maxFileSizeMB: 100,
    maxFilesPerMeeting: 50,

    // Features
    features: [
      'basic_meetings',
      'file_sharing',
      'screen_sharing',
      'chat_messaging',
      'meeting_recording_basic',
      'advanced_meetings',
      'breakout_rooms',
      'polls_surveys',
      'meeting_analytics',
      'custom_backgrounds',
      'waiting_rooms',
      'meeting_templates',
    ],

    // API & Integration Limits
    maxAPICallsPerDay: 10000,
    maxWebhooks: 25,

    // Support
    supportLevel: 'email',
    responseTime: '24h',

    // Branding
    customBranding: true,
    whiteLabel: false,

    // Security
    sso: false,
    advancedSecurity: true,

    // Analytics
    analytics: 'advanced',
    reporting: 'advanced',
    dataRetention: 365, // 1 year
  },

  [PLAN_TYPES.ENTERPRISE]: {
    // Organization Management
    maxOrganizationsOwned: -1, // Unlimited
    maxOrganizationsMember: -1, // Unlimited
    maxTeamSize: -1, // Unlimited

    // Invitation Limits
    maxInvitationsPerDay: -1, // Unlimited
    maxInvitationsPerMonth: -1, // Unlimited

    // Meeting & Video Calls
    maxConcurrentMeetings: -1, // Unlimited
    maxMeetingDuration: -1, // Unlimited
    maxParticipantsPerMeeting: -1, // Unlimited
    maxMeetingsPerDay: -1, // Unlimited
    maxMeetingsPerMonth: -1, // Unlimited

    // Storage & Files
    maxStorageGB: -1, // Unlimited
    maxFileSizeMB: -1, // Unlimited
    maxFilesPerMeeting: -1, // Unlimited

    // Features
    features: [
      'all_features',
      'custom_branding',
      'white_label',
      'sso',
      'advanced_security',
      'custom_integrations',
      'dedicated_support',
      'custom_analytics',
      'api_access',
      'webhook_integrations',
      'meeting_recording_advanced',
      'live_streaming',
      'webinar_features',
      'custom_meeting_rooms',
      'advanced_reporting',
      'data_export',
      'compliance_tools',
    ],

    // API & Integration Limits
    maxAPICallsPerDay: -1, // Unlimited
    maxWebhooks: -1, // Unlimited

    // Support
    supportLevel: 'dedicated',
    responseTime: '4h',

    // Branding
    customBranding: true,
    whiteLabel: true,

    // Security
    sso: true,
    advancedSecurity: true,

    // Analytics
    analytics: 'enterprise',
    reporting: 'enterprise',
    dataRetention: -1, // Unlimited
  },
};

export const PLAN_FEATURES = {
  // Meeting Features
  BASIC_MEETINGS: 'basic_meetings',
  ADVANCED_MEETINGS: 'advanced_meetings',
  BREAKOUT_ROOMS: 'breakout_rooms',
  POLLS_SURVEYS: 'polls_surveys',
  MEETING_ANALYTICS: 'meeting_analytics',
  CUSTOM_BACKGROUNDS: 'custom_backgrounds',
  WAITING_ROOMS: 'waiting_rooms',
  MEETING_TEMPLATES: 'meeting_templates',
  MEETING_RECORDING_BASIC: 'meeting_recording_basic',
  MEETING_RECORDING_ADVANCED: 'meeting_recording_advanced',
  LIVE_STREAMING: 'live_streaming',
  WEBINAR_FEATURES: 'webinar_features',
  CUSTOM_MEETING_ROOMS: 'custom_meeting_rooms',

  // File & Storage Features
  FILE_SHARING: 'file_sharing',
  SCREEN_SHARING: 'screen_sharing',

  // Communication Features
  CHAT_MESSAGING: 'chat_messaging',

  // Branding Features
  CUSTOM_BRANDING: 'custom_branding',
  WHITE_LABEL: 'white_label',

  // Security Features
  SSO: 'sso',
  ADVANCED_SECURITY: 'advanced_security',

  // Integration Features
  CUSTOM_INTEGRATIONS: 'custom_integrations',
  API_ACCESS: 'api_access',
  WEBHOOK_INTEGRATIONS: 'webhook_integrations',

  // Support Features
  DEDICATED_SUPPORT: 'dedicated_support',

  // Analytics Features
  CUSTOM_ANALYTICS: 'custom_analytics',
  ADVANCED_REPORTING: 'advanced_reporting',
  DATA_EXPORT: 'data_export',

  // Compliance Features
  COMPLIANCE_TOOLS: 'compliance_tools',

  // Catch-all
  ALL_FEATURES: 'all_features',
};

export const PLAN_SUPPORT_LEVELS = {
  COMMUNITY: 'community',
  EMAIL: 'email',
  DEDICATED: 'dedicated',
};

export const PLAN_ANALYTICS_LEVELS = {
  BASIC: 'basic',
  ADVANCED: 'advanced',
  ENTERPRISE: 'enterprise',
};

export const PLAN_REPORTING_LEVELS = {
  BASIC: 'basic',
  ADVANCED: 'advanced',
  ENTERPRISE: 'enterprise',
};

/**
 * Get plan constraints for a specific plan type
 * @param {string} planType - The plan type
 * @returns {Object} Plan constraints object
 */
export const getPlanConstraints = (planType) => {
  if (!PLAN_CONSTRAINTS[planType]) {
    throw new Error(`Invalid plan type: ${planType}`);
  }
  return PLAN_CONSTRAINTS[planType];
};

/**
 * Check if a plan has a specific feature
 * @param {string} planType - The plan type
 * @param {string} feature - The feature to check
 * @returns {boolean} Whether the plan has the feature
 */
export const hasFeature = (planType, feature) => {
  const constraints = getPlanConstraints(planType);
  return (
    constraints.features.includes(feature) ||
    constraints.features.includes(PLAN_FEATURES.ALL_FEATURES)
  );
};

/**
 * Check if a plan allows unlimited usage for a specific constraint
 * @param {string} planType - The plan type
 * @param {string} constraintKey - The constraint key to check
 * @returns {boolean} Whether the constraint is unlimited
 */
export const isUnlimited = (planType, constraintKey) => {
  const constraints = getPlanConstraints(planType);
  return constraints[constraintKey] === -1;
};

/**
 * Get the effective limit for a constraint (handles unlimited values)
 * @param {string} planType - The plan type
 * @param {string} constraintKey - The constraint key
 * @param {number} fallback - Fallback value if unlimited
 * @returns {number} The effective limit
 */
export const getEffectiveLimit = (
  planType,
  constraintKey,
  fallback = Number.MAX_SAFE_INTEGER
) => {
  const constraints = getPlanConstraints(planType);
  const limit = constraints[constraintKey];
  return limit === -1 ? fallback : limit;
};

/**
 * Validate if a usage value exceeds plan limits
 * @param {string} planType - The plan type
 * @param {string} constraintKey - The constraint key
 * @param {number} currentUsage - Current usage value
 * @returns {Object} Validation result with isValid and message
 */
export const validateUsage = (planType, constraintKey, currentUsage) => {
  const constraints = getPlanConstraints(planType);
  const limit = constraints[constraintKey];

  if (limit === -1) {
    return { isValid: true, message: 'Unlimited usage allowed' };
  }

  if (currentUsage >= limit) {
    return {
      isValid: false,
      message: `Usage limit exceeded. Current: ${currentUsage}, Limit: ${limit}`,
      currentUsage,
      limit,
      upgradeRequired: true,
    };
  }

  return { isValid: true, message: 'Usage within limits' };
};

/**
 * Get plan upgrade suggestions based on current usage
 * @param {string} currentPlan - Current plan type
 * @param {Object} usage - Current usage object
 * @returns {Array} Array of upgrade suggestions
 */
export const getUpgradeSuggestions = (currentPlan, usage) => {
  const suggestions = [];
  const currentConstraints = getPlanConstraints(currentPlan);

  // Check each constraint and suggest upgrades if needed
  Object.keys(currentConstraints).forEach((constraintKey) => {
    if (
      typeof currentConstraints[constraintKey] === 'number' &&
      currentConstraints[constraintKey] !== -1
    ) {
      const currentUsage = usage[constraintKey] || 0;
      if (currentUsage >= currentConstraints[constraintKey] * 0.8) {
        // 80% threshold
        suggestions.push({
          constraint: constraintKey,
          currentUsage,
          currentLimit: currentConstraints[constraintKey],
          reason: `Approaching limit for ${constraintKey}`,
        });
      }
    }
  });

  return suggestions;
};

export default {
  PLAN_TYPES,
  PLAN_CONSTRAINTS,
  PLAN_FEATURES,
  PLAN_SUPPORT_LEVELS,
  PLAN_ANALYTICS_LEVELS,
  PLAN_REPORTING_LEVELS,
  getPlanConstraints,
  hasFeature,
  isUnlimited,
  getEffectiveLimit,
  validateUsage,
  getUpgradeSuggestions,
};
