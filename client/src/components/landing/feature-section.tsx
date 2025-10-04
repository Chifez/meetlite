import {
  SmartSchedulingIcon,
  IntelligentInvitesIcon,
  PrivacyFirstIcon,
  LightningFastIcon,
  GlobalCDNIcon,
  HDQualityIcon,
} from '@/components/icons';
import FeatureCard from '@/components/landing/feature-card';
import AnimatedSection from '@/components/ui/animated-section';

const features = [
  {
    icon: SmartSchedulingIcon,
    title: 'Never waste time scheduling again',
    description:
      'Our AI finds the perfect meeting time for everyone in 30 seconds, not 30 emails. Integrates with all major calendars and automatically handles time zones.',
    gradient: 'from-blue-500 to-indigo-500',
    trustIndicator: '2x faster than manual scheduling',
  },
  {
    icon: IntelligentInvitesIcon,
    title: 'Beautiful invites that get responses',
    description:
      'Send branded invites with one click. Automatic reminders, join links, and agenda sharing keep everyone prepared and engaged.',
    gradient: 'from-pink-500 to-rose-500',
    trustIndicator: '95% response rate',
  },
  {
    icon: PrivacyFirstIcon,
    title: 'Bank-level security for your conversations',
    description:
      'End-to-end encryption ensures your sensitive discussions stay private, always. Enterprise-grade security with granular permissions.',
    gradient: 'from-green-500 to-emerald-500',
    trustIndicator: 'SOC 2 Compliant',
  },
  {
    icon: LightningFastIcon,
    title: 'Join meetings in under 2 seconds',
    description:
      'Our optimized infrastructure and smart connection routing means no more waiting for connections or dealing with lag.',
    gradient: 'from-yellow-500 to-orange-500',
    trustIndicator: '99.9% uptime',
  },
  {
    icon: GlobalCDNIcon,
    title: 'Crystal clear quality worldwide',
    description:
      'Our global content delivery network ensures perfect video quality everywhere, with adaptive streaming that adjusts to your connection.',
    gradient: 'from-indigo-500 to-blue-500',
    trustIndicator: '200+ global locations',
  },
  {
    icon: HDQualityIcon,
    title: '4K video with spatial audio',
    description:
      'Experience meetings like never before with 4K video, spatial audio, screen sharing, and real-time collaboration tools.',
    gradient: 'from-red-500 to-orange-500',
    trustIndicator: 'Up to 4K resolution',
  },
];

const FeaturesSection = () => {
  return (
    <section
      id="features"
      className="py-20 bg-white dark:bg-gray-900 relative overflow-hidden transition-colors duration-300"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50/30 dark:from-blue-900/10 to-transparent"></div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <AnimatedSection
          animationType="fadeIn"
          className="text-center space-y-6 mb-20"
        >
          <h2 className="text-4xl font-heading font-bold bg-gradient-to-r from-gray-900 to-blue-900 dark:from-white dark:to-blue-100 bg-clip-text text-transparent">
            Everything you need for perfect meetings
          </h2>
          <p className="text-fluid-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Powerful features designed to make your video meetings more
            productive, secure, and enjoyable than ever before.
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <AnimatedSection
              key={index}
              animationType="slideUp"
              delay={index * 150}
            >
              <FeatureCard
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                gradient={feature.gradient}
                trustIndicator={feature.trustIndicator}
                delay={0}
              />
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
