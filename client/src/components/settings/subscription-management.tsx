import { useState } from 'react';
import { format, formatDistanceToNow, isPast, isFuture } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Crown,
  Calendar,
  CreditCard,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { PaymentService } from '@/services/payment-service';
import { toast } from 'sonner';
import CancelSubscriptionModal from './cancel-subscription-modal';

interface SubscriptionManagementProps {
  className?: string;
}

export default function SubscriptionManagement({
  className = '',
}: SubscriptionManagementProps) {
  const { user } = useAuth();
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  const plan = user?.plan;
  const planType = plan?.type || 'free';
  const planStatus = plan?.status || 'active';
  const endDate = plan?.endDate ? new Date(plan.endDate) : null;
  const startDate = plan?.startDate ? new Date(plan.startDate) : null;

  const isPaidPlan = planType !== 'free';
  const isCancelled = planStatus === 'cancelled';
  const isExpired = planStatus === 'expired' || (endDate && isPast(endDate));
  const isScheduledForCancellation = isCancelled && endDate && isFuture(endDate);

  const getPlanBadgeVariant = () => {
    if (planType === 'enterprise') return 'default';
    if (planType === 'pro') return 'secondary';
    return 'outline';
  };

  const getStatusBadgeVariant = () => {
    if (isScheduledForCancellation) return 'secondary';
    if (isCancelled || isExpired) return 'destructive';
    return 'default';
  };

  const getStatusText = () => {
    if (isScheduledForCancellation) return 'Cancellation Scheduled';
    if (isCancelled) return 'Cancelled';
    if (isExpired) return 'Expired';
    return 'Active';
  };

  const handleOpenBillingPortal = async () => {
    setIsLoadingPortal(true);
    try {
      await PaymentService.redirectToBillingPortal();
    } catch (error: any) {
      console.error('Error opening billing portal:', error);
      toast.error(error.message || 'Failed to open billing portal');
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const formatPlanName = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Subscription Management
            </CardTitle>
            <CardDescription>
              Manage your subscription and billing
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getPlanBadgeVariant()}>
              {formatPlanName(planType)}
            </Badge>
            <Badge variant={getStatusBadgeVariant()}>{getStatusText()}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Plan Details */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">
            Subscription Details
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Current Plan */}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <Crown className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium">Current Plan</p>
                <p className="text-sm text-muted-foreground">
                  {formatPlanName(planType)} Plan
                </p>
              </div>
            </div>

            {/* Billing Cycle */}
            {isPaidPlan && startDate && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Calendar className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Billing Started</p>
                  <p className="text-sm text-muted-foreground">
                    {format(startDate, 'MMMM d, yyyy')}
                  </p>
                </div>
              </div>
            )}

            {/* Renewal Date */}
            {isPaidPlan && endDate && !isCancelled && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <RefreshCw className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Next Renewal</p>
                  <p className="text-sm text-muted-foreground">
                    {format(endDate, 'MMMM d, yyyy')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ({formatDistanceToNow(endDate, { addSuffix: true })})
                  </p>
                </div>
              </div>
            )}

            {/* Access Until (for cancelled subscriptions) */}
            {isScheduledForCancellation && endDate && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                    Access Until
                  </p>
                  <p className="text-sm text-orange-600 dark:text-orange-400">
                    {format(endDate, 'MMMM d, yyyy')}
                  </p>
                  <p className="text-xs text-orange-500">
                    ({formatDistanceToNow(endDate, { addSuffix: true })})
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Warning for scheduled cancellation */}
        {isScheduledForCancellation && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                Your subscription is scheduled to be cancelled
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                You will continue to have access to premium features until{' '}
                {endDate && format(endDate, 'MMMM d, yyyy')}. After that, you
                will be downgraded to the Free plan.
              </p>
            </div>
          </div>
        )}

        <Separator />

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {/* Billing Portal - only for paid users */}
          {isPaidPlan && (
            <Button
              variant="outline"
              onClick={handleOpenBillingPortal}
              disabled={isLoadingPortal}
            >
              {isLoadingPortal ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Manage Billing
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
          )}

          {/* Cancel Subscription - only for active paid plans */}
          {isPaidPlan && !isCancelled && !isExpired && (
            <Button
              variant="outline"
              className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => setIsCancelModalOpen(true)}
            >
              Cancel Subscription
            </Button>
          )}

          {/* Reactivate - only for scheduled cancellations */}
          {isScheduledForCancellation && (
            <Button variant="default" onClick={handleOpenBillingPortal}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reactivate Subscription
            </Button>
          )}

          {/* Upgrade - for free users or expired/cancelled */}
          {(!isPaidPlan || isExpired || (isCancelled && !isScheduledForCancellation)) && (
            <Button
              variant="default"
              onClick={() => {
                // Navigate to pricing/upgrade section
                const planSection = document.getElementById('available-plans');
                planSection?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <Crown className="h-4 w-4 mr-2" />
              {isPaidPlan ? 'Resubscribe' : 'Upgrade Plan'}
            </Button>
          )}
        </div>
      </CardContent>

      {/* Cancel Subscription Modal */}
      <CancelSubscriptionModal
        open={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        planType={planType}
        endDate={endDate}
      />
    </Card>
  );
}


