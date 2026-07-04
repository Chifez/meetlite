/**
 * Comprehensive Plan Configuration
 * Defines all plan types, constraints, and features for the application
 */

export const PLAN_TYPES = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export type PlanType = typeof PLAN_TYPES[keyof typeof PLAN_TYPES];

export interface PlanConstraintValues {
  maxOrganizationsOwned: number;
  maxOrganizationsMember: number;
  maxTeamSize: number;
  maxInvitationsPerDay: number;
  maxInvitationsPerMonth: number;
  maxConcurrentMeetings: number;
  maxMeetingDuration: number;
  maxParticipantsPerMeeting: number;
  maxMeetingsPerDay: number;
  maxMeetingsPerMonth: number;
  maxStorageGB: number;
  maxFileSizeMB: number;
  maxFilesPerMeeting: number;
  features: readonly string[];
  maxAPICallsPerDay: number;
  maxWebhooks: number;
  supportLevel: string;
  responseTime: string;
  customBranding: boolean;
  whiteLabel: boolean;
  sso: boolean;
  advancedSecurity: boolean;
  analytics: string;
  reporting: string;
  dataRetention: number;
}

export const PLAN_CONSTRAINTS: Record<PlanType, PlanConstraintValues> = {
  [PLAN_TYPES.FREE]: {
    // Organization Management
    maxOrganizationsOwned: 2,
    maxOrganizationsMember: 5,
    maxTeamSize: 10,

    // Invitation Limits
    maxInvitationsPerDay: 5,
    maxInvitationsPerMonth: 50,

    // Meeting & Video Calls
    maxConcurrentMeetings: 1,
    maxMeetingDuration: 60,
    maxParticipantsPerMeeting: 10,
    maxMeetingsPerDay: 10,
    maxMeetingsPerMonth: 100,

    // Storage & Files
    maxStorageGB: 1,
    maxFileSizeMB: 25,
    maxFilesPerMeeting: 10,

    // Features
    features: [
      'basic_meetings',
      'file_sharing',
      'screen_sharing',
      'chat_messaging',
      'meeting_recording_basic',
    ],

    // API & Integration Limits
    maxAPICallsPerDay: 1000,
    maxWebhooks: 5,

    // Support
    supportLevel: 'community',
    responseTime: '72h',

    // Branding
    customBranding: false,
    whiteLabel: false,

    // Security
    sso: false,
    advancedSecurity: false,

    // Analytics
    analytics: 'basic',
    reporting: 'basic',
    dataRetention: 30,
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
    maxOrganizationsOwned: -1,
    maxOrganizationsMember: -1,
    maxTeamSize: -1,

    // Invitation Limits
    maxInvitationsPerDay: -1,
    maxInvitationsPerMonth: -1,

    // Meeting & Video Calls
    maxConcurrentMeetings: -1,
    maxMeetingDuration: -1,
    maxParticipantsPerMeeting: -1,
    maxMeetingsPerDay: -1,
    maxMeetingsPerMonth: -1,

    // Storage & Files
    maxStorageGB: -1,
    maxFileSizeMB: -1,
    maxFilesPerMeeting: -1,

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
    maxAPICallsPerDay: -1,
    maxWebhooks: -1,

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
    dataRetention: -1,
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
} as const;

export const PLAN_SUPPORT_LEVELS = {
  COMMUNITY: 'community',
  EMAIL: 'email',
  DEDICATED: 'dedicated',
} as const;

export const PLAN_ANALYTICS_LEVELS = {
  BASIC: 'basic',
  ADVANCED: 'advanced',
  ENTERPRISE: 'enterprise',
} as const;

export const PLAN_REPORTING_LEVELS = {
  BASIC: 'basic',
  ADVANCED: 'advanced',
  ENTERPRISE: 'enterprise',
} as const;

/**
 * Get plan constraints for a specific plan type
 * @param planType - The plan type
 * @returns Plan constraints object
 */
export const getPlanConstraints = (planType: PlanType): PlanConstraintValues => {
  if (!PLAN_CONSTRAINTS[planType]) {
    throw new Error(`Invalid plan type: ${planType}`);
  }
  return PLAN_CONSTRAINTS[planType]!;
};

/**
 * Check if a plan has a specific feature
 * @param planType - The plan type
 * @param feature - The feature to check
 * @returns Whether the plan has the feature
 */
export const hasFeature = (planType: PlanType, feature: string): boolean => {
  const constraints = getPlanConstraints(planType);
  return (
    constraints.features.includes(feature) ||
    constraints.features.includes(PLAN_FEATURES.ALL_FEATURES)
  );
};

/**
 * Check if a plan allows unlimited usage for a specific constraint
 * @param planType - The plan type
 * @param constraintKey - The constraint key to check
 * @returns Whether the constraint is unlimited
 */
export const isUnlimited = (planType: PlanType, constraintKey: keyof PlanConstraintValues): boolean => {
  const constraints = getPlanConstraints(planType);
  return constraints[constraintKey] === -1;
};

/**
 * Get the effective limit for a constraint (handles unlimited values)
 * @param planType - The plan type
 * @param constraintKey - The constraint key
 * @param fallback - Fallback value if unlimited
 * @returns The effective limit
 */
export const getEffectiveLimit = (
  planType: PlanType,
  constraintKey: keyof PlanConstraintValues,
  fallback = Number.MAX_SAFE_INTEGER
): number => {
  const constraints = getPlanConstraints(planType);
  const limit = constraints[constraintKey];
  return limit === -1 ? fallback : (limit as number);
};

export interface UsageValidationResult {
  isValid: boolean;
  message: string;
  currentUsage?: number;
  limit?: number;
  upgradeRequired?: boolean;
}

/**
 * Validate if a usage value exceeds plan limits
 * @param planType - The plan type
 * @param constraintKey - The constraint key
 * @param currentUsage - Current usage value
 * @returns Validation result with isValid and message
 */
export const validateUsage = (
  planType: PlanType,
  constraintKey: keyof PlanConstraintValues,
  currentUsage: number
): UsageValidationResult => {
  const constraints = getPlanConstraints(planType);
  const limit = constraints[constraintKey];

  if (limit === -1) {
    return { isValid: true, message: 'Unlimited usage allowed' };
  }

  if (currentUsage >= (limit as number)) {
    return {
      isValid: false,
      message: `Usage limit exceeded. Current: ${currentUsage}, Limit: ${limit}`,
      currentUsage,
      limit: limit as number,
      upgradeRequired: true,
    };
  }

  return { isValid: true, message: 'Usage within limits' };
};

export interface UpgradeSuggestion {
  constraint: string;
  currentUsage: number;
  currentLimit: number;
  reason: string;
}

/**
 * Get plan upgrade suggestions based on current usage
 * @param currentPlan - Current plan type
 * @param usage - Current usage object
 * @returns Array of upgrade suggestions
 */
export const getUpgradeSuggestions = (
  currentPlan: PlanType,
  usage: Record<string, number>
): UpgradeSuggestion[] => {
  const suggestions: UpgradeSuggestion[] = [];
  const currentConstraints = getPlanConstraints(currentPlan);

  // Check each constraint and suggest upgrades if needed
  Object.keys(currentConstraints).forEach((key) => {
    const constraintKey = key as keyof PlanConstraintValues;
    if (
      typeof currentConstraints[constraintKey] === 'number' &&
      currentConstraints[constraintKey] !== -1
    ) {
      const currentUsage = usage[constraintKey] || 0;
      const limit = currentConstraints[constraintKey] as number;
      if (currentUsage >= limit * 0.8) {
        // 80% threshold
        suggestions.push({
          constraint: constraintKey,
          currentUsage,
          currentLimit: limit,
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
