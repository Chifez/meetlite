import { useState } from 'react';
import PricingCard from '@/components/landing/pricing-card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import ScheduleDemoModal from '@/components/landing/schedule-demo-modal';
import { cn } from '@/lib/utils';

// Pricing configuration
const PRICING = {
  pro: {
    monthly: 19,
    yearly: 190,
  },
};

const pricingPlans = [
  {
    title: 'Starter',
    description: 'Perfect for personal use',
    features: [
      'Up to 3 participants',
      '40-minute meetings',
      'Basic scheduling',
      'Standard support',
    ],
    buttonText: 'Get Started',
    buttonVariant: 'default' as const,
    planType: 'free' as const,
  },
  {
    title: 'Pro',
    description: 'For growing teams',
    features: [
      'Up to 100 participants',
      'Unlimited meetings',
      'Advanced scheduling',
      'Priority support',
      'Recording & transcripts',
    ],
    buttonText: 'Subscribe Now',
    buttonVariant: 'default' as const,
    isPopular: true,
    planType: 'pro' as const,
    monthlyPrice: PRICING.pro.monthly,
    yearlyPrice: PRICING.pro.yearly,
  },
  {
    title: 'Enterprise',
    description: 'For large organizations',
    features: [
      'Unlimited participants',
      'Custom branding',
      'Advanced analytics',
      '24/7 support',
      'SSO integration',
    ],
    buttonText: 'Contact Sales',
    buttonVariant: 'outline' as const,
    planType: 'enterprise' as const,
  },
];

const PricingSection = () => {
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [billingDuration, setBillingDuration] = useState<'monthly' | 'yearly'>('monthly');

  // Calculate savings for yearly
  const yearlySavings = PRICING.pro.monthly * 12 - PRICING.pro.yearly;
  const yearlySavingsPercent = Math.round((yearlySavings / (PRICING.pro.monthly * 12)) * 100);

  return (
    <section
      id="pricing"
      className="py-20 bg-muted/30 relative overflow-hidden transition-colors duration-300"
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center space-y-3 mb-8">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-foreground">
            Simple pricing
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your needs.
          </p>
        </div>

        {/* Monthly/Yearly Toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="inline-flex items-center rounded-full bg-muted p-1 border border-border">
            <button
              onClick={() => setBillingDuration('monthly')}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                billingDuration === 'monthly'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingDuration('yearly')}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                billingDuration === 'yearly'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Yearly
            </button>
          </div>
          {billingDuration === 'yearly' && (
            <span className="text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 px-3 py-1 rounded-full border border-green-200 dark:border-green-800">
              Save {yearlySavingsPercent}%
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {pricingPlans.map((plan, index) => (
            <PricingCard
              key={index}
              title={plan.title}
              description={plan.description}
              features={plan.features}
              buttonText={plan.buttonText}
              buttonVariant={plan.buttonVariant}
              isPopular={plan.isPopular}
              planType={plan.planType}
              duration={billingDuration}
              monthlyPrice={plan.monthlyPrice}
              yearlyPrice={plan.yearlyPrice}
            />
          ))}
        </div>

        {/* CTA Card */}
        <div className="mt-12 max-w-4xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 dark:from-orange-600 dark:via-amber-600 dark:to-yellow-600 p-8 sm:p-12 shadow-xl border border-orange-400/20">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px]"></div>

            <div className="relative text-center space-y-6">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-white">
                Ready to get started?
              </h2>
              <p className="text-base sm:text-lg text-white/90 max-w-2xl mx-auto">
                Join thousands of teams using MeetLite.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-4">
                <Button
                  size="default"
                  className="w-full sm:w-auto bg-white text-orange-600 hover:bg-white/90 rounded-lg px-6 py-2.5 text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-200 group"
                >
                  Start Your First Meeting
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                </Button>

                <Button
                  variant="outline"
                  size="default"
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="w-full sm:w-auto border-2 border-white/30 text-white hover:bg-white/10 rounded-lg px-6 py-2.5 text-sm font-medium bg-transparent"
                >
                  Schedule a Demo
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Schedule Demo Modal */}
        <ScheduleDemoModal
          open={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
        />
      </div>
    </section>
  );
};

export default PricingSection;
