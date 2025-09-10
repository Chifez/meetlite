import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Loader2, CreditCard, Check, Zap, Crown } from 'lucide-react';
import { PaymentService } from '../../services/paymentService';
import { useToast } from '../../hooks/use-toast';

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan?: string;
}

interface PlanOption {
  type: 'pro' | 'enterprise';
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  icon: React.ReactNode;
  color: string;
  popular?: boolean;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  open,
  onOpenChange,
  currentPlan = 'free',
}) => {
  const [loading, setLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const plans: PlanOption[] = [
    {
      type: 'pro',
      name: 'Pro',
      monthlyPrice: 19,
      yearlyPrice: 190,
      features: [
        'Up to 10 organizations',
        'Up to 50 team members',
        'Advanced analytics',
        'Priority support',
        'Custom branding',
        'API access',
      ],
      icon: <Zap className="h-5 w-5" />,
      color: 'from-blue-500 to-purple-600',
      popular: true,
    },
    {
      type: 'enterprise',
      name: 'Enterprise',
      monthlyPrice: 49,
      yearlyPrice: 490,
      features: [
        'Unlimited organizations',
        'Unlimited team members',
        'Advanced security',
        '24/7 dedicated support',
        'Custom integrations',
        'SSO & SAML',
        'Advanced compliance',
      ],
      icon: <Crown className="h-5 w-5" />,
      color: 'from-purple-600 to-pink-600',
    },
  ];

  const handleUpgrade = async (
    planType: 'pro' | 'enterprise',
    duration: 'monthly' | 'yearly'
  ) => {
    setLoading(`${planType}-${duration}`);

    try {
      await PaymentService.redirectToCheckout(planType, duration);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Upgrade error:', error);
      toast({
        title: 'Upgrade Failed',
        description: error.message || 'Failed to start upgrade process',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setLoading('billing');

    try {
      await PaymentService.redirectToBillingPortal();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Billing portal error:', error);
      toast({
        title: 'Billing Portal Error',
        description: error.message || 'Failed to open billing portal',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <CreditCard className="h-6 w-6" />
            Upgrade Your Plan
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Plan Status */}
          {currentPlan !== 'free' && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-800">
                    You're currently on the <strong>{currentPlan}</strong> plan
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {plans.map((plan) => (
              <Card
                key={plan.type}
                className={`relative ${
                  plan.popular ? 'ring-2 ring-purple-500' : ''
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-purple-600">
                    Most Popular
                  </Badge>
                )}

                <CardHeader className="text-center pb-4">
                  <div
                    className={`inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r ${plan.color} text-white mb-3`}
                  >
                    {plan.icon}
                  </div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="space-y-1">
                    <div className="text-3xl font-bold">
                      ${plan.monthlyPrice}
                      <span className="text-sm font-normal text-gray-500">
                        /month
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      or ${plan.yearlyPrice}/year (save 17%)
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Features */}
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li
                        key={index}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-4">
                    <Button
                      className="w-full"
                      onClick={() => handleUpgrade(plan.type, 'monthly')}
                      disabled={loading !== null || currentPlan === plan.type}
                    >
                      {loading === `${plan.type}-monthly` ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {currentPlan === plan.type
                        ? 'Current Plan'
                        : 'Upgrade Monthly'}
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleUpgrade(plan.type, 'yearly')}
                      disabled={loading !== null || currentPlan === plan.type}
                    >
                      {loading === `${plan.type}-yearly` ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {currentPlan === plan.type
                        ? 'Current Plan'
                        : 'Upgrade Yearly'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Billing Management */}
          {currentPlan !== 'free' && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Manage Your Subscription</h3>
                    <p className="text-sm text-gray-600">
                      Update payment method, view invoices, or cancel
                      subscription
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleManageBilling}
                    disabled={loading !== null}
                  >
                    {loading === 'billing' ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Manage Billing
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security Notice */}
          <div className="text-center text-sm text-gray-500">
            <p>
              🔒 Secure payment processing by Stripe. Your payment information
              is encrypted and secure.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
