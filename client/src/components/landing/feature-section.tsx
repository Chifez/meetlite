import {
  Calendar,
  UserPlus,
  Shield,
  Zap,
  Globe,
  Video,
  Mail,
  MapPin,
  Users,
  Share2,
  FileText,
  Monitor,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import IntegrationsBeam from './integrations-beam';

const features: Array<{
  icon: typeof Calendar;
  title: string;
  description: string;
  color: 'primary' | 'green' | 'yellow' | 'blue' | 'purple' | 'pink';
  mockup: string;
  span?: 1 | 2; // For grid layout control
}> = [
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
    span: 1, // Middle row - spans half width (col-span-3 out of 6)
  },
  {
    icon: Globe,
    title: 'Global CDN',
    description:
      'Crystal clear quality worldwide with our global content delivery network and adaptive streaming technology.',
    color: 'blue',
    mockup: 'network',
    span: 2, // Middle row - spans half width (col-span-3 out of 6)
  },
  {
    icon: Video,
    title: 'HD Quality',
    description:
      '4K video with spatial audio, screen sharing, and real-time collaboration tools for the best meeting experience.',
    color: 'primary',
    mockup: 'video',
  },
  {
    icon: Share2,
    title: 'Screen Sharing',
    description:
      'Share your screen, application windows, or browser tabs with crystal-clear quality. Perfect for presentations and demos.',
    color: 'blue',
    mockup: 'screen-share',
  },
  {
    icon: FileText,
    title: 'Recording & Transcripts',
    description:
      'Automatically record meetings and get AI-powered transcripts. Search through past meetings and share recordings instantly.',
    color: 'purple',
    mockup: 'recording',
  },
];

interface MockupComponentProps {
  type: string;
  color: 'primary' | 'green' | 'yellow' | 'blue' | 'purple' | 'pink';
}

