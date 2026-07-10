import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate } from 'react-router-dom';
import { PaymentService } from '@/services/payment-service';
import { toast } from 'sonner';
import ContactSalesModal from '@/components/shared/contact-sales-modal';
import { cn } from '@/lib/utils';

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

  const getDisplayPrice = () => {
    if (planType === 'free' || !planType) return { price: '$0', period: '/month' };
    if (planType === 'enterprise') return { price: 'Custom', period: '' };
    if (monthlyPrice && yearlyPrice) {
      if (duration === 'yearly') return { price: `$${yearlyPrice}`, period: '/year' };
      return { price: `$${monthlyPrice}`, period: '/month' };
    }
    return { price: '$19', period: '/month' };
  };

  const { price, period } = getDisplayPrice();

  const handleButtonClick = async () => {
    if (planType === 'enterprise') {
      setIsContactModalOpen(true);
      return;
    }
    if (!planType || planType === 'free') {
      navigate(user ? '/dashboard' : '/signup', { state: { from: 'pricing' } });
      return;
    }
    if (!user) {
      navigate('/signup', {
        state: { from: 'pricing', planType, duration, redirectToCheckout: true },
      });
      return;
    }
    try {
      await PaymentService.redirectToCheckout(planType, duration);
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout. Please try again.');
    }
  };

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-3xl p-8 transition-all duration-200 bg-card',
        isPopular
          ? 'border-2 border-primary shadow-xl scale-100 lg:scale-105 z-10'
          : 'border border-border shadow-sm hover:border-primary/40'
      )}
    >
      {isPopular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <Badge variant="solid" className="bg-primary text-white border-none px-3 py-1 font-bold tracking-wide uppercase text-[10px]">
            Most popular
          </Badge>
        </div>
      )}

      {/* Plan header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold tracking-tight text-foreground mb-2">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>

      {/* Price */}
      <div className="mb-8">
        <div className="flex items-baseline gap-1">
          <span className="text-5xl font-bold tracking-tighter text-foreground">
            {price}
          </span>
          {period && (
            <span className="text-sm font-semibold text-muted-foreground">
              {period}
            </span>
          )}
        </div>
      </div>

      {/* Features */}
      <ul className="space-y-4 flex-1 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            <Check
              className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary"
              strokeWidth={3}
            />
            <span className="text-sm font-medium leading-snug text-foreground/90">
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <Button
        id={`pricing-cta-${planType ?? 'free'}`}
        className={cn(
          'w-full rounded-xl py-6 text-sm font-bold shadow-sm',
          isPopular
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'bg-background text-foreground border border-border hover:bg-border/30'
        )}
        variant={isPopular ? 'default' : buttonVariant}
        onClick={handleButtonClick}
      >
        {buttonText}
      </Button>

      {planType === 'enterprise' && (
        <ContactSalesModal
          open={isContactModalOpen}
          onClose={() => setIsContactModalOpen(false)}
          source="landing_page"
        />
      )}
    </div>
  );
};

export default PricingCard;
