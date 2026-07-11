import { motion } from 'motion/react';
import { Share2, Workflow } from 'lucide-react';

const EdgeRoutingGraphic = () => (
  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5" className="w-32 h-32 text-foreground/40 dark:text-foreground/20">
    {Array.from({ length: 15 }).map((_, i) => (
      <ellipse key={i} cx="50" cy={25 + i * 3.5} rx="35" ry="12" />
    ))}
  </svg>
);

const VideoQualityGraphic = () => (
  <svg viewBox="0 0 100 100" fill="currentColor" className="w-32 h-32 text-foreground/40 dark:text-foreground/20">
    {Array.from({ length: 16 }).map((_, i) => {
      return Array.from({ length: 8 }).map((_, j) => {
        const angle = (i * (360 / 16)) * (Math.PI / 180);
        const radius = 10 + j * 4;
        const cx = 50 + Math.cos(angle) * radius;
        const cy = 50 + Math.sin(angle) * radius;
        return <circle key={`${i}-${j}`} cx={cx} cy={cy} r={1.5 - (j * 0.15)} />;
      });
    })}
  </svg>
);

const DotGridGraphic = () => (
  <svg viewBox="0 0 100 100" fill="currentColor" className="w-48 h-48 text-foreground/30 dark:text-foreground/20">
    {Array.from({ length: 12 }).map((_, i) => {
      return Array.from({ length: 12 }).map((_, j) => {
        return <circle key={`${i}-${j}`} cx={4 + i * 8.5} cy={4 + j * 8.5} r="1.2" />;
      });
    })}
  </svg>
);

const NoiseCancellationGraphic = () => (
  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5" className="w-40 h-40 text-foreground/40 dark:text-foreground/20">
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

const NetworkConstellationGraphic = () => (
  <div className="absolute inset-0 overflow-hidden flex items-center justify-center opacity-80 dark:opacity-60 pointer-events-none">
    <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" strokeWidth="0.75" className="text-foreground/20 dark:text-foreground/30">
      <motion.g
        animate={{ rotate: [0, 2, -2, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: "200px 100px" }}
      >
        <circle cx="100" cy="80" r="2" fill="currentColor" />
        <circle cx="180" cy="50" r="2.5" fill="currentColor" />
        <circle cx="280" cy="70" r="2" fill="currentColor" />
        <circle cx="320" cy="140" r="2.5" fill="currentColor" />
        <circle cx="220" cy="160" r="2" fill="currentColor" />
        <circle cx="120" cy="140" r="2.5" fill="currentColor" />
        <circle cx="200" cy="100" r="3" fill="currentColor" />
        
        <motion.line x1="100" y1="80" x2="180" y2="50" animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} />
        <motion.line x1="180" y1="50" x2="280" y2="70" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 5, repeat: Infinity, delay: 1, ease: "easeInOut" }} />
        <motion.line x1="280" y1="70" x2="320" y2="140" animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 6, repeat: Infinity, delay: 2, ease: "easeInOut" }} />
        <motion.line x1="320" y1="140" x2="220" y2="160" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 4, repeat: Infinity, delay: 1.5, ease: "easeInOut" }} />
        <motion.line x1="220" y1="160" x2="120" y2="140" animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 5, repeat: Infinity, delay: 0.5, ease: "easeInOut" }} />
        <motion.line x1="120" y1="140" x2="100" y2="80" animate={{ opacity: [0.4, 0.9, 0.4] }} transition={{ duration: 4.5, repeat: Infinity, delay: 2.5, ease: "easeInOut" }} />
        
        <motion.line x1="200" y1="100" x2="180" y2="50" animate={{ opacity: [0.2, 0.7, 0.2] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} />
        <motion.line x1="200" y1="100" x2="280" y2="70" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 4, repeat: Infinity, delay: 1, ease: "easeInOut" }} />
        <motion.line x1="200" y1="100" x2="220" y2="160" animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 3.5, repeat: Infinity, delay: 2, ease: "easeInOut" }} />
        <motion.line x1="200" y1="100" x2="120" y2="140" animate={{ opacity: [0.4, 0.9, 0.4] }} transition={{ duration: 5, repeat: Infinity, delay: 0.5, ease: "easeInOut" }} />
      </motion.g>
    </svg>
  </div>
);

