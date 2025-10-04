import { Button } from '@/components/ui/button';
import { ArrowRight, Users, Shield, Zap } from 'lucide-react';

const CTASection = () => {
  return (
    <section
      id="contact"
      className="py-20 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden"
    >
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1)_0%,transparent_50%)]"></div>

      {/* Geometric pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%)] bg-[length:40px_40px]"></div>

      {/* Subtle noise texture */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      ></div>

      {/* Gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>

      <div className="relative max-w-4xl mx-auto text-center px-4 sm:px-6 space-y-12">
        <div className="space-y-6">
          <h2 className="text-fluid-4xl font-heading font-bold text-white">
            Ready to transform your meetings?
          </h2>
          <p className="text-fluid-lg text-blue-200 max-w-2xl mx-auto">
            Join 100,000+ teams who've already eliminated meeting friction.
            Start your free trial today - no credit card required.
          </p>
        </div>

        {/* Trust Indicators */}
        <div className="flex flex-wrap justify-center items-center gap-8 text-blue-200">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span className="font-medium">100,000+ teams</span>
          </div>
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span className="font-medium">SOC 2 Compliant</span>
          </div>
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5" />
            <span className="font-medium">2-second join time</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button
            size="lg"
            className="w-full sm:w-auto bg-white text-blue-600 hover:bg-gray-50 rounded-xl px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group hover-lift"
          >
            Start Free Trial
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto border-2 border-white/30 text-white hover:bg-white/10 rounded-xl px-8 py-6 text-lg font-semibold backdrop-blur-sm bg-transparent hover-lift"
          >
            Schedule a Demo
          </Button>
        </div>

        <p className="text-sm text-blue-300">
          Free 14-day trial • No setup fees • Cancel anytime
        </p>
      </div>
    </section>
  );
};

export default CTASection;
