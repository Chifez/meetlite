import PricingCard from '@/components/landing/pricing-card';
import AnimatedSection from '@/components/ui/animated-section';

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
    buttonText: 'Start Free Trial',
    buttonVariant: 'default' as const,
    isPopular: true,
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
  },
];

const PricingSection = () => {
  return (
    <section
      id="pricing"
      className="py-10 bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-800 dark:to-blue-900/20 relative overflow-hidden transition-colors duration-300"
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:20px_20px]"></div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <AnimatedSection
          animationType="fadeIn"
          className="text-center space-y-6 mb-16"
        >
          <h2 className="text-4xl font-heading font-bold bg-gradient-to-r from-gray-900 to-blue-900 dark:from-white dark:to-blue-100 bg-clip-text text-transparent">
            Simple, transparent pricing
          </h2>
          <p className="text-fluid-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Choose the plan that fits your needs. Always know what you'll pay.
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-4 lg:gap-8 max-w-6xl mx-auto">
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
            />
          ))}
        </div>

        {/* Trust indicators */}
        <AnimatedSection
          animationType="slideUp"
          delay={200}
          className="mt-16 text-center"
        >
          <div className="flex flex-wrap justify-center items-center gap-8 text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-2">
              <span className="font-medium">14-day free trial</span>
            </div>
            <div className="hidden sm:block w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
            <div className="flex items-center space-x-2">
              <span className="font-medium">No setup fees</span>
            </div>
            <div className="hidden sm:block w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
            <div className="flex items-center space-x-2">
              <span className="font-medium">Cancel anytime</span>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
};

export default PricingSection;
