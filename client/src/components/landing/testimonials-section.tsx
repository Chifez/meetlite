import { motion } from 'motion/react';
import { Quote } from 'lucide-react';

const TESTIMONIALS = [
  {
    name: 'Sarah Chen',
    role: 'VP of Engineering',
    company: 'TechStart',
    content: 'The integrated canvas completely replaced our need for three separate tools during architecture reviews. It’s seamlessly fast.',
    initials: 'SC',
  },
  {
    name: 'Marcus Rodriguez',
    role: 'Head of Product',
    company: 'DesignCo',
    content: 'Being able to drop a sticky note onto the live video feed is the kind of magic I never knew we needed. We save hours every week.',
    initials: 'MR',
  },
  {
    name: 'Emily Johnson',
    role: 'Director of Operations',
    company: 'Growth Labs',
    content: 'The AI transcripts perfectly label speakers even when our entire engineering team is talking over each other. Flawless execution.',
    initials: 'EJ',
  },
  {
    name: 'David Kim',
    role: 'Lead Designer',
    company: 'PixelPerfect',
    content: 'Figma imports with sub-10ms cursor sync means we are actually designing together, not just watching someone screen share.',
    initials: 'DK',
  },
  {
    name: 'Jessica Lee',
    role: 'CEO',
    company: 'Acme Corp',
    content: 'We migrated our entire 200-person team to MeetLite. The stability and video quality over unstable networks is unmatched.',
    initials: 'JL',
  },
];

export const TestimonialsSection = () => {
  return (
    <section className="py-24 lg:py-32 bg-background dark:bg-[#09090b] border-b border-border overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-16 text-center">
        <h2 className="text-4xl md:text-5xl font-display font-medium text-foreground tracking-tight">
          What high-performing <br className="sm:hidden" /> teams say
        </h2>
      </div>

      <div className="relative flex overflow-hidden py-8">
        {/* Gradient fade masks */}
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background dark:from-[#09090b] to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background dark:from-[#09090b] to-transparent z-10 pointer-events-none" />
        
        <motion.div 
          className="flex space-x-6 px-6"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ 
            repeat: Infinity, 
            ease: 'linear', 
            duration: 40 
          }}
        >
          {/* Double array for seamless infinite scroll */}
          {[...TESTIMONIALS, ...TESTIMONIALS].map((t, idx) => (
            <div 
              key={idx}
              className="flex-shrink-0 w-[350px] md:w-[450px] bg-card border border-border rounded-[32px] p-8 shadow-sm flex flex-col"
            >
              <Quote className="w-8 h-8 text-primary/20 mb-6" />
              <p className="text-lg md:text-xl text-foreground font-medium leading-relaxed mb-8 flex-1">
                "{t.content}"
              </p>
              
              <div className="flex items-center gap-4 mt-auto pt-6 border-t border-border/50">
                <div className="w-12 h-12 rounded-[16px] bg-background border border-border flex items-center justify-center shadow-sm">
                  <span className="text-sm font-bold text-foreground">{t.initials}</span>
                </div>
                <div>
                  <p className="font-bold text-foreground font-display">
                    {t.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t.role}, {t.company}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
