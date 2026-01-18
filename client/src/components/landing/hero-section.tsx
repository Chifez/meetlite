import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Play, Video, Users } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import StatsDisplay from '@/components/landing/stats-display';
import FeaturePills from '@/components/landing/feature-pills';
import VideoDemoModal from '@/components/landing/video-demo-modal';

const HeroSection = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  const handleStartMeeting = () => {
    if (isAuthenticated) {
      // Redirect to dashboard where user can start a meeting
      navigate('/dashboard');
    } else {
      // Redirect to login page
      navigate('/login', { state: { from: 'landing' } });
    }
  };

  const handleWatchDemo = () => {
    setIsVideoModalOpen(true);
  };
  return (
    <div className="relative min-h-[90vh] flex items-center bg-background overflow-hidden transition-colors duration-300">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      {/* Hero Content - Centered SaaS Layout */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Badge */}
          <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 transition-colors px-4 py-1.5">
            <svg
              className="w-3 h-3 mr-1.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                clipRule="evenodd"
              />
            </svg>
            The future of video meetings is here
          </Badge>

          {/* HEADLINE */}
          <div className="space-y-4 max-w-4xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.15] text-foreground tracking-[-0.02em]">
              Collaborative Conferencing
              <br />
              <span className="text-primary font-normal italic">
                For Modern Teams
              </span>
            </h1>

            {/* Small Description */}
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl mx-auto font-normal">
              Experience seamless video conferencing with advanced scheduling,
              smart invites, and enterprise-grade privacy.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              size="default"
              onClick={handleStartMeeting}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 py-2.5 text-sm font-medium shadow-md hover:shadow-lg transition-all duration-200 group"
            >
              Start Meeting Now
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
            </Button>

            <Button
              variant="outline"
              size="default"
              onClick={handleWatchDemo}
              className="rounded-lg px-6 py-2.5 text-sm font-medium border-2 hover:bg-muted transition-all duration-200 group"
            >
              <Play className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform duration-200" />
              Watch Demo
            </Button>
          </div>

          {/* Video Demo Modal */}
          <VideoDemoModal
            open={isVideoModalOpen}
            onClose={() => setIsVideoModalOpen(false)}
          />

          {/* Feature Pills */}
          <div className="pt-4">
            <FeaturePills />
          </div>

          {/* Stats */}
          <div className="pt-2">
            <StatsDisplay />
          </div>

          {/* Image Box */}
          <div className="relative w-full max-w-5xl mt-12">
            <div className="relative bg-card border border-border rounded-2xl p-8 shadow-xl overflow-hidden">
              <div className="aspect-video bg-muted rounded-xl flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-primary/5"></div>
                <div className="relative z-10 text-center space-y-4">
                  <div className="w-20 h-20 bg-primary rounded-xl flex items-center justify-center mx-auto shadow-lg">
                    <Video className="w-10 h-10 text-primary-foreground" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="hidden md:block text-xl font-semibold text-foreground">
                      Crystal Clear Video
                    </h3>
                    <p className="text-muted-foreground">
                      4K quality with smart bandwidth optimization
                    </p>
                  </div>
                </div>

                {/* Status Indicators */}
                <div className="absolute top-4 right-4 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <div className="absolute bottom-4 left-4 w-2 h-2 bg-primary rounded-full animate-pulse delay-300"></div>
              </div>

              {/* Mock Interface Elements */}
              <div className="mt-6 space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full"></div>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="w-3/4 h-full bg-green-500 rounded-full"></div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary rounded-full"></div>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="w-1/2 h-full bg-primary rounded-full"></div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/80 rounded-full"></div>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="w-5/6 h-full bg-primary/80 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Cards */}
            <div className="absolute -top-4 -left-4 bg-card border border-border rounded-xl p-3 shadow-lg rotate-[-3deg] hidden md:block">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-foreground">
                  Recording Started
                </span>
              </div>
            </div>

            <div className="absolute -bottom-4 -right-4 bg-card border border-border rounded-xl p-3 shadow-lg rotate-[3deg] hidden md:block">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  12 participants
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HeroSection;
