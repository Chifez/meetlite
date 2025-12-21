import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

const CTASection = () => {
  return (
    <section
      id="contact"
      className="py-20 bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 dark:from-orange-600 dark:via-amber-600 dark:to-yellow-600 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/95 via-amber-500/95 to-yellow-500/95 dark:from-orange-600/95 dark:via-amber-600/95 dark:to-yellow-600/95"></div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      <div className="relative max-w-4xl mx-auto text-center px-4 sm:px-6 space-y-6">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-white">
          Ready to get started?
        </h2>
        <p className="text-base sm:text-lg text-white/90 max-w-2xl mx-auto">
          Join thousands of teams using MeetLite.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-4">
          <Button
            size="default"
            className="w-full sm:w-auto bg-white text-orange-600 hover:bg-white/90 rounded-lg px-6 py-2.5 text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-200 group"
          >
            Start Your First Meeting
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
          </Button>

          <Button
            variant="outline"
            size="default"
            className="w-full sm:w-auto border-2 border-white/30 text-white hover:bg-white/10 rounded-lg px-6 py-2.5 text-sm font-medium bg-transparent"
          >
            Schedule a Demo
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
