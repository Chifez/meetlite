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
    <div className="relative pt-12 pb-16 md:pt-20 md:pb-24 bg-background overflow-hidden border-b border-border">
      <main className="relative z-10 w-full max-w-[1400px] mx-auto px-4 sm:px-6 flex flex-col items-center">

        <div className="flex flex-col items-center text-center space-y-8 w-full">

          {/* HEADLINE */}
          <div className="space-y-6 max-w-4xl mx-auto flex flex-col items-center">
            <div className="inline-flex items-center rounded-full border border-border/60 bg-transparent px-4 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 shadow-sm">
              ◆ REAL-TIME COLLABORATION
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-medium text-foreground leading-[1.1] tracking-tight">
              Video calls for your <br />
              <span className="text-primary italic font-serif">best ideas.</span>
            </h1>

            <p className="max-w-2xl text-base text-muted-foreground leading-relaxed">
              MeetLite fuses HD video, a live whiteboard, and AI transcription into one workspace — so nothing gets lost between the call and the follow-up.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
              <Button
                onClick={handleStartMeeting}
                className="rounded-xl px-6 h-12 text-sm font-semibold shadow-sm group"
              >
                Start a meeting
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>

              <Button
                variant="outline"
                onClick={handleWatchDemo}
                className="rounded-xl px-6 h-12 text-sm font-semibold border-border bg-transparent hover:bg-card text-foreground transition-all group shadow-sm"
              >
                <Play className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform fill-foreground/10" />
                Watch a 90-second demo
              </Button>
            </div>
          </div>

          <VideoDemoModal
            open={isVideoModalOpen}
            onClose={() => setIsVideoModalOpen(false)}
          />

          {/* PRODUCT VISUAL */}
          <div className="w-[90%] md:w-[80%] max-w-5xl mx-auto mt-16 mb-12 relative">
            <div className="absolute w-full aspect-square bg-primary/20 rounded-full blur-[100px] pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            <div className="relative bg-[#1A1A1A] border border-border/50 dark:border-white/10 rounded-3xl p-4 shadow-2xl">
              <CollaborativeHeroMockup />
            </div>
          </div>

          {/* INLINE PROOF STRIP */}
          <div className="w-full max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-xs font-bold text-muted-foreground uppercase tracking-wider mt-4">
            <span>99.9% uptime</span>
            <span className="w-1 h-1 rounded-full bg-border"></span>
            <span>&lt;50ms latency</span>
            <span className="w-1 h-1 rounded-full bg-border"></span>
            <span>HD 1080p</span>
          </div>

        </div>
      </main>
    </div>
  );
};

export default HeroSection;
