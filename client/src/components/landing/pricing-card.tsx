import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate } from 'react-router-dom';
import { PaymentService } from '@/services/payment-service';
import { toast } from 'sonner';

interface PricingCardProps {
  title: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  buttonText: string;
  buttonVariant?: 'default' | 'outline';
  isPopular?: boolean;
  planType?: 'pro' | 'enterprise' | 'free';
}

const PricingCard = ({
  title,
  price,
  period,
  description,
  features,
  buttonText,
  buttonVariant = 'default',
  isPopular = false,
  planType,
}: PricingCardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleButtonClick = async () => {
    // Free plan - redirect to signup/login
    if (!planType || planType === 'free') {
      if (!user) {
        navigate('/signup', { state: { from: 'pricing' } });
      } else {
        // User is already on free plan, can navigate to dashboard
        navigate('/dashboard');
      }
      return;
    }

    // Paid plans - check authentication
    if (!user) {
      // Redirect to signup with plan info in state
      navigate('/signup', {
        state: { from: 'pricing', planType, redirectToCheckout: true },
      });
      return;
    }

    // User is authenticated - proceed to checkout
    try {
      // Default to monthly, user can change in checkout
      await PaymentService.redirectToCheckout(planType, 'monthly');
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout process');
    }
  };

  return (
    <Card
      className={`relative border-2 transition-all duration-300 hover:shadow-lg ${
        isPopular
          ? 'border-primary bg-card shadow-lg scale-105'
          : 'border-border bg-card hover:border-primary/50'
      }`}
    >
      {isPopular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground px-4 py-1">
            Most Popular
          </Badge>
        </div>
      )}
      <CardContent className="p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-foreground">{title}</h3>
          <div className="space-y-1">
            <div className="flex items-baseline space-x-1">
              <span className="text-4xl font-bold text-primary">{price}</span>
              {period && (
                <span className="text-muted-foreground">{period}</span>
              )}
            </div>
            <p className="text-muted-foreground">{description}</p>
          </div>
        </div>

        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-foreground text-sm lg:text-base">
                {feature}
              </span>
            </li>
          ))}
        </ul>

        <Button
          size="default"
          className={`w-full rounded-lg py-2.5 text-sm font-medium transition-all duration-200 hover:shadow-md ${
            buttonVariant === 'outline'
              ? 'border-2 border-primary text-primary hover:bg-primary/10'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
          variant={buttonVariant}
          onClick={handleButtonClick}
        >
          {buttonText}
        </Button>
      </CardContent>
    </Card>
  );
};

export default PricingCard;
