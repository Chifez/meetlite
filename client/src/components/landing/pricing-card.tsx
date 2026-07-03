import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate } from 'react-router-dom';
import { PaymentService } from '@/services/payment-service';
import { toast } from 'sonner';
import ContactSalesModal from '@/components/shared/contact-sales-modal';

interface PricingCardProps {
  title: string;
  description: string;
  features: string[];
  buttonText: string;
  buttonVariant?: 'default' | 'outline';
  isPopular?: boolean;
  planType?: 'pro' | 'enterprise' | 'free';
  duration?: 'monthly' | 'yearly';
  monthlyPrice?: number;
  yearlyPrice?: number;
}

const PricingCard = ({
  title,
  description,
  features,
  buttonText,
  buttonVariant = 'default',
  isPopular = false,
  planType,
  duration = 'monthly',
  monthlyPrice,
  yearlyPrice,
}: PricingCardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  // Calculate displayed price based on plan type and duration
  const getDisplayPrice = () => {
    // Free plan
    if (planType === 'free' || !planType) {
      return { price: 'Free', period: '' };
    }
    // Enterprise plan - always show "Custom"
    if (planType === 'enterprise') {
      return { price: 'Custom', period: '' };
    }
    // Pro plan - show based on duration
    if (monthlyPrice && yearlyPrice) {
      if (duration === 'yearly') {
        return { price: `$${yearlyPrice}`, period: '/year' };
      }
      return { price: `$${monthlyPrice}`, period: '/month' };
    }
    return { price: '$19', period: '/month' };
  };

  const { price, period } = getDisplayPrice();

  const handleButtonClick = async () => {
    // Enterprise plan - open contact sales modal
    if (planType === 'enterprise') {
      setIsContactModalOpen(true);
      return;
    }

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

    // Pro plan - check authentication
    if (!user) {
      // Redirect to signup with plan info in state
      navigate('/signup', {
        state: { from: 'pricing', planType, duration, redirectToCheckout: true },
      });
      return;
    }

    // User is authenticated - proceed to checkout with selected duration
    try {
      await PaymentService.redirectToCheckout(planType, duration);
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

      {/* Contact Sales Modal for Enterprise plan */}
      {planType === 'enterprise' && (
        <ContactSalesModal
          open={isContactModalOpen}
          onClose={() => setIsContactModalOpen(false)}
          source="landing_page"
        />
      )}
    </Card>
  );
};

export default PricingCard;
