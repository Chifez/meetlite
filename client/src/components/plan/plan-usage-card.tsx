import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Users,
  Mail,
  Building,
  Calendar,
  HardDrive,
  Zap,
  AlertTriangle,
  TrendingUp,
  Crown,
} from 'lucide-react';
import planService from '@/services/plan-service';
import { PlanSummary } from '@/types/plan';
import { toast } from 'sonner';
import { PaymentService } from '../../services/payment-service';
import { useWorkspace } from '@/contexts/workspace-context';

interface PlanUsageCardProps {
  className?: string;
  showUpgradeButton?: boolean;
  compact?: boolean;
}

export default function PlanUsageCard({
  className = '',
  showUpgradeButton = true,
  compact = false,
}: PlanUsageCardProps) {
  const [planSummary, setPlanSummary] = useState<PlanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeOrganization } = useWorkspace();

  useEffect(() => {
    loadPlanUsage();
    // Reload when organization changes to get updated plan
  }, [activeOrganization?.id]);

  const loadPlanUsage = async () => {
    try {
      setLoading(true);
      const summary = await planService.getPlanUsage();
      setPlanSummary(summary);
    } catch (err: any) {
      console.error('Failed to load plan usage:', err);
      setError(err.response?.data?.message || 'Failed to load plan usage');
      toast.error('Failed to load plan usage');
    } finally {
      setLoading(false);
    }
  };

  const getUsageIcon = (constraint: string) => {
    const iconMap: Record<string, any> = {
      maxOrganizationsOwned: Building,
      maxOrganizationsMember: Users,
      maxTeamSize: Users,
      maxInvitationsPerDay: Mail,
      maxInvitationsPerMonth: Mail,
      maxConcurrentMeetings: Calendar,
      maxMeetingDuration: Calendar,
      maxParticipantsPerMeeting: Users,
      maxMeetingsPerDay: Calendar,
      maxMeetingsPerMonth: Calendar,
      maxStorageGB: HardDrive,
      maxFileSizeMB: HardDrive,
      maxFilesPerMeeting: HardDrive,
      maxAPICallsPerDay: Zap,
      maxWebhooks: Zap,
    };
    return iconMap[constraint] || TrendingUp;
  };

  // const getUsageColor = (percentage: number) => {
  //   if (percentage >= 100) return 'bg-destructive';
  //   if (percentage >= 80) return 'bg-orange-500';
  //   if (percentage >= 60) return 'bg-yellow-500';
  //   return 'bg-green-500';
  // };

  const getUsageTextColor = (percentage: number) => {
    if (percentage >= 100) return 'text-destructive';
    if (percentage >= 80) return 'text-orange-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getKeyUsageMetrics = () => {
    if (!planSummary) return [];

    const { usage, limits } = planSummary;
    const keyMetrics = [
      {
        key: 'maxOrganizationsOwned',
        current: usage.organizationsOwned,
        limit: limits.maxOrganizationsOwned,
        label: 'Organizations Owned',
      },
      {
        key: 'maxOrganizationsMember',
        current: usage.organizationsMember,
        limit: limits.maxOrganizationsMember,
        label: 'Organization Memberships',
      },
      {
        key: 'maxInvitationsPerDay',
        current: usage.invitationsSentToday,
        limit: limits.maxInvitationsPerDay,
        label: 'Daily Invitations',
      },
      {
        key: 'maxTeamSize',
        current: 0, // This would need to be calculated from actual org sizes
        limit: limits.maxTeamSize,
        label: 'Team Size (per org)',
      },
    ];

    return keyMetrics.filter((metric) => metric.limit !== -1);
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Plan Usage
          </CardTitle>
          <CardDescription>Loading your current usage...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-2 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !planSummary) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Plan Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error || 'Unable to load plan usage information'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const { plan, usage, limits, suggestions } = planSummary;
  const keyMetrics = getKeyUsageMetrics();
  const hasUpgradeSuggestions = suggestions.length > 0;
  const nextPlan = planService.getNextPlan(plan);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Plan Usage
            </CardTitle>
            <CardDescription>
              Current plan:{' '}
              <Badge variant="outline" className="ml-1">
                {plan.toUpperCase()}
              </Badge>
            </CardDescription>
          </div>
          {plan !== 'enterprise' && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Crown className="h-3 w-3" />
              {plan === 'free' ? 'Upgrade Available' : 'Pro Features'}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Upgrade Suggestions Alert */}
        {hasUpgradeSuggestions && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You're approaching limits on {suggestions.length} feature
              {suggestions.length > 1 ? 's' : ''}. Consider upgrading your plan
              for more capacity.
            </AlertDescription>
          </Alert>
        )}

        {/* Key Usage Metrics */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">
            Usage Overview
          </h4>
          <div className="flex flex-col col-span-2 gap-2">
            {keyMetrics.map((metric) => {
              const percentage = planService.getUsagePercentage(
                metric.current,
                metric.limit
              );
              const Icon = getUsageIcon(metric.key);

              return (
                <div key={metric.key} className="space-y-2 max-w-lg">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{metric.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={getUsageTextColor(percentage)}>
                        {metric.current} /{' '}
                        {planService.formatUsageValue(metric.limit, metric.key)}
                      </span>
                      {percentage >= 80 && (
                        <Badge
                          variant={
                            percentage >= 100 ? 'destructive' : 'secondary'
                          }
                          className="text-xs"
                        >
                          {percentage >= 100 ? 'Limit Reached' : 'Near Limit'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Progress value={percentage} className="h-2 " />
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Usage (if not compact) */}
        {!compact && (
          <div className="space-y-4 max-w-lg">
            <h4 className="text-sm font-medium text-muted-foreground">
              Detailed Usage
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Invitations Today
                  </span>
                  <span>
                    {usage.invitationsSentToday} /{' '}
                    {limits.maxInvitationsPerDay === -1
                      ? '∞'
                      : limits.maxInvitationsPerDay}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Invitations This Month
                  </span>
                  <span>
                    {usage.invitationsSentThisMonth} /{' '}
                    {limits.maxInvitationsPerMonth === -1
                      ? '∞'
                      : limits.maxInvitationsPerMonth}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Meetings Today</span>
                  <span>
                    {usage.meetingsCreatedToday} /{' '}
                    {limits.maxMeetingsPerDay === -1
                      ? '∞'
                      : limits.maxMeetingsPerDay}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Storage Used</span>
                  <span>
                    {usage.storageUsedGB} /{' '}
                    {limits.maxStorageGB === -1 ? '∞' : limits.maxStorageGB} GB
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upgrade Button */}
        {showUpgradeButton && nextPlan && (
          <div className="pt-4 border-t">
            <Button
              className="w-full"
              variant={hasUpgradeSuggestions ? 'default' : 'outline'}
              onClick={async () => {
                if (!nextPlan) return;

                try {
                  // Convert plan name to payment service format
                  const planType = nextPlan === 'pro' ? 'pro' : 'enterprise';
                  await PaymentService.redirectToCheckout(planType, 'monthly');
                } catch (error: any) {
                  console.error('Upgrade error:', error);
                  toast.error(
                    error.message || 'Failed to start upgrade process'
                  );
                }
              }}
            >
              <Crown className="h-4 w-4 mr-2" />
              Upgrade to {nextPlan.toUpperCase()}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
