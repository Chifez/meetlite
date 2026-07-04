import { Star } from 'lucide-react';
import { motion } from 'motion/react';

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'CEO',
    company: 'TechStart Inc.',
    content:
      'MeetLite has fundamentally changed how we run distributed meetings. Smart scheduling alone recovered 6 hours per week across our leadership team.',
    rating: 5,
    initials: 'SC',
    color: 'bg-primary',
  },
  {
    name: 'Marcus Rodriguez',
    role: 'Head of Product',
    company: 'DesignCo',
    content:
      'The video quality is outstanding, and the interface never gets in the way. It\'s the first conferencing tool our team actually prefers over the incumbents.',
    rating: 5,
    initials: 'MR',
    color: 'bg-emerald-500',
  },
  {
    name: 'Emily Johnson',
    role: 'Director of Operations',
    company: 'Growth Labs',
    content:
      'We evaluated six platforms before choosing MeetLite. The privacy controls and audit logs gave us the confidence to migrate our entire org within a week.',
    rating: 5,
    initials: 'EJ',
    color: 'bg-amber-500',
  },
];

const TestimonialsSection = () => {
  return (
    <section id="testimonials" className="py-24 bg-muted/30 border-y border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* Section header */}
        <div className="text-center mb-14">
          <p className="text-label mb-3">Customer stories</p>
          <h2 className="text-[1.875rem] sm:text-[2.5rem] font-bold text-foreground tracking-[-0.03em]">
            Teams that moved to MeetLite
            <br className="hidden sm:block" />
            <span className="text-muted-foreground font-medium"> don't go back.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <motion.article
              key={i}
              className="flex flex-col gap-4 bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-colors duration-200"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              {/* Stars */}
              <div className="flex items-center gap-0.5" aria-label={`${t.rating} out of 5 stars`}>
                {Array.from({ length: t.rating }).map((_, si) => (
                  <Star
                    key={si}
                    className="w-3.5 h-3.5 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="text-[0.875rem] text-foreground leading-relaxed flex-1">
                "{t.content}"
              </blockquote>

              {/* Attribution */}
              <footer className="flex items-center gap-3 pt-3 border-t border-border">
                <div
                  className={`w-8 h-8 rounded-full ${t.color} flex items-center justify-center flex-shrink-0`}
                >
                  <span className="text-[0.625rem] font-bold text-white">{t.initials}</span>
                </div>
                <div>
                  <p className="text-[0.8125rem] font-semibold text-foreground leading-none">
                    {t.name}
                  </p>
                  <p className="text-[0.75rem] text-muted-foreground mt-0.5">
                    {t.role} · {t.company}
                  </p>
                </div>
              </footer>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
