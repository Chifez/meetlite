import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
const EdgeRoutingGraphic = () => (
  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5" className="w-32 h-32 mx-auto text-foreground/60 dark:text-foreground/40">
    {Array.from({ length: 15 }).map((_, i) => (
      <ellipse
        key={i}
        cx="50"
        cy={25 + i * 3.5}
        rx="35"
        ry="12"
      />
    ))}
  </svg>
);

const VideoQualityGraphic = () => (
  <svg viewBox="0 0 100 100" fill="currentColor" className="w-32 h-32 mx-auto text-foreground/60 dark:text-foreground/40">
    {Array.from({ length: 16 }).map((_, i) => {
      return Array.from({ length: 8 }).map((_, j) => {
        const angle = (i * (360 / 16)) * (Math.PI / 180);
        const radius = 10 + j * 4;
        const cx = 50 + Math.cos(angle) * radius;
        const cy = 50 + Math.sin(angle) * radius;
        return (
          <circle
            key={`${i}-${j}`}
            cx={cx}
            cy={cy}
            r={1.5 - (j * 0.15)}
          />
        );
      });
    })}
  </svg>
);

const NoiseCancellationGraphic = () => (
  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5" className="w-32 h-32 mx-auto text-foreground/60 dark:text-foreground/40">
    <g>
      <path d="M20,50 Q40,10 60,50 T100,50" />
      <path d="M10,40 Q30,80 50,40 T90,40" />
      <path d="M30,60 Q50,20 70,60 T110,60" />
      <path d="M15,55 Q35,15 55,55 T95,55" />
      <path d="M25,45 Q45,85 65,45 T105,45" />
      <path d="M0,50 Q20,90 40,50 T80,50" />
    </g>
  </svg>
);

const FEATURES = [
  {
    title: 'Advanced Management',
    description: 'The most advanced routing architecture connects you to the nearest edge server instantly, dramatically reducing latency without compromising quality.',
    Graphic: EdgeRoutingGraphic,
    link: 'Read more'
  },
  {
    title: 'Acceleration',
    description: 'Our optimization can significantly increase the speed experience by dynamically adjusting resolution and framerates even on degraded connections.',
    Graphic: VideoQualityGraphic,
    link: 'Read more'
  },
  {
    title: 'Monitoring',
    description: 'Sophisticated measurements actively filter out background chatter and monitor the network quality you are getting from the providers.',
    Graphic: NoiseCancellationGraphic,
    link: 'Read more'
  }
];

export const UseCasesSection = () => {
  return (
    <section className="relative bg-[#FAFAFA] dark:bg-[#09090b] border-b border-border font-sans">

      {/* Container with explicit outer grid borders */}
      <div className="max-w-7xl mx-auto border-x border-border/60">

        {/* Top Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-b border-border/60">
          <div className="py-8 md:col-span-2 border-r border-border/60 flex items-center">
            <h2 className="text-4xl md:text-5xl lg:text-6xl border-y px-8 border-border/60 w-full font-medium tracking-tight text-foreground leading-[1.1]">
              How we keep your <br /> calls flawless
            </h2>
          </div>
          <div className="py-8  flex items-center">
            <p className="py-8 text-sm text-muted-foreground leading-relaxed border-y px-8 border-border/60 w-full ">
              Behind the clean interface is a highly optimized, enterprise-grade media engine built to handle unstable networks and global teams seamlessly.
            </p>
          </div>
        </div>

        {/* Middle Row (Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-b border-border/60">
          {FEATURES.map((feature, idx) => {
            const Graphic = feature.Graphic;
            return (
              <div
                key={idx}
                className={`py-8 flex items-stretch ${idx !== FEATURES.length - 1 ? 'border-b md:border-b-0 md:border-r border-border/60' : ''}`}
              >
                <div className="border-y border-border/60 w-full px-8 py-8 flex items-stretch">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                    className="bg-white dark:bg-[#111] rounded-2xl p-6 flex flex-col w-full shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/5 dark:border-white/10"
                  >
                    {/* Graphic Area */}
                    <div className="flex-1 flex items-center justify-center mb-6 h-[100px] md:h-[120px]">
                      <Graphic />
                    </div>

                    {/* Text Area */}
                    <div className="flex flex-col gap-2">
                      <h3 className="text-base font-semibold text-foreground">
                        {feature.title}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {feature.description}
                      </p>
                      <a href="#" className="text-xs font-medium text-foreground hover:text-primary transition-colors mt-2 inline-flex items-center gap-1 border-b border-foreground/30 hover:border-primary/50 w-fit pb-0.5 group">
                        {feature.link} <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                      </a>
                    </div>
                  </motion.div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 md:grid-cols-3">
          <div className="py-8 flex items-center border-b md:border-b-0 md:border-r border-border/60">
            <p className="py-8 px-8 border-y border-border/60 w-full text-xs text-muted-foreground leading-relaxed">
              Our advanced tools and expert strategies pinpoint potential issues before they impact your call, delivering consistent speed, reliability, and peace of mind.
            </p>
          </div>
          <div className="hidden md:flex py-8 border-r border-border/60 items-stretch">
             {/* empty cell with matching horizontal lines */}
             <div className="border-y border-border/60 w-full"></div>
          </div>
          <div className="py-8 flex items-center">
            <p className="py-8 px-8 border-y border-border/60 w-full text-xs text-muted-foreground leading-relaxed">
              We leverage advanced analytics and automation to boost performance, minimize latency spikes, and keep your meetings running smoothly.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
};

export default UseCasesSection;
