import { motion } from 'motion/react';

const STATS = [
  {
    value: '99.9%',
    label: 'Uptime Reliability',
    subtext: 'Built on a globally distributed edge network.',
  },
  {
    value: '< 50ms',
    label: 'Audio/Video Latency',
    subtext: 'Real-time sync feeling exactly like being in the room.',
  },
  {
    value: 'HD 1080p',
    label: 'Video Quality',
    subtext: 'Crystal clear presentations even on low bandwidth.',
  },
];

export const StatsSection = () => {
  return (
    <section className="relative py-24 lg:py-32 bg-background dark:bg-[#09090b] border-b border-border overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:24px_24px] opacity-40 [mask-image:linear-gradient(to_bottom,white,transparent)]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center text-center">
        <p className="text-sm font-semibold text-muted-foreground mb-6 uppercase tracking-widest">
          The Measurable Impact
        </p>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-medium text-foreground max-w-4xl mx-auto mb-16 leading-tight tracking-tight">
          We built an intuitive shared workspace backed by a proprietary media engine, to give your team fast, reliable, and secure meetings.
        </h2>

        <div className="flex flex-col md:flex-row justify-center items-stretch gap-6 w-full max-w-5xl">
          {STATS.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: idx * 0.1 }}
              className={`flex-1 flex flex-col justify-center items-center text-center bg-card/80 backdrop-blur-md border border-border rounded-[32px] p-10 min-h-[300px] shadow-sm hover:shadow-apple transition-shadow ${
                idx === 1 ? 'md:-translate-y-8 z-10 shadow-soft' : ''
              }`}
            >
              <div className="text-5xl md:text-6xl font-display font-medium text-foreground tracking-tighter mb-4">
                {stat.value}
              </div>
              <div className="text-sm font-bold text-foreground uppercase tracking-widest mb-3">
                {stat.label}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                {stat.subtext}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
