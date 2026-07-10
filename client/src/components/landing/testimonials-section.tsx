const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'CEO',
    company: 'TechStart Inc.',
    content: 'The integrated canvas completely replaced our need for three separate tools during design reviews.',
    initials: 'SC',
    color: 'bg-primary',
  },
  {
    name: 'Marcus Rodriguez',
    role: 'Head of Product',
    company: 'DesignCo',
    content: 'Being able to drop a sticky note onto the live video feed is the kind of magic I never knew we needed.',
    initials: 'MR',
    color: 'bg-[#2E7D5B]',
  },
  {
    name: 'Emily Johnson',
    role: 'Director of Operations',
    company: 'Growth Labs',
    content: 'The AI transcripts perfectly label speakers even when our entire engineering team is talking over each other.',
    initials: 'EJ',
    color: 'bg-warm',
  },
];

const TestimonialsSection = () => {
  return (
    <section id="testimonials" className="py-24 bg-muted/30 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">

        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Loved by collaborative teams.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <article
              key={i}
              className="flex flex-col bg-card border border-border rounded-2xl p-8 hover:border-border/80 transition-colors shadow-sm"
            >
              {/* Quote */}
              <blockquote className="text-lg text-foreground font-medium leading-relaxed flex-1 mb-8">
                "{t.content}"
              </blockquote>

              {/* Attribution */}
              <footer className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center flex-shrink-0 shadow-sm`}
                >
                  <span className="text-xs font-bold text-white">{t.initials}</span>
                </div>
                <div>
                  <p className="font-bold text-foreground leading-snug">
                    {t.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t.role}, {t.company}
                  </p>
                </div>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
