import { useState } from 'react';
import { motion } from 'motion/react';
import { Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate } from 'react-router-dom';

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    description: 'Perfect for small teams getting started with collaborative meetings.',
    features: [
      'Up to 45 minute group meetings',
      '10 participants per call',
      'Basic collaborative canvas',
      'Standard video quality (720p)',
      'Community support'
    ],
    buttonText: 'Get Started',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$12',
    period: '/mo',
    description: 'For high-performing teams that need unrestricted collaboration.',
    features: [
      'Unlimited meeting duration',
      '100 participants per call',
      'Infinite multiplayer canvas',
      'Figma & Miro imports',
      'HD Video (1080p)',
      'Real-time AI Transcripts'
    ],
    buttonText: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'Advanced security and control for large organizations.',
    features: [
      'Up to 500 participants',
      'Custom subdomain & branding',
      'SSO (SAML, Okta, Google)',
      'Dedicated Customer Success',
      'SLA 99.99% Uptime',
      'Advanced RBAC & Auditing'
    ],
    buttonText: 'Contact Sales',
    popular: false,
  }
];

export const PricingSection = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleAction = (isEnterprise: boolean) => {
    if (isEnterprise) {
      window.location.href = 'mailto:sales@meetlite.com';
      return;
    }
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/signup');
    }
  };

  return (
    <section className="py-24 lg:py-32 bg-[#FAFAFA] dark:bg-[#09090b] border-b border-border relative overflow-hidden">
      {/* Decorative Grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16 md:mb-24">
          <p className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-widest">
            Pricing
          </p>
          <h2 className="text-4xl md:text-5xl font-display font-medium text-foreground tracking-tight">
            Transparent pricing for <br className="hidden sm:block" /> any team size
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-center">
          {TIERS.map((tier, idx) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className={`relative flex flex-col bg-card border rounded-[32px] p-8 md:p-10 transition-all duration-300 ${
                tier.popular 
                  ? 'border-primary/30 shadow-elevated md:scale-105 z-10 bg-background dark:bg-[#121214]' 
                  : 'border-border shadow-sm hover:shadow-apple'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider py-1.5 px-4 rounded-full shadow-sm">
                  Recommended
                </div>
              )}

              {/* Header */}
              <div className="mb-8">
                <h3 className="text-2xl font-display font-medium text-foreground mb-2">{tier.name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed h-10">
                  {tier.description}
                </p>
              </div>

              {/* Price */}
              <div className="mb-8 pb-8 border-b border-border">
                <div className="flex items-baseline text-foreground">
                  <span className="text-5xl font-display font-medium tracking-tight">{tier.price}</span>
                  {tier.period && (
                    <span className="text-muted-foreground ml-1">{tier.period}</span>
                  )}
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-8 flex-1">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-start">
                    <Check className="w-5 h-5 text-primary shrink-0 mr-3 mt-0.5" />
                    <span className="text-muted-foreground text-sm leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Action */}
              <Button
                variant={tier.popular ? 'default' : 'outline'}
                className={`w-full rounded-2xl py-6 text-base font-medium shadow-sm transition-all group ${
                  tier.popular ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-transparent border-border hover:bg-muted'
                }`}
                onClick={() => handleAction(tier.name === 'Enterprise')}
              >
                {tier.buttonText}
                {tier.popular && <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
