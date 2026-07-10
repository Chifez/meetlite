import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import VideoDemoModal from '@/components/landing/video-demo-modal';
import CollaborativeHeroMockup from '@/components/landing/collaborative-hero-mockup';

const HeroSection = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  const handleStartMeeting = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/login', { state: { from: 'landing' } });
    }
  };

  const handleWatchDemo = () => {
    setIsVideoModalOpen(true);
  };

  return (
    <div className="relative pt-12 pb-16 md:pt-20 md:pb-24 flex items-center bg-background overflow-hidden border-b border-border">
      {/* Subtle clean background grid */}
      <div className="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:24px_24px] opacity-40 [mask-image:linear-gradient(to_bottom,white,transparent)]" />

      {/* Hero Content */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col items-center text-center space-y-8">
          
          {/* HEADLINE */}
          <div className="space-y-6 max-w-4xl mx-auto flex flex-col items-center">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 mb-4">
              <span className="mr-2 text-primary">⚡</span>
              The future of video meetings is here
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground leading-tight tracking-tight">
              Collaborative Conferencing
              <br />
              <span className="text-primary italic font-semibold mt-1 block">
                For Modern Teams
              </span>
            </h1>

            {/* Small Description */}
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              A shared workspace where video is just one feature. Combine crystal clear calling with a real-time multiplayer canvas to actually build things together.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
            <Button
              onClick={handleStartMeeting}
              className="bg-gradient-to-r from-primary via-[#5C85B5] to-primary bg-[length:200%_auto] animate-gradient text-white hover:opacity-90 rounded-xl px-6 py-5 text-sm font-semibold transition-all shadow-md group border-0"
            >
              Start a meeting
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>

            <Button
              variant="outline"
              onClick={handleWatchDemo}
              className="rounded-xl px-6 py-5 text-sm font-semibold border-border bg-transparent hover:bg-card text-foreground transition-all group shadow-sm"
            >
              <Play className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform fill-foreground/10" />
              Watch a demo
            </Button>
          </div>

          {/* Video Demo Modal */}
          <VideoDemoModal
            open={isVideoModalOpen}
            onClose={() => setIsVideoModalOpen(false)}
          />

          {/* Mockup Signature Element */}
          <div className="w-full mt-16 lg:mt-24">
            <CollaborativeHeroMockup />
          </div>

        </div>
      </main>
    </div>
  );
};

export default HeroSection;
