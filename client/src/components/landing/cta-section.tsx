import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

const CTASection = () => {
  return (
    <section id="contact" className="py-20 bg-primary relative overflow-hidden">
      <div className="absolute inset-0 bg-primary/95"></div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      <div className="relative max-w-4xl mx-auto text-center px-4 sm:px-6 space-y-6">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-primary-foreground">
          Ready to get started?
        </h2>
        <p className="text-base sm:text-lg text-primary-foreground/90 max-w-2xl mx-auto">
          Join thousands of teams using MeetLite.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-4">
          <Button
            size="default"
            className="w-full sm:w-auto bg-primary-foreground text-primary hover:bg-primary-foreground/90 rounded-lg px-6 py-2.5 text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-200 group"
          >
            Start Your First Meeting
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
          </Button>

          <Button
            variant="outline"
            size="default"
            className="w-full sm:w-auto border-2 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 rounded-lg px-6 py-2.5 text-sm font-medium bg-transparent"
          >
            Schedule a Demo
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
