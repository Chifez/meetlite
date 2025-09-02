import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Crown,
  X,
  Mail,
  Users,
  Building,
  Calendar,
  HardDrive,
  Zap,
} from 'lucide-react';
import { PlanValidationResult } from '@/types/plan';
import { toast } from 'sonner';

interface PlanLimitAlertProps {
  validation: PlanValidationResult;
  onDismiss?: () => void;
  onUpgrade?: () => void;
  className?: string;
}

export default function PlanLimitAlert({
  validation,
  onDismiss,
  onUpgrade,
  className = '',
}: PlanLimitAlertProps) {
  const getAlertIcon = () => {
    if (validation.upgradeRequired) {
      return <Crown className="h-4 w-4" />;
    }
    return <AlertTriangle className="h-4 w-4" />;
  };

  const getAlertVariant = () => {
    if (validation.upgradeRequired) {
      return 'default' as const;
    }
    return 'destructive' as const;
  };

  const getContextIcon = () => {
    const message = validation.message.toLowerCase();
    if (message.includes('invitation')) return <Mail className="h-4 w-4" />;
    if (message.includes('organization') || message.includes('member'))
      return <Building className="h-4 w-4" />;
    if (message.includes('team') || message.includes('participant'))
      return <Users className="h-4 w-4" />;
    if (message.includes('meeting')) return <Calendar className="h-4 w-4" />;
    if (message.includes('storage') || message.includes('file'))
      return <HardDrive className="h-4 w-4" />;
    if (message.includes('api')) return <Zap className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  const getUsageDetails = () => {
    if (
      validation.currentUsage !== undefined &&
      validation.limit !== undefined
    ) {
      const percentage = Math.min(
        (validation.currentUsage / validation.limit) * 100,
        100
      );
      return (
        <div className="mt-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Current Usage:</span>
            <span className="font-medium">
              {validation.currentUsage} /{' '}
              {validation.limit === -1 ? '∞' : validation.limit}
            </span>
          </div>
          <div className="mt-1 w-full bg-muted rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                percentage >= 100
                  ? 'bg-destructive'
                  : percentage >= 80
                  ? 'bg-orange-500'
                  : 'bg-yellow-500'
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>
      );
    }
    return null;
  };

  const getPlanInfo = () => {
    if (validation.currentPlan) {
      return (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Current Plan:</span>
          <Badge variant="outline">
            {validation.currentPlan.toUpperCase()}
          </Badge>
        </div>
      );
    }
    return null;
  };

  const getOrganizationInfo = () => {
    if (
      validation.organizationPlan &&
      validation.currentMembers !== undefined &&
      validation.maxMembers !== undefined
    ) {
      return (
        <div className="mt-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Organization Plan:</span>
            <Badge variant="outline">
              {validation.organizationPlan.toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-muted-foreground">Members:</span>
            <span className="font-medium">
              {validation.currentMembers} /{' '}
              {validation.maxMembers === -1 ? '∞' : validation.maxMembers}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      // Default upgrade action
      toast.info('Upgrade flow coming soon!');
    }
  };

  return (
    <Alert variant={getAlertVariant()} className={className}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{getAlertIcon()}</div>

        <div className="flex-1 min-w-0">
          <AlertTitle className="flex items-center gap-2">
            {getContextIcon()}
            {validation.upgradeRequired
              ? 'Plan Limit Reached'
              : 'Action Blocked'}
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 w-6 p-0"
                onClick={onDismiss}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </AlertTitle>

          <AlertDescription className="mt-1">
            {validation.message}
          </AlertDescription>

          {getUsageDetails()}
          {getPlanInfo()}
          {getOrganizationInfo()}

          {validation.upgradeRequired && (
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={handleUpgrade}
                className="flex items-center gap-2"
              >
                <Crown className="h-3 w-3" />
                Upgrade Plan
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  toast.info('Learn more about our plans and pricing');
                }}
              >
                Learn More
              </Button>
            </div>
          )}
        </div>
      </div>
    </Alert>
  );
}
