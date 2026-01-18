import { useState } from 'react';
import PricingCard from '@/components/landing/pricing-card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import ScheduleDemoModal from '@/components/landing/schedule-demo-modal';

const pricingPlans = [
  {
    title: 'Starter',
    price: 'Free',
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
    price: '$12',
    period: '/month',
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
  },
  {
    title: 'Enterprise',
    price: 'Custom',
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

  return (
    <section
      id="pricing"
      className="py-20 bg-muted/30 relative overflow-hidden transition-colors duration-300"
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center space-y-3 mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-foreground">
            Simple pricing
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your needs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {pricingPlans.map((plan, index) => (
            <PricingCard
              key={index}
              title={plan.title}
              price={plan.price}
              period={plan.period}
              description={plan.description}
              features={plan.features}
              buttonText={plan.buttonText}
              buttonVariant={plan.buttonVariant}
              isPopular={plan.isPopular}
              planType={plan.planType}
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
