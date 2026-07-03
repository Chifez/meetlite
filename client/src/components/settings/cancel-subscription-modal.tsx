import { useState } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  Clock,
  XCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { PaymentService } from '@/services/payment-service';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';

interface CancelSubscriptionModalProps {
  open: boolean;
  onClose: () => void;
  planType: string;
  endDate: Date | null;
}

export default function CancelSubscriptionModal({
  open,
  onClose,
  planType,
  endDate,
}: CancelSubscriptionModalProps) {
  const { handleNewToken } = useAuth();
  const [cancellationType, setCancellationType] = useState<
    'period_end' | 'immediately'
  >('period_end');
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [isLoading, setIsLoading] = useState(false);

  const formatPlanName = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const handleContinue = () => {
    setStep('confirm');
  };

  const handleBack = () => {
    setStep('select');
  };

  const handleCancel = async () => {
    setIsLoading(true);
    try {
      const result = await PaymentService.cancelSubscription(
        cancellationType === 'immediately'
      );

      // Update user state with new token if provided
      if (result.token) {
        handleNewToken(result.token);
      }

      toast.success(result.message || 'Subscription cancelled successfully');
      onClose();
      // Reset state for next open
      setStep('select');
      setCancellationType('period_end');
    } catch (error: any) {
      console.error('Cancellation error:', error);
      toast.error(error.message || 'Failed to cancel subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
      // Reset state
      setStep('select');
      setCancellationType('period_end');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cancel Subscription
          </DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? 'Choose how you would like to cancel your subscription'
              : 'Please confirm your cancellation'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' ? (
          <div className="space-y-6 py-4">
            <RadioGroup
              value={cancellationType}
              onValueChange={(value: 'period_end' | 'immediately') =>
                setCancellationType(value)
              }
              className="space-y-4"
            >
              {/* Cancel at period end */}
              <div
                className={`flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  cancellationType === 'period_end'
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-muted-foreground/30'
                }`}
                onClick={() => setCancellationType('period_end')}
              >
                <RadioGroupItem value="period_end" id="period_end" />
                <div className="flex-1">
                  <Label
                    htmlFor="period_end"
                    className="text-sm font-medium cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Cancel at end of billing period
                      <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                        Recommended
                      </span>
                    </div>
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Continue using {formatPlanName(planType)} features until{' '}
                    {endDate
                      ? format(endDate, 'MMMM d, yyyy')
                      : 'your billing period ends'}
                    . You can reactivate anytime before then.
                  </p>
                </div>
              </div>

              {/* Cancel immediately */}
              <div
                className={`flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  cancellationType === 'immediately'
                    ? 'border-destructive bg-destructive/5'
                    : 'border-muted hover:border-muted-foreground/30'
                }`}
                onClick={() => setCancellationType('immediately')}
              >
                <RadioGroupItem value="immediately" id="immediately" />
                <div className="flex-1">
                  <Label
                    htmlFor="immediately"
                    className="text-sm font-medium cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-destructive" />
                      Cancel immediately
                    </div>
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Lose access to {formatPlanName(planType)} features right
                    away. You will be downgraded to the Free plan immediately.
                  </p>
                </div>
              </div>
            </RadioGroup>

            {/* What you'll lose */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                What you'll lose:
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Extended meeting duration
                </li>
                <li className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Recording & transcripts
                </li>
                <li className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Priority support
                </li>
                <li className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Advanced analytics
                </li>
              </ul>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleClose}>
                Keep Subscription
              </Button>
              <Button variant="destructive" onClick={handleContinue}>
                Continue
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Confirmation Summary */}
            <Alert
              variant={
                cancellationType === 'immediately' ? 'destructive' : 'default'
              }
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {cancellationType === 'immediately' ? (
                  <>
                    Your subscription will be cancelled{' '}
                    <strong>immediately</strong>. You will lose access to all{' '}
                    {formatPlanName(planType)} features right away.
                  </>
                ) : (
                  <>
                    Your subscription will be cancelled at the end of your
                    billing period (
                    {endDate
                      ? format(endDate, 'MMMM d, yyyy')
                      : 'when your current period ends'}
                    ). You can continue using {formatPlanName(planType)}{' '}
                    features until then.
                  </>
                )}
              </AlertDescription>
            </Alert>

            <Separator />

            {/* Final confirmation */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Cancellation Summary:</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Plan:</span>
                  <span className="font-medium">
                    {formatPlanName(planType)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Cancellation Type:
                  </span>
                  <span className="font-medium">
                    {cancellationType === 'immediately'
                      ? 'Immediate'
                      : 'At Period End'}
                  </span>
                </div>
                {cancellationType === 'period_end' && endDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Access Until:</span>
                    <span className="font-medium">
                      {format(endDate, 'MMMM d, yyyy')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    New Plan After Cancellation:
                  </span>
                  <span className="font-medium">Free</span>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleBack} disabled={isLoading}>
                Go Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm Cancellation
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


