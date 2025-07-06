import { Calendar, UserPlus, Shield, Zap, Globe, Lock } from 'lucide-react';
import FeatureCard from './FeatureCard';

const features = [
  {
    icon: Calendar,
    title: 'Smart Scheduling',
    description:
      'AI-powered scheduling that finds the perfect time for everyone. Integrates with all major calendars and automatically handles time zones.',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    icon: UserPlus,
    title: 'Intelligent Invites',
    description:
      'Send beautiful, branded invites with one click. Automatic reminders, join links, and agenda sharing keep everyone prepared.',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description:
      'End-to-end encryption, secure rooms, and granular permissions. Your conversations stay private with enterprise-grade security.',
    gradient: 'from-green-500 to-emerald-500',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description:
      'Join meetings in under 2 seconds with our optimized infrastructure and smart connection routing.',
    gradient: 'from-yellow-500 to-orange-500',
  },
  {
    icon: Globe,
    title: 'Global CDN',
    description:
      'Crystal clear quality worldwide with our global content delivery network and adaptive streaming technology.',
    gradient: 'from-indigo-500 to-purple-500',
  },
  {
    icon: Lock,
    title: 'HD Quality',
    description:
      '4K video with spatial audio, screen sharing, and real-time collaboration tools for the best meeting experience.',
    gradient: 'from-red-500 to-pink-500',
  },
];

const FeaturesSection = () => {
  return (
    <section
      id="features"
      className="py-10 bg-white dark:bg-gray-900 relative overflow-hidden transition-colors duration-300"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-purple-50/30 dark:from-purple-900/10 to-transparent"></div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl py-2 sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Everything you need for perfect meetings
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Powerful features designed to make your video meetings more
            productive, secure, and enjoyable than ever before.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              gradient={feature.gradient}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
