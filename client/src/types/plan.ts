export interface PlanConstraints {
  // Organization Management
  maxOrganizationsOwned: number;
  maxOrganizationsMember: number;
  maxTeamSize: number;

  // Invitation Limits
  maxInvitationsPerDay: number;
  maxInvitationsPerMonth: number;

  // Meeting & Video Calls
  maxConcurrentMeetings: number;
  maxMeetingDuration: number;
  maxParticipantsPerMeeting: number;
  maxMeetingsPerDay: number;
  maxMeetingsPerMonth: number;

  // Storage & Files
  maxStorageGB: number;
  maxFileSizeMB: number;
  maxFilesPerMeeting: number;

  // Features
  features: string[];

  // API & Integration Limits
  maxAPICallsPerDay: number;
  maxWebhooks: number;

  // Support
  supportLevel: 'community' | 'email' | 'dedicated';
  responseTime: string;

  // Branding
  customBranding: boolean;
  whiteLabel: boolean;

  // Security
  sso: boolean;
  advancedSecurity: boolean;

  // Analytics
  analytics: 'basic' | 'advanced' | 'enterprise';
  reporting: 'basic' | 'advanced' | 'enterprise';
  dataRetention: number;
}

export interface PlanUsage {
  organizationsOwned: number;
  organizationsMember: number;
  invitationsSentToday: number;
  invitationsSentThisMonth: number;
  meetingsCreatedToday: number;
  meetingsCreatedThisMonth: number;
  storageUsedGB: number;
  apiCallsToday: number;
}

export interface PlanUpgradeSuggestion {
  constraint: string;
  currentUsage: number;
  currentLimit: number;
  reason: string;
}

export interface PlanSummary {
  plan: 'free' | 'pro' | 'enterprise';
  limits: PlanConstraints;
  usage: PlanUsage;
  suggestions: PlanUpgradeSuggestion[];
  canUpgrade: boolean;
}

export interface PlanValidationResult {
  isValid: boolean;
  message: string;
  upgradeRequired?: boolean;
  currentPlan?: string;
  currentUsage?: number;
  limit?: number;
  organizationPlan?: string;
  currentMembers?: number;
  maxMembers?: number;
}

export interface PlanInfo {
  name: string;
  description: string;
  price: string;
  features: string[];
  popular?: boolean;
  recommended?: boolean;
}

export const PLAN_INFO: Record<string, PlanInfo> = {
  free: {
    name: 'Free',
    description: 'Perfect for individuals and small teams getting started',
    price: '$0/month',
    features: [
      'Up to 2 organizations',
      'Up to 5 organization memberships',
      'Up to 10 team members per org',
      '5 invitations per day',
      'Basic meetings (60 min max)',
      '1GB storage',
      'Community support',
    ],
  },
  pro: {
    name: 'Pro',
    description: 'Advanced features for growing teams and businesses',
    price: '$29/month',
    popular: true,
    features: [
      'Up to 10 organizations',
      'Up to 50 organization memberships',
      'Up to 100 team members per org',
      '50 invitations per day',
      'Advanced meetings (4 hours max)',
      '100GB storage',
      'Breakout rooms & polls',
      'Meeting analytics',
      'Email support',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    description: 'Unlimited everything for large organizations',
    price: 'Custom pricing',
    recommended: true,
    features: [
      'Unlimited organizations',
      'Unlimited organization memberships',
      'Unlimited team members',
      'Unlimited invitations',
      'Unlimited meeting duration',
      'Unlimited storage',
      'All advanced features',
      'Custom branding',
      'SSO integration',
      'Dedicated support',
      'Custom analytics',
    ],
  },
};
