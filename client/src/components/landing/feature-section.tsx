import {
  Calendar,
  UserPlus,
  Shield,
  Zap,
  Globe,
  Lock,
  Video,
  Mail,
  Users,
  Clock,
  MapPin,
  BarChart3,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import IntegrationsBeam from './integrations-beam';

const features = [
  {
    icon: Calendar,
    title: 'Smart Scheduling',
    description:
      'AI-powered scheduling that finds the perfect time for everyone. Integrates with all major calendars and automatically handles time zones.',
    color: 'primary',
    mockup: 'calendar',
  },
  {
    icon: UserPlus,
    title: 'Intelligent Invites',
    description:
      'Send beautiful, branded invites with one click. Automatic reminders, join links, and agenda sharing keep everyone prepared.',
    color: 'primary',
    mockup: 'invite',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description:
      'End-to-end encryption, secure rooms, and granular permissions. Your conversations stay private with enterprise-grade security.',
    color: 'green',
    mockup: 'security',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description:
      'Join meetings in under 2 seconds with our optimized infrastructure and smart connection routing.',
    color: 'yellow',
    mockup: 'speed',
  },
  {
    icon: Globe,
    title: 'Global CDN',
    description:
      'Crystal clear quality worldwide with our global content delivery network and adaptive streaming technology.',
    color: 'blue',
    mockup: 'network',
  },
  {
    icon: Lock,
    title: 'HD Quality',
    description:
      '4K video with spatial audio, screen sharing, and real-time collaboration tools for the best meeting experience.',
    color: 'primary',
    mockup: 'video',
  },
];

interface MockupComponentProps {
  type: string;
  color: 'primary' | 'green' | 'yellow' | 'blue';
}

const MockupComponent = ({ type, color }: MockupComponentProps) => {
  const colorClasses = {
    primary: 'bg-primary/10 border-primary/20',
    green: 'bg-green-500/10 border-green-500/20',
    yellow: 'bg-yellow-500/10 border-yellow-500/20',
    blue: 'bg-blue-500/10 border-blue-500/20',
  };

  const iconColors = {
    primary: 'text-primary',
    green: 'text-green-500',
    yellow: 'text-yellow-500',
    blue: 'text-blue-500',
  };

  const renderMockup = () => {
    switch (type) {
      case 'calendar':
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Calendar className={cn('w-5 h-5', iconColors[color])} />
              <span className="text-xs font-medium text-foreground">Today</span>
            </div>
            <div className="space-y-1">
              <div className="h-2 bg-muted rounded w-3/4"></div>
              <div className="h-2 bg-muted rounded w-1/2"></div>
              <div className="h-2 bg-muted rounded w-5/6"></div>
            </div>
          </div>
        );
      case 'invite':
        return (
          <div className="space-y-2">
            <Mail className={cn('w-5 h-5', iconColors[color])} />
            <div className="space-y-1">
              <div className="h-2 bg-muted rounded w-full"></div>
              <div className="h-2 bg-muted rounded w-4/5"></div>
              <div className="h-1.5 bg-muted rounded w-3/4"></div>
            </div>
          </div>
        );
      case 'security':
        return (
          <div className="space-y-2">
            <Shield className={cn('w-5 h-5', iconColors[color])} />
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs text-muted-foreground">Encrypted</span>
            </div>
            <div className="h-1.5 bg-muted rounded w-full"></div>
          </div>
        );
      case 'speed':
        return (
          <div className="space-y-2">
            <Zap className={cn('w-5 h-5', iconColors[color])} />
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Speed</span>
                <span className="text-xs font-semibold text-foreground">
                  2s
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full', {
                    'bg-primary': color === 'primary',
                    'bg-green-500': color === 'green',
                    'bg-yellow-500': color === 'yellow',
                    'bg-blue-500': color === 'blue',
                  })}
                  style={{ width: '95%' }}
                ></div>
              </div>
            </div>
          </div>
        );
      case 'network':
        return (
          <div className="space-y-2">
            <Globe className={cn('w-5 h-5', iconColors[color])} />
            <div className="flex items-center gap-2">
              <MapPin className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Global</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={cn('h-1.5 rounded', {
                    'bg-primary/30': color === 'primary',
                    'bg-green-500/30': color === 'green',
                    'bg-yellow-500/30': color === 'yellow',
                    'bg-blue-500/30': color === 'blue',
                  })}
                ></div>
              ))}
            </div>
          </div>
        );
      case 'video':
        return (
          <div className="space-y-2">
            <Video className={cn('w-5 h-5', iconColors[color])} />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-muted-foreground">4K</span>
              </div>
              <div className="h-1.5 bg-muted rounded w-full"></div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        'w-full p-4 rounded-lg border-2 bg-card',
        colorClasses[color]
      )}
    >
      {renderMockup()}
    </div>
  );
};

interface FeatureCardProps {
  icon: typeof Calendar;
  title: string;
  description: string;
  color: 'primary' | 'green' | 'yellow' | 'blue';
  mockup: string;
  index: number;
  isVisible: boolean;
}

const FeatureCard = ({
  icon: Icon,
  title,
  description,
  color,
  mockup,
  index,
  isVisible,
}: FeatureCardProps) => {
  const colorClasses = {
    primary: 'bg-primary text-primary-foreground',
    green: 'bg-green-500 text-white',
    yellow: 'bg-yellow-500 text-white',
    blue: 'bg-blue-500 text-white',
  };

  const isEven = index % 2 === 0;

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-lg p-6 hover:shadow-lg hover:border-primary/50 transition-all duration-300 hover:-translate-y-1',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}
      style={{
        transitionDelay: `${index * 100}ms`,
      }}
    >
      <div
        className={cn(
          'flex gap-6 items-start',
          isEven ? 'flex-row' : 'flex-row-reverse'
        )}
      >
        {/* Text Content */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3 mb-3">
            <div
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center shadow-md',
                colorClasses[color]
              )}
            >
              <Icon className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
              {title}
            </h3>
          </div>
          <p className="text-muted-foreground leading-relaxed text-sm">
            {description}
          </p>
        </div>

        {/* Mockup Component */}
        <div className="flex-shrink-0 w-28 md:w-32">
          <MockupComponent type={mockup} color={color} />
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
              }, index * 100);
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
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center space-y-3 mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-foreground">
            Powerful features
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need for productive, secure, and enjoyable meetings.
          </p>
        </div>

        {/* Integrations Beam */}
        <div className="mb-16">
          <IntegrationsBeam />
        </div>

        {/* Grid Features - 2 per row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              color={feature.color}
              mockup={feature.mockup}
              index={index}
              isVisible={visibleItems[index] || false}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
