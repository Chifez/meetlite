import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Crown, Star } from 'lucide-react';
import { PLAN_INFO } from '@/types/plan';
import { toast } from 'sonner';
import { PaymentService } from '../../services/payment-service';

interface VerticalPlanComparisonProps {
  currentPlan?: string;
  className?: string;
  showUpgradeButtons?: boolean;
}

export default function VerticalPlanComparison({
  currentPlan = 'free',
  className = '',
  showUpgradeButtons = true,
}: VerticalPlanComparisonProps) {
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

  const getBriefFeatures = (planName: string) => {
    const plan = PLAN_INFO[planName];
    // Return only 2-3 key features for brevity
    return plan.features.slice(0, 3);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {plans.map(([planKey, plan]) => (
        <Card
          key={planKey}
          className={`${getPlanCardVariant(planKey)} relative ${
            plan.popular ? 'border-2 border-primary ' : ''
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
              <Badge className="flex items-center gap-1 bg-destructive text-destructive-foreground">
                <Crown className="h-3 w-3" />
                Recommended
              </Badge>
            </div>
          )}

          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Plan Details - Left Side */}
              <div className="flex-1 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <h3 className="text-lg sm:text-xl font-bold">{plan.name}</h3>
                  {planKey === currentPlan && (
                    <div className="flex items-center gap-1 text-green-600">
                      <Check className="h-4 w-4" />
                      <span className="text-xs font-medium">Current Plan</span>
                    </div>
                  )}
                </div>

                <p className="text-sm text-muted-foreground">
                  {plan.description}
                </p>

                {/* Brief Features */}
                <div className="space-y-2">
                  {getBriefFeatures(planKey).map((feature, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <Check className="h-3 w-3 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA - Right Side */}
              <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 sm:ml-6">
                <div className="text-left sm:text-right">
                  <div className="text-xl sm:text-2xl font-bold">
                    {plan.price}
                  </div>
                </div>

                {showUpgradeButtons &&
                  planKey !== currentPlan &&
                  planKey !== 'free' && (
                    <Button
                      size="sm"
                      variant={plan.popular ? 'default' : 'outline'}
                      onClick={() => handleUpgrade(planKey)}
                      className="min-w-[100px] sm:min-w-[120px] text-xs sm:text-sm"
                    >
                      {plan.price === 'Custom pricing'
                        ? 'Contact Sales'
                        : `Upgrade`}
                    </Button>
                  )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
