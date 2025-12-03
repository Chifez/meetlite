import { useRef } from 'react';
import { AnimatedBeam } from '@/components/ui/animated-beam';
import {
  Calendar,
  Mail,
  Slack,
  Github,
  Zap,
  Globe,
  Video,
  Settings,
} from 'lucide-react';

const integrations = [
  { name: 'Google Calendar', icon: Calendar },
  { name: 'Outlook', icon: Mail },
  { name: 'Slack', icon: Slack },
  { name: 'GitHub', icon: Github },
  { name: 'Zapier', icon: Zap },
  { name: 'Webhooks', icon: Globe },
];

const IntegrationsBeam = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const integrationRefs = integrations.map(() => useRef<HTMLDivElement>(null));

  return (
    <div
      className="relative h-full flex flex-col items-center justify-center "
      ref={containerRef}
    >
      <div className="flex size-full max-w-lg h-full flex-col items-stretch justify-between gap-28">
        <div className="flex justify-center">
          <div
            ref={centerRef}
            className="z-10 flex items-center justify-center w-10 h-10 rounded-full bg-card border-2 border-primary shadow-lg"
          >
            <Video className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>

        <div className="flex justify-center">
          <div
            ref={midRef}
            className="z-10 flex items-center justify-center w-10 h-10 rounded-full bg-card border-2  shadow-lg"
          >
            <Settings className="animate-spin duration-10 w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
        {/* Integration Icons */}
        <div className="flex justify-center items-center gap-7 md:gap-13 max-w-full">
          {integrations.map((integration, index) => {
            const Icon = integration.icon;
            return (
              <div
                key={index}
                ref={integrationRefs[index]}
                className="z-10 flex flex-col items-center gap-2"
              >
                <div className="size-8 md:size-12 rounded-full bg-card border border-border flex items-center justify-center shadow-md hover:shadow-lg hover:border-primary/50 transition-all duration-300 group">
                  <Icon className="size-4 md:size-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <span className="text-xs font-medium text-muted-foreground text-center max-w-[80px]">
                  {integration.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {/* Center Logo */}

      {/* Animated Beams */}
      {integrationRefs.map((ref, index) => (
        <AnimatedBeam
          key={index}
          containerRef={containerRef}
          fromRef={midRef}
          toRef={ref}
          duration={3}
          delay={index * 0.2}
          pathColor="rgb(147, 51, 234)"
          pathWidth={2}
          pathOpacity={0.3}
          gradientStartColor="#9333ea"
          gradientStopColor="#3b82f6"
        />
      ))}
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={midRef}
        toRef={centerRef}
        pathColor="rgb(147, 51, 234)"
        pathWidth={2}
        pathOpacity={0.3}
        gradientStartColor="#9333ea"
        gradientStopColor="#3b82f6"
      />
      {/* <AnimatedBeam
        containerRef={containerRef}
        fromRef={midRef}
        toRef={centerRef}
        pathColor="rgb(147, 51, 234)"
        pathWidth={2}
        pathOpacity={0.3}
        gradientStartColor="#9333ea"
        gradientStopColor="#3b82f6"
      /> */}
    </div>
  );
};

export default IntegrationsBeam;
