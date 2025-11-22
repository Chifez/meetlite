import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';
import { usePlanStatus } from '@/hooks/use-plan-status';
import { PaymentService } from '@/services/payment-service';
import { useState } from 'react';

interface PlanExpiryWarningProps {
  onDismiss?: () => void;
  showDismiss?: boolean;
}

/**
 * Component to display warning when plan is expiring soon
 */
export const PlanExpiryWarning = ({
  onDismiss,
  showDismiss = true,
}: PlanExpiryWarningProps) => {
  const { isExpiringSoon, daysUntilExpiry, planStatus } = usePlanStatus();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !isExpiringSoon || daysUntilExpiry === null) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const handleRenew = async () => {
    try {
      await PaymentService.redirectToBillingPortal();
    } catch (error: any) {
      console.error('Failed to open billing portal:', error);
    }
  };

  const getWarningMessage = () => {
    if (daysUntilExpiry === 1) {
      return 'Your plan expires tomorrow. Renew now to continue using all features.';
    }
    if (daysUntilExpiry <= 3) {
      return `Your plan expires in ${daysUntilExpiry} days. Renew now to avoid service interruption.`;
    }
    return `Your plan expires in ${daysUntilExpiry} days. Consider renewing to continue enjoying all features.`;
  };

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Plan Expiring Soon</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>{getWarningMessage()}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {planStatus?.status !== 'cancelled' && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRenew}
              className="bg-background"
            >
              Renew Now
            </Button>
          )}
          {showDismiss && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default PlanExpiryWarning;
