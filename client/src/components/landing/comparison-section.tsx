import { motion } from 'motion/react';
import { CheckCircle2, XCircle } from 'lucide-react';

const COMPARISON = [
  { feature: 'Multiplayer Whiteboarding', them: false, us: true },
  { feature: 'Sub-50ms Global Latency', them: false, us: true },
  { feature: 'End-to-End Encryption', them: 'Add-on', us: 'Default' },
  { feature: 'AI Transcripts', them: 'Third-party', us: 'Built-in' },
  { feature: 'Guest Access without account', them: false, us: true },
  { feature: 'Unlimited Recording', them: false, us: true },
];

export const ComparisonSection = () => {
  return (
    <section className="py-24 lg:py-32 bg-background dark:bg-[#09090b] border-b border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-widest">
            The Difference
          </p>
          <h2 className="text-4xl md:text-5xl font-display font-medium text-foreground tracking-tight">
            Why teams switch to MeetLite
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 relative">
          
          {/* Them */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col bg-muted/30 border border-border/50 rounded-[32px] p-8 md:p-10 opacity-70 filter grayscale"
          >
            <div className="text-center mb-8 pb-8 border-b border-border">
              <h3 className="text-2xl font-display font-medium text-muted-foreground">Traditional Tools</h3>
            </div>
            
            <ul className="space-y-6 flex-1">
              {COMPARISON.map((item, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{item.feature}</span>
                  {typeof item.them === 'boolean' ? (
                    item.them ? (
                      <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <XCircle className="w-5 h-5 text-muted-foreground/40" />
                    )
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">{item.them}</span>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* VS Badge (Desktop) */}
          <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-background border border-border rounded-full items-center justify-center shadow-sm z-10">
            <span className="text-xs font-bold text-muted-foreground">VS</span>
          </div>

          {/* Us */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col bg-card border-2 border-primary/20 rounded-[32px] p-8 md:p-10 shadow-elevated relative overflow-hidden"
          >
            {/* Subtle primary glow */}
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
            
            <div className="text-center mb-8 pb-8 border-b border-border relative z-10">
              <div className="inline-flex items-center space-x-2">
                <span className="text-2xl font-display font-medium text-foreground">MeetLite</span>
                <span className="bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">Pro</span>
              </div>
            </div>
            
            <ul className="space-y-6 flex-1 relative z-10">
              {COMPARISON.map((item, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span className="text-foreground font-medium">{item.feature}</span>
                  {typeof item.us === 'boolean' ? (
                    item.us ? (
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    ) : (
                      <XCircle className="w-5 h-5 text-muted-foreground" />
                    )
                  ) : (
                    <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">{item.us}</span>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

export default ComparisonSection;
