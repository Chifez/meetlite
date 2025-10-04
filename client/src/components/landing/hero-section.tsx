import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Play, Video, Users, Shield, Zap } from 'lucide-react';
import StatsDisplay from '@/components/landing/stats-display';
import FeaturePills from '@/components/landing/feature-pills';

const HeroSection = () => {
  return (
    <div className="relative h-full py-6 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/20 overflow-hidden transition-colors duration-300">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-200/20 dark:bg-purple-400/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -left-40 w-60 h-60 bg-blue-200/20 dark:bg-blue-400/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-pink-200/20 dark:bg-pink-400/10 rounded-full blur-2xl"></div>
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:14px_24px]"></div>

      {/* Hero Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-6 sm:space-y-8">
            <Badge className="py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800/30 transition-all duration-300 animate-fade-in">
              <Zap className="w-3 h-3 mr-2" />
              The future of video meetings is here
            </Badge>

            <div className="space-y-4 sm:space-y-6">
              <h1 className="text-fluid-3xl font-heading font-bold leading-tight tracking-tight">
                <span className="text-blue-900 dark:text-white">
                  Stop Hosting,
                </span>
                <br />
                <span className="text-blue-900 dark:text-white">
                  Boring Meetings
                </span>
              </h1>

              <p className="text-fluid-lg text-gray-600 dark:text-gray-300 leading-relaxed max-w-2xl">
                Host engaging, interactive meetings on 4K crystal-clear video.
                With built-in collaboration tools and conflict-free smart
                scheduling, every meeting is more productive.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="bg-blue-600 text-white rounded-full px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group"
              >
                Start Meeting Now
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="rounded-full px-8 py-6 text-lg font-semibold border-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 group bg-transparent border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
              >
                <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                Watch Demo
              </Button>
            </div>

            {/* Feature Pills - Mobile */}
            <div className="lg:hidden">
              <FeaturePills />
            </div>

            {/* Stats - Mobile */}
            <div className="lg:hidden">
              <StatsDisplay />
            </div>
          </div>

          {/* Right Visual Element */}
          <div className="relative md:block hidden mt-10 lg:mt-0">
            <div className="relative z-10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-gray-200/50 dark:border-gray-700/50 hover-lift">
              <div className="aspect-video bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 dark:from-blue-400/10 dark:to-indigo-400/10"></div>
                <div className="relative z-10 text-center space-y-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                    <Video className="w-10 h-10 text-white" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                      Crystal Clear Video
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      4K quality with smart bandwidth optimization
                    </p>
                  </div>
                </div>

                {/* Floating Elements */}
                <div className="absolute top-4 right-4 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <div
                  className="absolute bottom-4 left-4 w-2 h-2 bg-blue-400 rounded-full animate-pulse"
                  style={{ animationDelay: '0.5s' }}
                ></div>
                <div
                  className="absolute top-1/2 left-4 w-2 h-2 bg-indigo-400 rounded-full animate-pulse"
                  style={{ animationDelay: '1s' }}
                ></div>
              </div>

              {/* Mock Interface Elements */}
              <div className="mt-6 space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full"></div>
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="w-3/4 h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"></div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full"></div>
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="w-1/2 h-full bg-gradient-to-r from-blue-400 to-cyan-500 rounded-full"></div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full"></div>
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="w-5/6 h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Cards */}
            <div className="absolute -top-6 -left-6 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-gray-200/50 dark:border-gray-700/50 rotate-[-3deg] hover-lift">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Recording Started
                </span>
              </div>
            </div>

            <div className="absolute -bottom-6 -right-6 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-gray-200/50 dark:border-gray-700/50 rotate-[3deg] hover-lift">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  12 participants
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Feature Pills and Stats - Desktop */}
      <div className="hidden lg:flex flex-col items-center py-5">
        <FeaturePills />
        <StatsDisplay />
      </div>
    </div>
  );
};

export default HeroSection;