const MockupComponent = ({ type, color }: MockupComponentProps) => {
  const iconColors = {
    primary: 'text-primary',
    green: 'text-green-500',
    yellow: 'text-yellow-500',
    blue: 'text-blue-500',
    purple: 'text-purple-500',
    pink: 'text-pink-500',
  };

  const renderMockup = () => {
    switch (type) {
      case 'calendar':
        return (
          <div className="p-4 space-y-3 bg-white dark:bg-slate-900 rounded-lg border border-border">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <Calendar className={cn('w-5 h-5', iconColors[color])} />
              <div className="text-sm font-semibold text-foreground">
                August 2024
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <div
                  key={i}
                  className="text-xs text-center text-muted-foreground py-1 font-medium"
                >
                  {day}
                </div>
              ))}
              {Array.from({ length: 35 }, (_, i) => {
                const day = i + 1;
                const isSelected = day === 8 || day === 13;
                const isToday = day === 15;
                return (
                  <div
                    key={i}
                    className={cn(
                      'aspect-square rounded-md text-xs flex items-center justify-center font-medium transition-colors',
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : isToday
                        ? 'bg-muted text-foreground border-2 border-primary'
                        : 'text-muted-foreground hover:bg-muted/50'
                    )}
                  >
                    {day <= 31 ? day : ''}
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'invite':
        return (
          <div className="p-4 space-y-3 bg-white dark:bg-slate-900 rounded-lg border border-border">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Mail className={cn('w-5 h-5', iconColors[color])} />
              <span className="text-sm font-semibold text-foreground">
                Email Invite
              </span>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-foreground/20 rounded w-full"></div>
              <div className="h-3 bg-foreground/20 rounded w-4/5"></div>
              <div className="h-2 bg-foreground/10 rounded w-3/4 mt-3"></div>
              <div className="h-2 bg-foreground/10 rounded w-full"></div>
              <div className="h-2 bg-foreground/10 rounded w-5/6"></div>
              <div className="h-2 bg-foreground/10 rounded w-4/5"></div>
              <div className="h-2 bg-foreground/10 rounded w-full mt-3"></div>
              <div className="h-2 bg-foreground/10 rounded w-3/4"></div>
              <div className="h-2 bg-foreground/10 rounded w-5/6"></div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md mt-3">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                5 participants
              </span>
            </div>
            <div className="flex gap-2 pt-2">
              <div className="h-7 bg-primary rounded-md w-24 flex items-center justify-center">
                <span className="text-xs text-primary-foreground font-medium">
                  Send
                </span>
              </div>
              <div className="h-7 bg-muted rounded-md w-20 flex items-center justify-center">
                <span className="text-xs text-muted-foreground">Preview</span>
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="p-4 space-y-3 bg-white dark:bg-slate-900 rounded-lg border border-border">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Shield className={cn('w-5 h-5', iconColors[color])} />
              <span className="text-sm font-semibold text-foreground">
                Security Status
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-muted-foreground">
                  Encryption
                </span>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                    Active
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-muted-foreground">
                  End-to-End
                </span>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                    Enabled
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-muted-foreground">
                  Two-Factor Auth
                </span>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                    Enabled
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-muted-foreground">
                  Secure Rooms
                </span>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                    Active
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-muted-foreground">
                  Privacy Mode
                </span>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                    Enabled
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-foreground/10 rounded-full overflow-hidden mt-3">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: '100%' }}
                ></div>
              </div>
              <div className="text-center pt-2">
                <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                  Enterprise Grade Security
                </span>
              </div>
            </div>
          </div>
        );

      case 'speed':
        return (
          <div className="p-4 space-y-3 bg-white dark:bg-slate-900 rounded-lg border border-border w-full">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Zap className={cn('w-5 h-5', iconColors[color])} />
              <span className="text-sm font-semibold text-foreground">
                Connection Speed
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-lg">
                  <span className="text-xs text-muted-foreground mb-1">
                    Join Time
                  </span>
                  <span className="text-2xl font-bold text-foreground">2s</span>
                </div>
                <div className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-lg">
                  <span className="text-xs text-muted-foreground mb-1">
                    Latency
                  </span>
                  <span className="text-2xl font-bold text-foreground">
                    12ms
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-lg">
                  <span className="text-xs text-muted-foreground mb-1">
                    Quality
                  </span>
                  <span className="text-sm font-bold text-green-600 dark:text-green-400">
                    Excellent
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-lg">
                  <span className="text-xs text-muted-foreground mb-1">
                    Uptime
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    99.9%
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-foreground/10 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full', {
                    'bg-yellow-500': color === 'yellow',
                    'bg-primary': color === 'primary',
                  })}
                  style={{ width: '98%' }}
                ></div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Optimized Connection</span>
                <span className="text-green-600 dark:text-green-400 font-semibold">
                  Active
                </span>
              </div>
            </div>
          </div>
        );

      case 'network':
        return (
          <div className="p-4 space-y-3 bg-white dark:bg-slate-900 rounded-lg border border-border w-full">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Globe className={cn('w-5 h-5', iconColors[color])} />
              <span className="text-sm font-semibold text-foreground">
                Global Network
              </span>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {['US', 'EU', 'AS', 'AU'].map((region, i) => (
                  <div
                    key={i}
                    className="text-center p-2 bg-muted rounded-md relative"
                  >
                    <div className="w-2 h-2 bg-green-500 rounded-full absolute top-1 right-1 animate-pulse"></div>
                    <div className="text-xs font-semibold text-foreground">
                      {region}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Active
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {['JP', 'BR', 'IN', 'UK'].map((region, i) => (
                  <div
                    key={i}
                    className="text-center p-2 bg-muted rounded-md relative"
                  >
                    <div className="w-2 h-2 bg-green-500 rounded-full absolute top-1 right-1 animate-pulse"></div>
                    <div className="text-xs font-semibold text-foreground">
                      {region}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Active
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  <span>50+ regions</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                    All Online
                  </span>
                </div>
              </div>
              <div className="text-center p-2 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-md border border-blue-500/20">
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  Low Latency Worldwide
                </span>
              </div>
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="p-4 space-y-3 bg-white dark:bg-slate-900 rounded-lg border border-border">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Video className={cn('w-5 h-5', iconColors[color])} />
              <span className="text-sm font-semibold text-foreground">
                Video Quality
              </span>
            </div>
            <div className="space-y-2">
              <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 rounded-md flex items-center justify-center border border-primary/20">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-semibold text-foreground">
                    4K Active
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Resolution</span>
                <span className="font-semibold text-foreground">
                  3840 × 2160
                </span>
              </div>
            </div>
          </div>
        );

      case 'screen-share':
        return (
          <div className="p-4 space-y-3 bg-white dark:bg-slate-900 rounded-lg border border-border">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Monitor className={cn('w-5 h-5', iconColors[color])} />
              <span className="text-sm font-semibold text-foreground">
                Screen Share
              </span>
            </div>
            <div className="space-y-2">
              <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-md flex items-center justify-center border border-border">
                <div className="text-center">
                  <Monitor className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <span className="text-xs text-muted-foreground">
                    Sharing screen...
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 h-6 bg-primary/10 rounded text-xs flex items-center justify-center text-primary font-medium">
                  Full Screen
                </div>
                <div className="flex-1 h-6 bg-muted rounded text-xs flex items-center justify-center text-muted-foreground">
                  Window
                </div>
              </div>
            </div>
          </div>
        );

      case 'recording':
        return (
          <div className="p-4 space-y-3 bg-white dark:bg-slate-900 rounded-lg border border-border">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <FileText className={cn('w-5 h-5', iconColors[color])} />
              <span className="text-sm font-semibold text-foreground">
                Recording
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-semibold text-foreground">
                  Recording in progress...
                </span>
              </div>
              <div className="space-y-2">
                <div className="h-2 bg-foreground/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: '65%' }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-semibold text-foreground">15:32</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-muted/50 rounded-md">
                  <div className="text-[10px] text-muted-foreground">
                    Transcript
                  </div>
                  <div className="text-xs font-semibold text-green-600 dark:text-green-400">
                    Available
                  </div>
                </div>
                <div className="p-2 bg-muted/50 rounded-md">
                  <div className="text-[10px] text-muted-foreground">
                    Quality
                  </div>
                  <div className="text-xs font-semibold text-foreground">
                    4K HD
                  </div>
                </div>
              </div>
              <div className="p-2 bg-purple-500/10 rounded-md border border-purple-500/20">
                <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 text-center">
                  AI Processing Active
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return <div className="w-full">{renderMockup()}</div>;
};

interface FeatureCardProps {
  icon: typeof Calendar;
  title: string;
  description: string;
  color: 'primary' | 'green' | 'yellow' | 'blue' | 'purple' | 'pink';
  mockup: string;
  index: number;
  isVisible: boolean;
  span?: 1 | 2;
}

const FeatureCard = ({
  title,
  description,
  color,
  mockup,
  index,
  isVisible,
  span,
}: FeatureCardProps) => {
  return (
    <div
      className={cn(
        'group bg-card border border-border rounded-xl overflow-hidden',
        'hover:shadow-lg hover:border-primary/30',
        'transition-all duration-300 hover:-translate-y-1 flex flex-col',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        // Default: span 2 columns (1/3 width in 6-column grid)
        // With span prop: span 3 columns (1/2 width in 6-column grid)
        span ? 'lg:col-span-3' : 'lg:col-span-2'
      )}
      style={{
        transitionDelay: `${index * 50}ms`,
      }}
    >
      {/* Mockup Image - Full width, flexible height */}
      <div className="w-full p-4 bg-gradient-to-br from-muted/50 to-muted/30 border-b border-border/50">
        <MockupComponent type={mockup} color={color} />
      </div>

      {/* Title */}
      <div className="p-4 pb-2">
        <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
          {title}
        </h3>
      </div>

      {/* Description */}
      <div className="p-4 pt-0 flex-1">
        <p className="text-muted-foreground leading-relaxed text-sm">
          {description}
        </p>
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
              }, index * 50);
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
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header Section - Matching image style */}
        <div className="text-center space-y-4 mb-12">
          <div className="inline-flex items-center justify-center">
            <span className="px-4 py-1.5 text-xs font-medium rounded-full bg-primary/10 text-primary border border-primary/20">
              One Stop Solution
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-foreground">
            Powerful features
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need for a productive, secure, and enjoyable
            meetings.
          </p>
        </div>

        {/* Integrations Beam */}
        <div className="mb-16">
          <IntegrationsBeam />
        </div>

        {/* Grid Features - 6 columns for middle row span control */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 lg:gap-4">
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
              span={feature.span}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
