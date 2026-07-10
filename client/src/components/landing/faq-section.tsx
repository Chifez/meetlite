import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const FAQS = [
  {
    question: 'Do external guests need an account to join?',
    answer: 'No. You can invite anyone to a MeetLite session via a simple URL. Guests can join, chat, and interact with the canvas immediately without registering or downloading any software.',
  },
  {
    question: 'How many people can collaborate on the canvas at once?',
    answer: 'MeetLite supports up to 50 simultaneous editors on the canvas with sub-50ms latency. For view-only participants, the limit extends to 500 per session.',
  },
  {
    question: 'Can I export the canvas after the meeting?',
    answer: 'Yes. You can export the entire canvas as a high-resolution PNG, SVG, or a structured PDF. If you have the AI layer enabled, you will also receive a linked document containing the transcript and AI-generated summary.',
  },
  {
    question: 'How does the AI transcription handle multiple speakers?',
    answer: 'Our audio engine routes discrete streams to the AI, allowing it to accurately label speakers even when people talk over each other. It distinguishes voices and formats the transcript cleanly.',
  },
  {
    question: 'Is my data used to train your AI models?',
    answer: 'Never. We have strict data processing agreements with our AI providers ensuring zero-data-retention. Your transcripts and canvas data are exclusively yours and are never used for model training.',
  },
];

export const FaqSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-24 bg-background border-b border-border">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Common Questions</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Everything you need to know about the product and billing.
          </p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;

            return (
              <div 
                key={index}
                className={cn(
                  "border rounded-2xl overflow-hidden transition-colors duration-200",
                  isOpen ? "bg-card border-border shadow-sm" : "bg-transparent border-transparent hover:border-border/50"
                )}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full text-left px-6 py-5 flex items-center justify-between focus:outline-none"
                >
                  <span className="font-semibold text-lg text-foreground pr-8">{faq.question}</span>
                  <div className={cn(
                    "p-1 rounded-full transition-colors",
                    isOpen ? "bg-background text-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    <ChevronDown className={cn("w-5 h-5 transition-transform duration-300", isOpen && "rotate-180")} />
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <div className="px-6 pb-6 pt-2 text-muted-foreground leading-relaxed">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FaqSection;
