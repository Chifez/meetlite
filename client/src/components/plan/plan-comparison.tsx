import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Crown, Star } from 'lucide-react';
import { PLAN_INFO } from '@/types/plan';
import { toast } from 'sonner';
import { PaymentService } from '@/services/payment-service';

interface PlanComparisonProps {
  currentPlan?: string;
  className?: string;
  showUpgradeButtons?: boolean;
}

export default function PlanComparison({
  currentPlan = 'free',
  className = '',
  showUpgradeButtons = true,
}: PlanComparisonProps) {
  const plans = Object.entries(PLAN_INFO);

  const handleUpgrade = async (planName: string) => {
    if (planName === currentPlan) {
      toast.info('This is your current plan');
      return;
    }

    if (planName === 'free') {
      toast.info('You are already on the free plan');
      return;
    }

    try {
      // Convert plan name to payment service format
      const planType = planName === 'pro' ? 'pro' : 'enterprise';
      await PaymentService.redirectToCheckout(planType, 'monthly');
    } catch (error: any) {
      console.error('Upgrade error:', error);
      toast.error(error.message || 'Failed to start upgrade process');
    }
  };

  const getPlanCardVariant = (planName: string) => {
    if (planName === currentPlan) return 'default';
    if (PLAN_INFO[planName].popular) return 'secondary';
    return 'outline';
  };

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${className}`}>
      {plans.map(([planKey, plan]) => (
        <Card
          key={planKey}
          className={`${getPlanCardVariant(planKey)} relative ${
            plan.popular ? 'ring-2 ring-primary ring-offset-2' : ''
          }`}
        >
          {/* Popular Badge */}
          {plan.popular && (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <Badge className="flex items-center gap-1 bg-primary text-primary-foreground">
                <Star className="h-3 w-3" />
                Most Popular
              </Badge>
            </div>
          )}

          {/* Recommended Badge */}
          {plan.recommended && (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <Badge className="flex items-center gap-1 bg-yellow-500 text-yellow-500-foreground">
                <Crown className="h-3 w-3" />
                Recommended
              </Badge>
            </div>
          )}

          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {plan.description}
            </CardDescription>
            <div className="mt-4">
              <span className="text-3xl font-bold">{plan.price}</span>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Features List */}
            <div className="space-y-3">
              {plan.features.map((feature, index) => (
                <div key={index} className="flex items-start gap-3">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm leading-relaxed">{feature}</span>
                </div>
              ))}
            </div>

            {/* Current Plan Indicator */}
            {planKey === currentPlan && (
              <div className="pt-3 border-t">
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <Check className="h-4 w-4" />
                  <span className="font-medium">Current Plan</span>
                </div>
              </div>
            )}

            {/* Upgrade Button */}
            {showUpgradeButtons &&
              planKey !== currentPlan &&
              planKey !== 'free' && (
                <div className="pt-3 border-t">
                  <Button
                    className="w-full"
                    variant={plan.popular ? 'default' : 'outline'}
                    onClick={() => handleUpgrade(planKey)}
                  >
                    {plan.price === 'Custom pricing'
                      ? 'Contact Sales'
                      : `Upgrade to ${plan.name}`}
                  </Button>
                </div>
              )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
