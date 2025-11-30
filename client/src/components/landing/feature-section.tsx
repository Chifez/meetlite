import { Calendar, UserPlus, Shield, Zap, Globe, Lock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: Calendar,
    title: 'Smart Scheduling',
    description:
      'AI-powered scheduling that finds the perfect time for everyone. Integrates with all major calendars and automatically handles time zones.',
    color: 'primary',
  },
  {
    icon: UserPlus,
    title: 'Intelligent Invites',
    description:
      'Send beautiful, branded invites with one click. Automatic reminders, join links, and agenda sharing keep everyone prepared.',
    color: 'primary',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description:
      'End-to-end encryption, secure rooms, and granular permissions. Your conversations stay private with enterprise-grade security.',
    color: 'green',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description:
      'Join meetings in under 2 seconds with our optimized infrastructure and smart connection routing.',
    color: 'yellow',
  },
  {
    icon: Globe,
    title: 'Global CDN',
    description:
      'Crystal clear quality worldwide with our global content delivery network and adaptive streaming technology.',
    color: 'blue',
  },
  {
    icon: Lock,
    title: 'HD Quality',
    description:
      '4K video with spatial audio, screen sharing, and real-time collaboration tools for the best meeting experience.',
    color: 'primary',
  },
];

interface FeatureItemProps {
  icon: typeof Calendar;
  title: string;
  description: string;
  color: 'primary' | 'green' | 'yellow' | 'blue';
  index: number;
  isLast: boolean;
  isVisible: boolean;
}

const FeatureItem = ({
  icon: Icon,
  title,
  description,
  color,
  index,
  isLast,
  isVisible,
}: FeatureItemProps) => {
  const colorClasses = {
    primary: 'bg-primary text-primary-foreground',
    green: 'bg-green-500 text-white',
    yellow: 'bg-yellow-500 text-white',
    blue: 'bg-blue-500 text-white',
  };

  return (
    <div className="relative flex gap-6 group">
      {/* Timeline Line */}
      {!isLast && (
        <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border">
          <div
            className={cn(
              'w-full bg-primary transition-all duration-1000 ease-out',
              isVisible ? 'h-full' : 'h-0'
            )}
            style={{
              transitionDelay: `${index * 150}ms`,
            }}
          />
        </div>
      )}

      {/* Icon Circle */}
      <div className="relative z-10 flex-shrink-0">
        <div
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 shadow-lg',
            colorClasses[color],
            isVisible ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
          )}
          style={{
            transitionDelay: `${index * 150}ms`,
          }}
        >
          <Icon className="w-6 h-6" />
        </div>
      </div>

      {/* Content Card */}
      <div
        className={cn(
          'flex-1 pb-12 transition-all duration-500',
          isVisible ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
        )}
        style={{
          transitionDelay: `${index * 150 + 100}ms`,
        }}
      >
        <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg hover:border-primary/50 transition-all duration-300 group-hover:-translate-y-1">
          <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="text-muted-foreground leading-relaxed text-sm">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
};

const FeaturesSection = () => {
  const [visibleItems, setVisibleItems] = useState<boolean[]>([]);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Animate items sequentially
            features.forEach((_, index) => {
              setTimeout(() => {
                setVisibleItems((prev) => {
                  const newState = [...prev];
                  newState[index] = true;
                  return newState;
                });
              }, index * 150);
            });
          }
        });
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  return (
    <section
      id="features"
      ref={sectionRef}
      className="py-20 bg-background relative overflow-hidden transition-colors duration-300"
    >
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center space-y-3 mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-foreground">
            Powerful features
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need for productive, secure, and enjoyable meetings.
          </p>
        </div>

        <div className="relative">
          {features.map((feature, index) => (
            <FeatureItem
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              color={feature.color}
              index={index}
              isLast={index === features.length - 1}
              isVisible={visibleItems[index] || false}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
