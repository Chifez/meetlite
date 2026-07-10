import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PenTool, Code, Presentation } from 'lucide-react';
import { cn } from '@/lib/utils';

const USE_CASES = [
  {
    id: 'design',
    title: 'Design Reviews',
    icon: PenTool,
    headline: 'Stop explaining. Start pointing.',
    description: 'Import your Figma frames directly onto the canvas. Use multiplayer cursors to point exactly at what needs changing, drop pins, and leave sticky notes that sync directly back to your design tools.',
    stats: 'Reduce review time by 40%',
  },
  {
    id: 'engineering',
    title: 'Engineering Standups',
    icon: Code,
    headline: 'Architecture diagrams that live and breathe.',
    description: 'Map out your next microservice architecture while on the call. Drag and drop components, draw relationships, and have AI generate the initial skeleton code from your diagram.',
    stats: 'Average standup length: < 12 mins',
  },
  {
    id: 'client',
    title: 'Client Presentations',
    icon: Presentation,
    headline: 'Make them part of the process.',
    description: 'Give clients an interactive seat at the table. They don’t need an account to join the canvas—just share the link and start co-creating moodboards and roadmaps instantly.',
    stats: 'Zero-friction guest access',
  },
];

export const UseCasesSection = () => {
  const [activeTab, setActiveTab] = useState(USE_CASES[0].id);

  const activeCase = USE_CASES.find(c => c.id === activeTab)!;

  return (
    <section className="py-24 bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Built for the way you work</h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Whether you're designing the next big feature or presenting to stakeholders, MeetLite adapts to your team's workflow.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12">
          {/* Tabs */}
          <div className="lg:w-1/3 flex flex-col space-y-2">
            {USE_CASES.map((useCase) => {
              const Icon = useCase.icon;
              const isActive = activeTab === useCase.id;
              return (
                <button
                  key={useCase.id}
                  onClick={() => setActiveTab(useCase.id)}
                  className={cn(
                    'flex items-center space-x-4 p-4 rounded-xl text-left transition-all duration-200 border',
                    isActive 
                      ? 'bg-background border-border shadow-sm' 
                      : 'border-transparent hover:bg-background/50 hover:border-border/50'
                  )}
                >
                  <div className={cn(
                    'p-2.5 rounded-lg transition-colors',
                    isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={cn(
                    'font-semibold text-lg transition-colors',
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {useCase.title}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="lg:w-2/3 bg-background rounded-3xl border border-border p-8 sm:p-12 min-h-[400px] flex items-center relative overflow-hidden">
            {/* Background decorative element */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

            <AnimatePresence mode="wait">
              <motion.div
                key={activeCase.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="relative z-10 space-y-6 max-w-xl"
              >
                <div className="inline-flex px-3 py-1 bg-warm/10 text-warm border border-warm/20 rounded-full text-sm font-semibold tracking-wide">
                  {activeCase.stats}
                </div>
                <h3 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
                  {activeCase.headline}
                </h3>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {activeCase.description}
                </p>
                
                {/* Mock Visual representation for each case */}
                <div className="mt-8 pt-8 border-t border-border">
                   <div className="flex items-center space-x-4 text-sm font-semibold text-primary cursor-pointer group">
                      <span>Explore this workflow</span>
                      <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                   </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};

export default UseCasesSection;
