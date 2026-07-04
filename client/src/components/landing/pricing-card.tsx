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
        'relative flex flex-col rounded-2xl border p-6 transition-colors duration-200',
        isPopular
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card hover:border-primary/40'
      )}
    >
      {isPopular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <Badge variant="solid" className="bg-white text-primary text-[0.6875rem]">
            Most popular
          </Badge>
        </div>
      )}

      {/* Plan header */}
      <div className="mb-5">
        <h3 className={cn(
          'text-[0.9375rem] font-bold tracking-[-0.01em] mb-1',
          isPopular ? 'text-primary-foreground' : 'text-foreground'
        )}>
          {title}
        </h3>
        <p className={cn(
          'text-[0.8125rem] leading-relaxed',
          isPopular ? 'text-primary-foreground/80' : 'text-muted-foreground'
        )}>
          {description}
        </p>
      </div>

      {/* Price */}
      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className={cn(
            'text-[2.5rem] font-bold tracking-[-0.04em]',
            isPopular ? 'text-primary-foreground' : 'text-foreground'
          )}>
            {price}
          </span>
          {period && (
            <span className={cn(
              'text-[0.8125rem]',
              isPopular ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}>
              {period}
            </span>
          )}
        </div>
      </div>

      {/* Features */}
      <ul className="space-y-2.5 flex-1 mb-7">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <Check
              className={cn(
                'w-4 h-4 mt-0.5 flex-shrink-0',
                isPopular ? 'text-primary-foreground/90' : 'text-primary'
              )}
              strokeWidth={2.5}
            />
            <span className={cn(
              'text-[0.8125rem] leading-snug',
              isPopular ? 'text-primary-foreground/90' : 'text-foreground'
            )}>
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <Button
        id={`pricing-cta-${planType ?? 'free'}`}
        className={cn(
          'w-full rounded-xl font-semibold',
          isPopular
            ? 'bg-white text-primary hover:bg-white/90'
            : ''
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