const FeatureSection = () => {
  return (
    <section className="relative py-24 lg:py-32 bg-background dark:bg-[#09090b] border-b border-border overflow-hidden">
      {/* Decorative Grid Background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="mb-16 md:mb-24 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              <Workflow className="w-3 h-3 mr-2 text-primary" />
              Built for Performance
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-medium text-foreground tracking-tight leading-tight">
              We've orchestrated <br />
              <span className="text-primary italic font-serif">Collaboration.</span>
            </h2>
          </div>
          <p className="max-w-md text-lg text-muted-foreground leading-relaxed">
            MeetLite brings clarity, not complexity—uniting video, whiteboarding, and transcription into one adaptive system that empowers your team.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card 01 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col justify-between bg-card border border-border rounded-[32px] p-8 shadow-sm hover:shadow-soft transition-shadow group relative overflow-hidden"
          >
            <div className="absolute -right-8 -top-8 opacity-40 group-hover:opacity-100 transition-opacity">
              <DotGridGraphic />
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <span className="text-5xl font-display font-light text-muted-foreground/30 group-hover:text-primary transition-colors">01.</span>
              <div className="mt-20">
                <h3 className="text-xl font-display font-medium text-foreground mb-2">Interactive Whiteboards</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  Ideate in real-time. Sub-10ms latency cursor sync for seamless multiplayer creativity.
                </p>
              </div>
            </div>
          </motion.div>

          {/* MAIN CARD (Spans 2 columns) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 flex flex-col bg-card border border-border rounded-[32px] shadow-sm hover:shadow-soft transition-shadow overflow-hidden group"
          >
            {/* Abstract Graphic Area */}
            <div className="relative h-64 bg-background w-full overflow-hidden flex items-center justify-center border-b border-border">
              <span className="absolute top-8 left-8 text-5xl font-display font-light text-muted-foreground/30 group-hover:text-primary transition-colors z-10">02.</span>
              <NetworkConstellationGraphic />
            </div>
            
            <div className="p-8 flex-1 flex flex-col justify-end">
              <h3 className="text-3xl font-display font-medium text-foreground mb-3">Command Team Sync</h3>
              <p className="text-muted-foreground leading-relaxed">
                Coordinate your entire organization through a unified platform that ensures high-fidelity video, instantaneous file sharing, and zero lag anywhere you operate.
              </p>
            </div>
          </motion.div>

          {/* Cards 03 & 04 (Stacked in one column) */}
          <div className="flex flex-col gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="flex-1 flex flex-col justify-between bg-card border border-border rounded-[32px] p-6 shadow-sm hover:shadow-soft transition-shadow group relative overflow-hidden"
            >
              <div className="absolute -right-6 -top-6 opacity-30 group-hover:opacity-100 transition-opacity">
                <EdgeRoutingGraphic />
              </div>
              <div className="relative z-10">
                <span className="text-4xl font-display font-light text-muted-foreground/30 group-hover:text-primary transition-colors block mb-8">03.</span>
                <h3 className="text-lg font-display font-medium text-foreground mb-1">HD Screen Sharing</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Crystal clear presentations with adaptive bitrate streaming.
                </p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="flex-1 flex flex-col justify-between bg-card border border-border rounded-[32px] p-6 shadow-sm hover:shadow-soft transition-shadow group relative overflow-hidden"
            >
              <div className="absolute -right-6 -top-6 opacity-30 group-hover:opacity-100 transition-opacity">
                <VideoQualityGraphic />
              </div>
              <div className="relative z-10">
                <span className="text-4xl font-display font-light text-muted-foreground/30 group-hover:text-primary transition-colors block mb-8">04.</span>
                <h3 className="text-lg font-display font-medium text-foreground mb-1">Instant Transcripts</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  AI-generated notes and action items the moment the call ends.
                </p>
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default FeatureSection;
