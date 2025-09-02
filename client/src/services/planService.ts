import api from '@/lib/axios';
import { env } from '@/config/env';
import {
  PlanSummary,
  PlanValidationResult,
  PlanConstraints,
} from '@/types/plan';

class PlanService {
  /**
   * Get current user's plan usage summary
   */
  async getPlanUsage(): Promise<PlanSummary> {
    const response = await api.get(`${env.AUTH_API_URL}/plan/usage`);
    return response.data.data;
  }

  /**
   * Get plan constraints for current user
   */
  async getPlanConstraints(): Promise<{
    plan: string;
    constraints: PlanConstraints;
  }> {
    const response = await api.get(`${env.AUTH_API_URL}/plan/constraints`);
    return response.data.data;
  }

  /**
   * Validate a specific action against plan limits
   */
  async validateAction(
    action: 'send_invitation' | 'accept_invitation' | 'organization_capacity',
    data?: any
  ): Promise<PlanValidationResult> {
    const response = await api.post(`${env.AUTH_API_URL}/plan/validate`, {
      action,
      data,
    });
    return response.data.data;
  }

  /**
   * Check if user can send invitations
   */
  async canSendInvitation(): Promise<PlanValidationResult> {
    return this.validateAction('send_invitation');
  }

  /**
   * Check if user can accept invitation
   */
  async canAcceptInvitation(
    organizationId: string,
    role: string
  ): Promise<PlanValidationResult> {
    return this.validateAction('accept_invitation', { organizationId, role });
  }

  /**
   * Check if organization can accept new members
   */
  async canOrganizationAcceptMembers(
    organizationId: string
  ): Promise<PlanValidationResult> {
    return this.validateAction('organization_capacity', { organizationId });
  }

  /**
   * Get usage percentage for a specific constraint
   */
  getUsagePercentage(currentUsage: number, limit: number): number {
    if (limit === -1) return 0; // Unlimited
    if (limit === 0) return 100; // No limit but has usage
    return Math.min((currentUsage / limit) * 100, 100);
  }

  /**
   * Get usage status color based on percentage
   */
  getUsageStatusColor(percentage: number): string {
    if (percentage >= 100) return 'text-destructive';
    if (percentage >= 80) return 'text-orange-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-green-600';
  }

  /**
   * Get usage status text based on percentage
   */
  getUsageStatusText(percentage: number): string {
    if (percentage >= 100) return 'Limit reached';
    if (percentage >= 80) return 'Near limit';
    if (percentage >= 60) return 'Moderate usage';
    return 'Low usage';
  }

  /**
   * Format constraint name for display
   */
  formatConstraintName(constraint: string): string {
    const constraintMap: Record<string, string> = {
      maxOrganizationsOwned: 'Organizations Owned',
      maxOrganizationsMember: 'Organization Memberships',
      maxTeamSize: 'Team Size',
      maxInvitationsPerDay: 'Daily Invitations',
      maxInvitationsPerMonth: 'Monthly Invitations',
      maxConcurrentMeetings: 'Concurrent Meetings',
      maxMeetingDuration: 'Meeting Duration',
      maxParticipantsPerMeeting: 'Meeting Participants',
      maxMeetingsPerDay: 'Daily Meetings',
      maxMeetingsPerMonth: 'Monthly Meetings',
      maxStorageGB: 'Storage',
      maxFileSizeMB: 'File Size',
      maxFilesPerMeeting: 'Files per Meeting',
      maxAPICallsPerDay: 'Daily API Calls',
      maxWebhooks: 'Webhooks',
    };
    return constraintMap[constraint] || constraint;
  }

  /**
   * Format usage value for display
   */
  formatUsageValue(value: number, constraint: string): string {
    if (value === -1) return 'Unlimited';

    switch (constraint) {
      case 'maxStorageGB':
        return `${value} GB`;
      case 'maxFileSizeMB':
        return `${value} MB`;
      case 'maxMeetingDuration':
        return `${value} minutes`;
      case 'maxParticipantsPerMeeting':
      case 'maxTeamSize':
        return `${value} people`;
      default:
        return value.toString();
    }
  }

  /**
   * Get next plan recommendation
   */
  getNextPlan(currentPlan: string): string | null {
    const planOrder = ['free', 'pro', 'enterprise'];
    const currentIndex = planOrder.indexOf(currentPlan);
    return currentIndex < planOrder.length - 1
      ? planOrder[currentIndex + 1]
      : null;
  }

  /**
   * Check if a feature is available in the current plan
   */
  hasFeature(plan: string, feature: string): boolean {
    const planFeatures: Record<string, string[]> = {
      free: [
        'basic_meetings',
        'file_sharing',
        'screen_sharing',
        'chat_messaging',
        'meeting_recording_basic',
      ],
      pro: [
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
      enterprise: ['all_features'],
    };

    const features = planFeatures[plan] || [];
    return features.includes(feature) || features.includes('all_features');
  }
}

export default new PlanService();
