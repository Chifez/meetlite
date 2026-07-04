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
  Loader2,
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

  const getUsageTextColor = (percentage: number) => {
    if (percentage >= 100) return 'text-destructive';
    if (percentage >= 80) return 'text-amber-600';
    return 'text-muted-foreground';
  };

  const getKeyUsageMetrics = () => {
    if (!planSummary) return [];

    const { usage, limits } = planSummary;
    const keyMetrics = [
      {
        key: 'maxOrganizationsOwned',
        current: usage.organizationsOwned,
        limit: limits.maxOrganizationsOwned,
        label: 'Workspaces Owned',
      },
      {
        key: 'maxOrganizationsMember',
        current: usage.organizationsMember,
        limit: limits.maxOrganizationsMember,
        label: 'Workspace Memberships',
      },
      {
        key: 'maxInvitationsPerDay',
        current: usage.invitationsSentToday,
        limit: limits.maxInvitationsPerDay,
        label: 'Daily Invitations',
      },
      {
        key: 'maxTeamSize',
        current: 0,
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
          <CardTitle className="flex items-center gap-2 text-[1rem]">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Plan Usage
          </CardTitle>
          <CardDescription>Retrieving current workspace limits…</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted/65 rounded-xl animate-pulse" />
                <div className="h-2 bg-muted/40 rounded-xl animate-pulse" />
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
          <CardTitle className="flex items-center gap-2 text-[1rem] text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Plan Usage Error
          </CardTitle>
          <CardDescription>
            {error || 'Unable to load plan usage details.'}
          </CardDescription>
        </CardHeader>
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-[1.125rem] tracking-[-0.02em]">
              <TrendingUp className="h-4.5 w-4.5 text-primary" />
              Plan & Usage
            </CardTitle>
            <CardDescription>
              You are currently on the{' '}
              <span className="font-semibold text-foreground capitalize">{plan}</span> plan.
            </CardDescription>
          </div>
          {plan !== 'enterprise' && (
            <Badge variant="solid" className="bg-primary/10 text-primary border-primary/20 flex items-center gap-1">
              <Crown className="h-3 w-3" />
              {plan === 'free' ? 'Upgrade available' : 'Pro'}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Warning Alert banner */}
        {hasUpgradeSuggestions && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-amber-200 bg-amber-500/5 text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-[0.75rem] leading-normal font-medium">
              You are approaching workspace limits on {suggestions.length} feature
              {suggestions.length > 1 ? 's' : ''}. Upgrade your plan to prevent service interruption.
            </p>
          </div>
        )}

        {/* Key Metrics */}
        <div className="space-y-3.5">
          <h4 className="text-[0.75rem] font-bold text-muted-foreground uppercase tracking-wide">
            Usage overview
          </h4>
          <div className="space-y-3">
            {keyMetrics.map((metric) => {
              const percentage = planService.getUsagePercentage(
                metric.current,
                metric.limit
              );
              const Icon = getUsageIcon(metric.key);

              return (
                <div key={metric.key} className="space-y-1.5 max-w-xl">
                  <div className="flex items-center justify-between text-[0.8125rem]">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground/80" />
                      <span className="font-medium text-foreground">{metric.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`font-semibold ${getUsageTextColor(percentage)}`}>
                        {metric.current} /{' '}
                        {planService.formatUsageValue(metric.limit, metric.key)}
                      </span>
                      {percentage >= 80 && (
                        <span className={`text-[0.6875rem] font-bold ${percentage >= 100 ? 'text-rose-500' : 'text-amber-500'}`}>
                          {percentage >= 100 ? '(Full)' : '(Near limit)'}
                        </span>
                      )}
                    </div>
                  </div>
                  <Progress value={percentage} className="h-1.5" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed stats grid */}
        {!compact && (
          <div className="space-y-3.5 pt-1.5">
            <h4 className="text-[0.75rem] font-bold text-muted-foreground uppercase tracking-wide">
              Detailed metrics
            </h4>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 border border-border rounded-xl p-4 bg-muted/20">
              <div className="flex justify-between items-center text-[0.8125rem]">
                <span className="text-muted-foreground">Invitations sent today</span>
                <span className="font-semibold text-foreground">
                  {usage.invitationsSentToday} /{' '}
                  {limits.maxInvitationsPerDay === -1 ? '∞' : limits.maxInvitationsPerDay}
                </span>
              </div>
              <div className="flex justify-between items-center text-[0.8125rem]">
                <span className="text-muted-foreground">Invitations this month</span>
                <span className="font-semibold text-foreground">
                  {usage.invitationsSentThisMonth} /{' '}
                  {limits.maxInvitationsPerMonth === -1 ? '∞' : limits.maxInvitationsPerMonth}
                </span>
              </div>
              <div className="flex justify-between items-center text-[0.8125rem]">
                <span className="text-muted-foreground">Meetings created today</span>
                <span className="font-semibold text-foreground">
                  {usage.meetingsCreatedToday} /{' '}
                  {limits.maxMeetingsPerDay === -1 ? '∞' : limits.maxMeetingsPerDay}
                </span>
              </div>
              <div className="flex justify-between items-center text-[0.8125rem]">
                <span className="text-muted-foreground">Storage utilization</span>
                <span className="font-semibold text-foreground">
                  {usage.storageUsedGB.toFixed(2)} /{' '}
                  {limits.maxStorageGB === -1 ? '∞' : `${limits.maxStorageGB} GB`}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Upgrade Button Action */}
        {showUpgradeButton && nextPlan && (
          <div className="pt-4 border-t border-border">
            <Button
              id="plan-usage-upgrade-btn"
              className="w-full rounded-xl font-semibold gap-1.5"
              variant={hasUpgradeSuggestions ? 'default' : 'outline'}
              onClick={async () => {
                if (!nextPlan) return;
                try {
                  const planType = nextPlan === 'pro' ? 'pro' : 'enterprise';
                  await PaymentService.redirectToCheckout(planType, 'monthly');
                } catch (error: any) {
                  console.error('Upgrade redirect error:', error);
                  toast.error('Failed to initiate upgrade. Try again.');
                }
              }}
            >
              <Crown className="w-3.5 h-3.5" />
              Upgrade to {nextPlan.toUpperCase()}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
