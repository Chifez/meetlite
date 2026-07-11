import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const FAQS = [
  {
    id: '01',
    question: 'How does the multiplayer canvas sync so fast?',
    answer: 'We built our own custom CRDT (Conflict-free Replicated Data Type) engine optimized for WebRTC data channels. This allows us to sync cursor movements and object updates in under 10ms globally, without routing through a central server.',
  },
  {
    id: '02',
    question: 'Do external guests need an account to join?',
    answer: 'No. You can generate a secure guest link that allows clients or contractors to join the call and interact with the canvas immediately in their browser. No downloads or sign-ups required.',
  },
  {
    id: '03',
    question: 'Are my whiteboards and transcripts really private?',
    answer: 'Absolutely. We use AES-256-GCM End-to-End Encryption for all media and data channels by default. Your transcripts are generated ephemerally and never stored or used to train external AI models.',
  },
  {
    id: '04',
    question: 'Can I import from Figma or Miro?',
    answer: 'Yes! Our Pro and Enterprise tiers support direct importing of Figma frames and Miro boards right onto the MeetLite canvas, so you can review designs without switching context.',
  },
  {
    id: '05',
    question: 'How do you handle unstable internet connections?',
    answer: 'Our adaptive media engine continuously monitors packet loss and bandwidth. If your connection drops, we dynamically lower video resolution to prioritize crystal-clear audio and uninterrupted canvas synchronization.',
  },
];

export const FaqSection = () => {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="py-24 lg:py-32 bg-[#0A0A0B] relative overflow-hidden flex justify-center">
      
      {/* Inner White Container */}
      <div className="relative z-10 w-full max-w-5xl px-4 sm:px-6">
        <div className="bg-[#F5F5F7] dark:bg-[#121214] rounded-[40px] p-8 md:p-16 shadow-2xl">
          
          <div className="flex flex-col items-center text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-background border border-border rounded-full px-3 py-1 mb-6 shadow-sm">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">FAQ</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-medium text-foreground tracking-tight">
              Common Questions
            </h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {FAQS.map((faq) => {
              const isOpen = openId === faq.id;
              
              return (
                <div 
                  key={faq.id}
                  className={cn(
                    "rounded-2xl transition-colors duration-300 overflow-hidden",
                    isOpen 
                      ? "bg-background border border-primary/30 shadow-sm" 
                      : "bg-[#EAEAEA] dark:bg-[#1C1C1F] hover:bg-[#E2E2E2] dark:hover:bg-[#232326] cursor-pointer"
                  )}
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                >
                  <div className="px-6 py-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold text-muted-foreground">{faq.id}</span>
                      <h3 className={cn(
                        "font-medium text-base transition-colors",
                        isOpen ? "text-foreground" : "text-foreground/80"
                      )}>
                        {faq.question}
                      </h3>
                    </div>
                    
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300",
                      isOpen ? "bg-background border border-border" : "bg-[#111] dark:bg-[#000]"
                    )}>
                      {isOpen ? (
                        <X className="w-4 h-4 text-foreground" />
                      ) : (
                        <Plus className="w-4 h-4 text-white" />
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                      >
                        <div className="px-6 pb-6 pt-2 pl-14 text-muted-foreground text-sm leading-relaxed max-w-2xl">
                          {faq.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <div className="mt-16 text-center">
            <p className="text-sm text-muted-foreground mb-2">Have any other questions?</p>
            <a href="mailto:support@meetlite.com" className="text-sm font-semibold text-foreground hover:text-primary transition-colors flex items-center justify-center gap-1">
              Contact Us <ArrowRightIcon className="w-3 h-3" />
            </a>
          </div>

        </div>
      </div>
    </section>
  );
};

const ArrowRightIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M3 10a.75.750 0 01.75-.75h10.638L10.23 5.29a.75.750 111.04-1.08l5.5 5.25a.75.750 010 1.08l-5.5 5.25a.75.750 11-1.04-1.08l4.158-3.96H3.75A.75.750 013 10z" clipRule="evenodd" />
  </svg>
);

export default FaqSection;
