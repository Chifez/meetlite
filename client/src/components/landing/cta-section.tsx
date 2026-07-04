import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';

const CTASection = () => {
  const navigate = useNavigate();

  return (
    <section
      id="contact"
      className="relative py-24 overflow-hidden bg-primary"
    >
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:32px_32px]"
        aria-hidden="true"
      />
      {/* Radial glow */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.65_0.22_255/0.3),transparent_65%)]"
        aria-hidden="true"
      />

      <div className="relative max-w-3xl mx-auto text-center px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <p className="text-[0.75rem] font-semibold tracking-[0.1em] uppercase text-primary-foreground/60 mb-4">
            Get started today
          </p>
          <h2 className="text-[2rem] sm:text-[2.75rem] font-bold text-primary-foreground tracking-[-0.03em] mb-4">
            Your team's first meeting
            <br />is free, forever.
          </h2>
          <p className="text-[0.9375rem] text-primary-foreground/75 max-w-lg mx-auto mb-8">
            No credit card required. Set up in under two minutes, then invite your team and start collaborating.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              id="cta-signup"
              size="lg"
              className="rounded-xl bg-white text-primary hover:bg-white/92 font-semibold px-8"
              onClick={() => navigate('/signup')}
            >
              Start for free
              <ArrowRight className="w-4 h-4" />
            </Button>

            <Button
              id="cta-demo"
              variant="outline"
              size="lg"
              className="rounded-xl border-white/25 text-primary-foreground bg-white/8 hover:bg-white/15 font-semibold px-8"
              onClick={() => navigate('/login')}
            >
              Book a demo
            </Button>
          </div>

          <p className="mt-5 text-[0.75rem] text-primary-foreground/50">
            Trusted by 10,000+ teams · SOC 2 Type II certified · 99.9% uptime SLA
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
