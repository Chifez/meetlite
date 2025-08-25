import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

const CTASection = () => {
  return (
    <section
      id="contact"
      className="py-10 bg-gradient-to-r from-purple-600 via-blue-600 to-purple-700 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-black/10"></div>
      <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] bg-[length:20px_20px]"></div>

      <div className="relative max-w-4xl mx-auto text-center px-4 sm:px-6 space-y-8">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
          Ready to transform your meetings?
        </h2>
        <p className="text-lg sm:text-xl text-purple-100 max-w-2xl mx-auto">
          Join thousands of teams who've already made the switch to better video
          conferencing.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button
            size="lg"
            className="w-full sm:w-auto bg-white text-purple-600 hover:bg-gray-50 rounded-full px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group"
          >
            Start Your First Meeting
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto border-2 border-white/30 text-white hover:bg-white/10 rounded-full px-8 py-6 text-lg font-semibold backdrop-blur-sm bg-transparent"
          >
            Schedule a Demo
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
